'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

// Types
interface Category {
    id: number;
    name: string;
}

interface Product {
    id: number;
    name: string;
    description: string;
    price: number;
    category_id: number;
    imagen_url: string;
    available: boolean;
    categories?: {
        name: string;
    };
}

interface GroupedProduct {
    name: string;
    description: string;
    imagen_url: string;
    category_id: number;
    basePrice: number;
    variants: {
        id: number;
        size: string;
        price: number;
        fullProduct: Product;
    }[];
}

interface CartItem extends Product {
    cartItemId: string;
    quantity: number;
    selectedSize?: string;
    extras?: string[];
}

type OrderType = 'dine-in' | 'takeout' | 'delivery';

export default function TiendaPage() {
    const router = useRouter();

    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [userName, setUserName] = useState('');

    // UI State
    const [selectedCategory, setSelectedCategory] = useState<string | number>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<GroupedProduct | null>(null);
    const [currentSize, setCurrentSize] = useState<string>('');
    const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
    const [activeBanner, setActiveBanner] = useState<any>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true); // New Loading State // Dynamic Banner State

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
    const [showOrderSuccess, setShowOrderSuccess] = useState(false);
    const [lastOrderId, setLastOrderId] = useState<number | null>(null);
    const [showMobileCart, setShowMobileCart] = useState(false);

    // Loading Screen State
    const [isProcessingOrder, setIsProcessingOrder] = useState(false);
    const [processingStep, setProcessingStep] = useState('');
    const [whatsappLink, setWhatsappLink] = useState('');

    const EXTRAS_OPTIONS = [
        { id: 'extra_cheese', name: 'Extra Queso', price: 20 },
        { id: 'stuffed_crust', name: 'Orilla Rellena', price: 35 },
        { id: 'extra_sauce', name: 'Extra Salsa', price: 10 },
    ];

    // Initial Data Fetch
    useEffect(() => {
        const loadAllData = async () => {
            try {
                await Promise.all([
                    fetchUserData(),
                    fetchCategories(),
                    fetchProducts(),
                    fetchActiveBanner()
                ]);
            } catch (error) {
                console.error('Error loading app data:', error);
            } finally {
                // Pequeño timeout para asegurar que la transición sea suave
                setTimeout(() => setIsInitialLoading(false), 800);
            }
        };
        loadAllData();
    }, []);

    const fetchActiveBanner = async () => {
        try {
            const { data } = await supabase
                .from('banners')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false }) // En caso de multiples, el más nuevo
                .limit(1)
                .maybeSingle();

            if (data) setActiveBanner(data);
        } catch (e) {
            console.error('Error loading banner:', e);
        }
    };

    // Restore cart from localStorage after login
    useEffect(() => {
        if (userId) {
            const pendingCart = localStorage.getItem('pendingCart');
            const pendingDeliveryAddress = localStorage.getItem(' pendingDeliveryAddress');
            const pendingPhoneNumber = localStorage.getItem('pendingPhoneNumber');

            if (pendingCart) {
                try {
                    const parsedCart = JSON.parse(pendingCart);
                    setCart(parsedCart);
                    console.log('✅ Carrito restaurado después del login');
                } catch (e) {
                    console.error('Error al restaurar carrito:', e);
                }
                localStorage.removeItem('pendingCart');
            }

            if (pendingDeliveryAddress) {
                setDeliveryAddress(pendingDeliveryAddress);
                localStorage.removeItem('pendingDeliveryAddress');
            }

            if (pendingPhoneNumber) {
                setPhoneNumber(pendingPhoneNumber);
                localStorage.removeItem('pendingPhoneNumber');
            }
        }
    }, [userId]);

    const fetchUserData = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setUserId(session.user.id);

            // Get data from metadata (guaranteed from registration) or profile
            const metadata = session.user.user_metadata;

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            const fullName = profile?.full_name || metadata.full_name || 'Cliente';
            const phone = profile?.phone_number || metadata.phone_number || '';
            const address = profile?.address || metadata.address || '';

            setUserName(fullName);
            if (phone) setPhoneNumber(phone);
            if (address) setDeliveryAddress(address);
        }
    };

    const fetchCategories = async () => {
        const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name');
        setCategories(data || []);
    };

    const fetchProducts = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('products')
            .select('*, categories(name)')
            .eq('available', true)
            .order('name');
        setProducts(data || []);
        setLoading(false);
    };

    // Derived State: Group Products
    const groupedProducts = useMemo(() => {
        const groups: { [key: string]: GroupedProduct } = {};

        products.forEach(product => {
            // Extract base name and size, e.g., "Pepperoni (Grande)" -> "Pepperoni", "Grande"
            const match = product.name.match(/^(.*?)\s*\((.*?)\)$/);
            const baseName = match ? match[1] : product.name;
            const size = match ? match[2] : 'Estándar';

            if (!groups[baseName]) {
                groups[baseName] = {
                    name: baseName,
                    description: product.description,
                    imagen_url: product.imagen_url,
                    category_id: product.category_id,
                    basePrice: product.price, // Will be updated to min price
                    variants: []
                };
            }

            groups[baseName].variants.push({
                id: product.id,
                size: size,
                price: product.price,
                fullProduct: product
            });

            // Keep base price as the minimum price found
            if (product.price < groups[baseName].basePrice) {
                groups[baseName].basePrice = product.price;
            }
        });

        // Ensure variants are sorted by price order often helps (Chica < Grande)
        Object.values(groups).forEach(g => {
            const sizeOrder = { 'Chica': 1, 'Mediana': 2, 'Grande': 3, 'Familiar': 4, 'Estándar': 0 };
            g.variants.sort((a, b) => {
                const orderA = sizeOrder[a.size as keyof typeof sizeOrder] || 99;
                const orderB = sizeOrder[b.size as keyof typeof sizeOrder] || 99;
                return orderA - orderB;
            });
        });

        return Object.values(groups);
    }, [products]);

    const filteredGroupedProducts = useMemo(() => {
        return groupedProducts.filter(product => {
            const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [groupedProducts, selectedCategory, searchQuery]);

    // Cart Logic
    const addToCart = () => {
        if (!selectedProduct || !currentSize) return;

        const variant = selectedProduct.variants.find(v => v.size === currentSize);
        if (!variant) return;

        // Calculate total price with extras
        const extrasCost = selectedExtras.reduce((sum, extraId) => {
            const extra = EXTRAS_OPTIONS.find(e => e.id === extraId);
            return sum + (extra ? extra.price : 0);
        }, 0);

        // We create a new cart item based on the VARIANT product ID, but we override the price to include extras visually if we wanted, 
        // but typically cart line items show base price + modifiers. 
        // For simplicity, let's treat the variant price as base, and extras separate?
        // Actually, to keep the UI simple, let's just add a cart item with the final calculated price? 
        // Ideally, we shouldn't mute the product price. Let's stick to the variant price and maybe handle extras as property.

        // However, `CartItem` extends `Product`.
        const newItem: CartItem = {
            ...variant.fullProduct,
            cartItemId: crypto.randomUUID(),
            quantity: 1,
            selectedSize: currentSize,
            extras: selectedExtras,
            price: variant.price + extrasCost // Storing total unit price here for simplicity in totals
        };

        setCart(prev => [...prev, newItem]);

        // Reset and close modal
        setSelectedProduct(null);
        setCurrentSize('');
        setSelectedExtras([]);
    };

    const removeFromCart = (cartItemId: string) => {
        setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    };

    const updateQuantity = (cartItemId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.cartItemId === cartItemId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error signing out:', error);
        // Force header update by reloading or clearing state
        setUserId(null);
        setUserName('');
        window.location.href = '/tienda';
    };

    const handleCheckout = async () => {
        console.log('🔵 Iniciando envío de pedido a domicilio...', {
            userId,
            customerName: userName,
            cartItems: cart,
            total: cartTotals.total,
            deliveryAddress,
            phoneNumber
        });

        // Check if user is authenticated
        if (!userId) {
            console.warn('⚠️ Usuario no autenticado, redirigiendo al login...');
            // Save cart to localStorage before redirecting
            localStorage.setItem('pendingCart', JSON.stringify(cart));
            localStorage.setItem('pendingDeliveryAddress', deliveryAddress);
            localStorage.setItem('pendingPhoneNumber', phoneNumber);
            // Redirect to register with return URL
            router.push('/register?redirect=/tienda&checkout=true');
            return;
        }

        if (cart.length === 0) {
            console.warn('❌ Intento de checkout fallido: Carrito vacío');
            return;
        }

        // Validate delivery information
        if (!deliveryAddress || !phoneNumber || !userName) {
            alert('Por favor completa todos los datos de entrega:\n- Nombre completo\n- Teléfono\n- Dirección de entrega');
            return;
        }

        setIsCheckoutLoading(true);
        setIsProcessingOrder(true);
        setProcessingStep('Guardando tu pedido...');

        try {
            // 1. Insert Order in Database with Auto-Correction for FK errors
            let orderData;

            const insertOrder = async () => {
                return await supabase
                    .from('orders')
                    .insert({
                        user_id: userId,
                        customer_name: userName,
                        status: 'pendiente',
                        order_type: 'delivery',
                        total_amount: cartTotals.total,
                        delivery_address: deliveryAddress,
                        phone_number: phoneNumber
                    })
                    .select()
                    .single();
            };

            let { data, error } = await insertOrder();

            // Handle Foreign Key Error (Missing Profile/Usuario)
            if (error && (error.code === '23503' || error.message?.includes('foreign key'))) {
                console.warn('⚠️ Detectado error de FK (Perfil faltante). Intentando sincronizar...');
                setProcessingStep('Sincronizando perfil...');

                // Call Sync Endpoint
                await fetch('/api/sync-profile', {
                    method: 'POST',
                    body: JSON.stringify({ fullName: userName, phone: phoneNumber, address: deliveryAddress })
                });

                setProcessingStep('Reintentando pedido...');
                // Retry Insertion
                const retry = await insertOrder();
                data = retry.data;
                error = retry.error;
            }

            if (error) throw error;
            orderData = data;

            setProcessingStep('Preparando detalles...');
            await new Promise(resolve => setTimeout(resolve, 800));

            // 2. Prepare Order Items
            const orderItems = cart.map(item => ({
                order_id: orderData.id,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity,
                selected_size: item.selectedSize,
                extras: item.extras ? JSON.stringify(item.extras) : null
            }));

            // 3. Insert Items
            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            setProcessingStep('Conectando con WhatsApp...');
            await new Promise(resolve => setTimeout(resolve, 800));

            // 4. Build WhatsApp Message
            const whatsappNumber = '527411502721'; // Mexico format: 52 + number

            let message = `🍕 *NUEVO PEDIDO #${orderData.id} - DOMICILIO*\n\n`;
            message += `👤 *Cliente:* ${userName}\n`;
            message += `📍 *Dirección:* ${deliveryAddress}\n`;
            message += `📱 *Teléfono:* ${phoneNumber}\n`;
            message += `\n🛒 *PRODUCTOS:*\n`;

            cart.forEach((item, index) => {
                message += `${index + 1}. ${item.name}`;
                if (item.selectedSize) {
                    message += ` (${item.selectedSize})`;
                }
                message += ` x${item.quantity}`;
                if (item.extras && item.extras.length > 0) {
                    const extrasNames = item.extras.map(extraId => {
                        const extra = EXTRAS_OPTIONS.find(e => e.id === extraId);
                        return extra ? extra.name : '';
                    }).filter(Boolean);
                    if (extrasNames.length > 0) {
                        message += `\n   +${extrasNames.join(', ')}`;
                    }
                }
                message += `\n   💵 $${(item.price * item.quantity).toFixed(2)}\n`;
            });

            message += `\n💰 *TOTAL: $${cartTotals.total.toFixed(2)}*\n`;
            message += `\n_Pedido #${orderData.id} realizado desde CasaleñaPOS 🔥_`;

            // Encode and create WhatsApp URL
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

            setProcessingStep('Notificando al restaurante...');
            await new Promise(resolve => setTimeout(resolve, 600));

            // 5. Send notification to cashier system
            try {
                await fetch('/api/cashier/notify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'new_order_whatsapp',
                        customerName: userName,
                        orderType: 'delivery',
                        orderId: orderData.id,
                        total: cartTotals.total,
                        items: cart.map(item => ({
                            name: item.name,
                            quantity: item.quantity,
                            size: item.selectedSize
                        }))
                    })
                });
            } catch (notifyError) {
                console.error('Error al notificar cajero:', notifyError);
            }

            // 6. Clear cart and show success
            setCart([]);
            setDeliveryAddress('');
            setPhoneNumber('');
            setLastOrderId(orderData.id);
            setProcessingStep('¡Todo listo! Abriendo WhatsApp...');
            setWhatsappLink(whatsappUrl);

            // Small delay before showing success modal
            setTimeout(() => {
                setIsProcessingOrder(false); // Hide loading overlay
                setIsCheckoutLoading(false);
                setShowOrderSuccess(true); // Show success modal

                // 7. Open WhatsApp
                window.open(whatsappUrl, '_blank');
            }, 1000);

        } catch (error: any) {
            console.error('Checkout error:', error);

            // Intentar recuperar error legible
            let errorMsg = error.message || 'Error desconocido';
            if (error.code === '23505') errorMsg = 'Ya existe un pedido procesándose.';

            alert(`Hubo un problema al procesar tu pedido: ${errorMsg}\n\nPor favor intenta de nuevo.`);
        } finally {
            // FORCE CLEANUP
            setIsCheckoutLoading(false);
            setIsProcessingOrder(false);
        }
    };

    // Modal Handlers
    const openProductModal = (product: GroupedProduct) => {
        setSelectedProduct(product);
        // Default select the first variant (usually smallest/cheapest) or specific one
        if (product.variants.length > 0) {
            setCurrentSize(product.variants[0].size);
        }
        setSelectedExtras([]);
    };

    const toggleExtra = (extraId: string) => {
        setSelectedExtras(prev =>
            prev.includes(extraId)
                ? prev.filter(id => id !== extraId)
                : [...prev, extraId]
        );
    };

    const cartTotals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return {
            subtotal,
            tax: 0,
            total: subtotal
        };
    }, [cart]);

    const currentVariantPrice = useMemo(() => {
        if (!selectedProduct || !currentSize) return 0;
        const variant = selectedProduct.variants.find(v => v.size === currentSize);
        return variant ? variant.price : 0;
    }, [selectedProduct, currentSize]);

    const currentExtrasPrice = useMemo(() => {
        return selectedExtras.reduce((sum, extraId) => {
            const extra = EXTRAS_OPTIONS.find(e => e.id === extraId);
            return sum + (extra ? extra.price : 0);
        }, 0);
    }, [selectedExtras]);

    if (isInitialLoading) {
        return (
            <div className="fixed inset-0 bg-[#FAFAFA] z-[9999] flex flex-col items-center justify-center">
                <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-[#F7941D]/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-[#F7941D] border-t-transparent rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="material-icons-round text-[#F7941D] text-3xl animate-pulse">restaurant</span>
                    </div>
                </div>
                <h2 className="text-2xl font-black text-[#1D1D1F] mb-2 animate-pulse">Casa Leña</h2>
                <p className="text-gray-400 font-medium text-sm">Preparando tu experiencia...</p>
            </div>
        );
    }

    return (
        <div className="flex h-full bg-[#FAFAFA] text-[#1D1D1F] font-sans overflow-hidden">
            {/* MAIN CONTENT - Product Grid */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] relative overflow-hidden">
                {/* Responsive Header */}
                <header className="min-h-[80px] sm:min-h-[90px] px-3 sm:px-4 md:px-6 lg:px-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between sticky top-0 z-20 bg-[#FAFAFA]/95 backdrop-blur-xl border-b border-gray-100 py-3 sm:py-4 gap-2 sm:gap-4">
                    {/* User Greeting & Logout (Mobile) */}
                    <div className="flex flex-col justify-center min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg sm:text-xl md:text-2xl font-black text-[#1D1D1F] tracking-tight truncate">
                                Hola, {userName ? userName.split(' ')[0] : 'Invitado'} 👋
                            </h1>
                            {userId && (
                                <div className="flex gap-2 sm:hidden">
                                    <button
                                        onClick={() => router.push('/update-password')}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                                        title="Cambiar Contraseña"
                                    >
                                        <span className="material-icons-round text-lg">lock</span>
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                                        title="Cerrar Sesión"
                                    >
                                        <span className="material-icons-round text-lg">logout</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-400 font-medium truncate">¿Qué se te antoja hoy?</p>
                    </div>

                    {/* Search and Profile */}
                    <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 justify-end max-w-2xl min-w-0">
                        {/* Search Bar */}
                        <div className="relative flex-1 max-w-xs sm:max-w-sm group">
                            <span className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#F7941D] transition-colors material-icons-round text-base sm:text-lg">search</span>
                            <input
                                type="text"
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 sm:pl-10 pr-2 sm:pr-3 py-2 sm:py-2.5 bg-white border border-gray-100 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium shadow-sm group-focus-within:shadow-md group-focus-within:ring-2 group-focus-within:ring-[#F7941D]/20 focus:outline-none transition-all placeholder-gray-300"
                            />
                        </div>

                        {/* User Profile - Desktop */}
                        <div className="hidden sm:flex items-center gap-2 md:gap-3 pl-3 md:pl-4 border-l border-gray-200">
                            {userId ? (
                                <>
                                    <button
                                        onClick={() => router.push('/tienda/mis-pedidos')}
                                        className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-50 text-[#F7941D] font-bold text-xs hover:bg-orange-100 transition-colors whitespace-nowrap"
                                    >
                                        <span className="material-icons-round text-sm">receipt_long</span>
                                        Pedidos
                                    </button>
                                    <button
                                        onClick={() => router.push('/update-password')}
                                        className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 text-gray-600 font-bold text-xs hover:bg-gray-100 transition-colors whitespace-nowrap"
                                        title="Cambiar Contraseña"
                                    >
                                        <span className="material-icons-round text-sm">lock</span>
                                        <span className="hidden xl:inline">Contraseña</span>
                                    </button>
                                    <div className="text-right hidden xl:block">
                                        <p className="text-xs font-bold text-gray-900 truncate max-w-[100px]">{userName}</p>
                                        <p className="text-[10px] text-[#F7941D] font-bold tracking-wide uppercase">VIP</p>
                                    </div>
                                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full p-[2px] bg-gradient-to-tr from-[#F7941D] to-[#FFC107] shadow-md flex-shrink-0">
                                        <img src={`https://ui-avatars.com/api/?name=${userName}&background=fff&color=F7941D`} className="w-full h-full rounded-full border-2 border-white object-cover" alt="User" />
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-500 transition-all"
                                        title="Cerrar Sesión"
                                    >
                                        <span className="material-icons-round text-xl">logout</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => router.push('/login?redirect=/tienda')}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#F7941D] to-[#FFC107] text-white font-bold text-xs sm:text-sm hover:shadow-lg transition-all whitespace-nowrap"
                                >
                                    <span className="material-icons-round text-base sm:text-lg">login</span>
                                    <span className="hidden sm:inline">Iniciar Sesión</span>
                                    <span className="sm:hidden">Login</span>
                                </button>
                            )}
                        </div>

                        {/* Mobile Cart Button */}
                        <button
                            onClick={() => setShowMobileCart(true)}
                            className="xl:hidden fixed bottom-20 right-4 z-50 w-12 h-12 sm:w-14 sm:h-14 bg-[#1D1D1F] text-white rounded-full shadow-2xl flex items-center justify-center"
                        >
                            <div className="relative">
                                <span className="material-icons-round text-xl sm:text-2xl">shopping_bag</span>
                                {cart.length > 0 && (
                                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-[#F7941D] text-white text-xs font-bold rounded-full flex items-center justify-center">
                                        {cart.length}
                                    </span>
                                )}
                            </div>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 lg:px-8 pb-20 custom-scrollbar scroll-smooth">
                    {/* Hero Banner - Responsive */}
                    {/* Hero Banner - Responsive */}
                    {activeBanner ? (
                        <div className="w-full h-32 sm:h-40 md:h-44 rounded-xl sm:rounded-2xl md:rounded-[28px] bg-[#1D1D1F] text-white mb-4 sm:mb-6 md:mb-8 relative overflow-hidden shadow-xl group flex shrink-0 mt-4">
                            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10"></div>
                            <img
                                src={activeBanner.image_url}
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                alt={activeBanner.title}
                            />
                            <div className="relative z-20 flex flex-col justify-center h-full px-4 sm:px-6 md:px-10 max-w-xl sm:max-w-2xl">
                                <span className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-[#f7951d] w-fit text-[9px] sm:text-[10px] md:text-xs font-bold mb-1.5 sm:mb-2 shadow-lg shadow-orange-500/30">
                                    {activeBanner.description ? 'NOVEDAD' : 'AVISO'}
                                </span>
                                <h2 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-black mb-1 leading-tight text-white drop-shadow-md">
                                    {activeBanner.title}
                                </h2>
                                {activeBanner.description && (
                                    <p className="text-gray-100 font-medium text-[10px] sm:text-xs md:text-sm max-w-md line-clamp-2 drop-shadow-sm">
                                        {activeBanner.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-32 sm:h-40 md:h-44 rounded-xl sm:rounded-2xl md:rounded-[28px] bg-[#1D1D1F] text-white mb-4 sm:mb-6 md:mb-8 relative overflow-hidden shadow-xl group flex shrink-0 mt-4">
                            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10"></div>
                            <img
                                src="https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=3540&auto=format&fit=crop"
                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                alt="Pizza Banner"
                            />
                            <div className="relative z-20 flex flex-col justify-center h-full px-4 sm:px-6 md:px-10 max-w-xl sm:max-w-2xl">
                                <span className="inline-block px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-[#F7941D] w-fit text-[9px] sm:text-[10px] md:text-xs font-bold mb-1.5 sm:mb-2 shadow-lg shadow-orange-500/30">NUEVO LANZAMIENTO</span>
                                <h2 className="text-base sm:text-xl md:text-2xl lg:text-3xl font-black mb-1 leading-tight">La Pizza Suprema <br className="hidden sm:block" /> <span className="text-[#F7941D]">Edición Limitada</span></h2>
                                <p className="text-gray-300 font-medium text-[10px] sm:text-xs md:text-sm max-w-md line-clamp-2">Disfruta de nuestra nueva creación con ingredientes seleccionados y masa madre de 48 horas.</p>
                            </div>
                        </div>
                    )}

                    {/* Categories - Responsive Sticky */}
                    <div className="sticky top-0 z-10 bg-[#FAFAFA]/95 backdrop-blur-sm py-2 sm:py-3 mb-3 sm:mb-4 flex gap-1.5 sm:gap-2 overflow-x-auto pb-3 scrollbar-hide -mx-1 px-1">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-300 flex-shrink-0 ${selectedCategory === 'all'
                                ? 'bg-[#1D1D1F] text-white shadow-md scale-105'
                                : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm border border-gray-100'
                                }`}
                        >
                            Todos
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-300 flex-shrink-0 ${selectedCategory === cat.id
                                    ? 'bg-[#1D1D1F] text-white shadow-md scale-105'
                                    : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm border border-gray-100'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Product Grid - Responsive */}
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-12 h-12 border-4 border-[#F7941D] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5 pb-20">
                            {filteredGroupedProducts.map((groupedProduct) => (
                                <div
                                    key={groupedProduct.name}
                                    onClick={() => openProductModal(groupedProduct)}
                                    className="group bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col hover:-translate-y-0.5 relative border border-gray-100 hover:border-gray-200 cursor-pointer"
                                >
                                    <div className="relative aspect-square mb-2 sm:mb-3 rounded-lg sm:rounded-xl overflow-hidden bg-gray-50">
                                        {groupedProduct.imagen_url ? (
                                            <img src={groupedProduct.imagen_url} alt={groupedProduct.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                                                <span className="material-icons-round text-2xl sm:text-3xl opacity-50">restaurant</span>
                                            </div>
                                        )}
                                        <div className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 bg-white/95 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-bold shadow-sm text-[#1D1D1F]">
                                            Desde ${groupedProduct.basePrice}
                                        </div>
                                    </div>

                                    <div className="px-1 sm:px-1.5 pb-1 sm:pb-1.5 flex-1 flex flex-col min-h-0">
                                        <h3 className="font-bold text-[#1D1D1F] text-sm sm:text-base leading-tight mb-1 sm:mb-1.5 group-hover:text-[#F7941D] transition-colors line-clamp-1">{groupedProduct.name}</h3>
                                        <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2">
                                            <span className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                                                {groupedProduct.variants.length} tamaños
                                            </span>
                                        </div>

                                        <p className="text-gray-400 text-[10px] sm:text-xs line-clamp-2 leading-snug mb-2 sm:mb-3 flex-1">
                                            {groupedProduct.description}
                                        </p>
                                        <button
                                            className="w-full py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-gray-50 text-[#1D1D1F] font-bold text-[10px] sm:text-xs hover:bg-[#1D1D1F] hover:text-white transition-all duration-300 flex items-center justify-center gap-1.5 group-hover:shadow-md"
                                        >
                                            Personalizar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* PRODUCT CUSTOMIZATION MODAL */}
                {selectedProduct && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white rounded-[32px] w-full max-w-4xl max-h-[90%] shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200">
                            {/* Modal Left Image */}
                            <div className="w-1/2 bg-gray-50 relative hidden md:block">
                                <img
                                    src={selectedProduct.imagen_url || "https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=3540&auto=format&fit=crop"}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    alt={selectedProduct.name}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                                    <div className="text-white">
                                        <h2 className="text-3xl font-black mb-2">{selectedProduct.name}</h2>
                                        <p className="text-gray-200 text-sm">{selectedProduct.description}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Right Content */}
                            <div className="flex-1 flex flex-col h-full bg-white">
                                <div className="p-8 pb-4 flex justify-between items-center border-b border-gray-100">
                                    <h3 className="text-xl font-bold text-[#1D1D1F] md:hidden">{selectedProduct.name}</h3>
                                    <span className="text-gray-400 text-xs uppercase font-bold tracking-wider hidden md:block">Personaliza tu orden</span>
                                    <button
                                        onClick={() => setSelectedProduct(null)}
                                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                                    >
                                        <span className="material-icons-round text-lg">close</span>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                    {/* Size Selection */}
                                    <div className="mb-8">
                                        <h4 className="font-bold text-[#1D1D1F] mb-4 flex items-center gap-2">
                                            <span className="material-icons-round text-[#F7941D]">straighten</span>
                                            Elige el tamaño
                                        </h4>
                                        <div className="space-y-3">
                                            {selectedProduct.variants.map((variant) => (
                                                <label
                                                    key={variant.id}
                                                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${currentSize === variant.size
                                                        ? 'border-[#F7941D] bg-orange-50/50'
                                                        : 'border-gray-100 hover:border-gray-200'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="size"
                                                            value={variant.size}
                                                            checked={currentSize === variant.size}
                                                            onChange={(e) => setCurrentSize(e.target.value)}
                                                            className="w-5 h-5 text-[#F7941D] focus:ring-[#F7941D]"
                                                        />
                                                        <span className={`font-bold ${currentSize === variant.size ? 'text-[#1D1D1F]' : 'text-gray-600'}`}>
                                                            {variant.size}
                                                        </span>
                                                    </div>
                                                    <span className="font-bold text-[#1D1D1F]">${variant.price}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Extras Selection */}
                                    <div>
                                        <h4 className="font-bold text-[#1D1D1F] mb-4 flex items-center gap-2">
                                            <span className="material-icons-round text-[#F7941D]">extension</span>
                                            Agrega extras (Opcional)
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {EXTRAS_OPTIONS.map((extra) => (
                                                <label
                                                    key={extra.id}
                                                    className={`flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedExtras.includes(extra.id)
                                                        ? 'border-[#F7941D] bg-orange-50/50'
                                                        : 'border-gray-100 hover:border-gray-200'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className={`text-sm font-bold ${selectedExtras.includes(extra.id) ? 'text-[#1D1D1F]' : 'text-gray-600'}`}>
                                                            {extra.name}
                                                        </span>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedExtras.includes(extra.id)}
                                                            onChange={() => toggleExtra(extra.id)}
                                                            className="rounded text-[#F7941D] focus:ring-[#F7941D] w-4 h-4 mt-0.5"
                                                        />
                                                    </div>
                                                    <span className="text-xs font-bold text-[#F7941D]">+${extra.price}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-6 border-t border-gray-100 bg-gray-50">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-sm text-gray-500 font-medium">Total a agregar</p>
                                            <p className="text-3xl font-black text-[#1D1D1F]">
                                                ${(currentVariantPrice + currentExtrasPrice).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={addToCart}
                                        disabled={!currentSize}
                                        className="w-full py-4 bg-[#1D1D1F] text-white rounded-2xl font-bold text-lg shadow-xl shadow-gray-200 hover:shadow-2xl hover:bg-black hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3"
                                    >
                                        <span>Agregar a la orden</span>
                                        <span className="material-icons-round">add_shopping_cart</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* CART SIDEBAR - Hidden on mobile, shown on xl+ */}
            <aside className="hidden xl:flex w-[380px] 2xl:w-[420px] bg-white border-l border-gray-100 flex-col z-30 flex-shrink-0 shadow-[-10px_0_40px_rgba(0,0,0,0.02)]">
                <div className="p-8 pb-4">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black text-[#1D1D1F]">Tu Comanda</h2>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[#1D1D1F] font-bold text-xs ring-1 ring-black/5">
                            {cart.length}
                        </div>
                    </div>

                    {/* Delivery Fields - Always visible for customer orders */}
                    <div className="mt-4 p-4 bg-orange-50 rounded-xl space-y-3">
                        <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2">
                            <span className="material-icons-round text-sm">delivery_dining</span>
                            Datos para Domicilio
                        </h4>
                        <p className="text-xs text-orange-700 mb-2">
                            Completa estos datos para recibir tu pedido
                        </p>
                        <input
                            type="text"
                            placeholder="Nombre completo"
                            value={userName}
                            disabled
                            className="w-full px-3 py-2 rounded-lg border border-orange-200 bg-white text-sm font-medium text-gray-700"
                        />
                        <input
                            type="text"
                            placeholder="Dirección completa de entrega"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 text-sm"
                            required
                        />
                        <input
                            type="tel"
                            placeholder="Teléfono de contacto"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 text-sm"
                            required
                        />
                    </div>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto px-8 space-y-6 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-6">
                            <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center">
                                <span className="material-icons-round text-4xl opacity-50">shopping_bag</span>
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-gray-900 mb-1">Tu carrito está vacío</p>
                                <p className="text-sm text-gray-400">¡Agrega algo delicioso del menú!</p>
                            </div>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartItemId} className="flex gap-4 items-center group animate-in slide-in-from-right-4 duration-500">
                                <div className="w-20 h-20 rounded-2xl bg-gray-50 p-1 flex-shrink-0 relative overflow-hidden">
                                    {item.imagen_url ? (
                                        <img src={item.imagen_url} className="w-full h-full object-cover rounded-xl" alt="" />
                                    ) : (
                                        <span className="material-icons-round text-2xl text-gray-300 absolute inset-0 m-auto w-fit h-fit">fastfood</span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-[#1D1D1F] text-sm truncate pr-2">{item.name}</h4>
                                        <p className="font-bold text-[#1D1D1F] text-sm">${(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mb-1 truncate font-medium">
                                        {item.selectedSize ? `Tamaño: ${item.selectedSize}` : 'Opción estándar'}
                                    </p>
                                    {item.extras && item.extras.length > 0 && (
                                        <p className="text-[11px] text-[#F7941D] mb-3 truncate">
                                            + {item.extras.length} extras
                                        </p>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                                            <button
                                                onClick={() => item.quantity > 1 ? updateQuantity(item.cartItemId, -1) : removeFromCart(item.cartItemId)}
                                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                                            >
                                                <span className="material-icons-round text-xs">remove</span>
                                            </button>
                                            <span className="text-xs font-bold w-6 text-center text-[#1D1D1F]">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.cartItemId, 1)}
                                                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                                            >
                                                <span className="material-icons-round text-xs">add</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Totals */}
                <div className="p-8 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.03)] z-20">
                    <div className="space-y-3 mb-8">
                        <div className="flex justify-between text-sm text-gray-500 font-medium">
                            <span>Subtotal</span>
                            <span>${cartTotals.subtotal.toFixed(2)}</span>
                        </div>
                        {/* Tax removed */}
                        <div className="flex justify-between items-end pt-4 border-t border-dashed border-gray-200">
                            <span className="text-lg font-bold text-[#1D1D1F]">Total a Pagar</span>
                            <div className="text-right">
                                <span className="text-3xl font-black text-[#1D1D1F] block leading-none tracking-tight">${cartTotals.total.toFixed(2)}</span>
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Incluye impuestos</span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || isCheckoutLoading}
                        className="w-full py-4 bg-[#1D1D1F] text-white rounded-2xl font-bold text-lg shadow-xl shadow-gray-200 hover:shadow-2xl hover:bg-black hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none flex items-center justify-center gap-3"
                    >
                        {isCheckoutLoading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <span>Confirmar Pedido</span>
                                <span className="material-icons-round">arrow_forward</span>
                            </>
                        )}
                    </button>
                </div>
            </aside>

            {/* MOBILE CART MODAL - Shows on mobile/tablet */}
            {showMobileCart && (
                <div className="xl:hidden fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="absolute inset-0"
                        onClick={() => setShowMobileCart(false)}
                    />
                    <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl sm:text-2xl font-black text-[#1D1D1F]">Tu Comanda</h2>
                                <div className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-[#1D1D1F] font-bold text-xs">
                                    {cart.length}
                                </div>
                            </div>
                            <button
                                onClick={() => setShowMobileCart(false)}
                                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                            >
                                <span className="material-icons-round text-gray-600">close</span>
                            </button>
                        </div>

                        {/* Delivery Fields - Always visible in mobile */}
                        <div className="p-4 sm:p-6 border-b border-gray-100">
                            <div className="p-3 bg-orange-50 rounded-xl space-y-2">
                                <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2">
                                    <span className="material-icons-round text-sm">delivery_dining</span>
                                    Datos para Domicilio
                                </h4>
                                <p className="text-xs text-orange-700 mb-1">
                                    Completa estos datos para recibir tu pedido
                                </p>
                                <input
                                    type="text"
                                    placeholder="Nombre completo"
                                    value={userName}
                                    disabled
                                    className="w-full px-3 py-2 rounded-lg border border-orange-200 bg-white text-sm font-medium text-gray-700"
                                />
                                <input
                                    type="text"
                                    placeholder="Dirección completa de entrega"
                                    value={deliveryAddress}
                                    onChange={(e) => setDeliveryAddress(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 text-sm"
                                />
                                <input
                                    type="tel"
                                    placeholder="Teléfono de contacto"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 text-sm"
                                />
                            </div>
                        </div>

                        {/* Cart Items */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-300 py-12">
                                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                                        <span className="material-icons-round text-3xl opacity-50">shopping_bag</span>
                                    </div>
                                    <p className="font-bold text-gray-900 mb-1">Tu carrito está vacío</p>
                                    <p className="text-sm text-gray-400">¡Agrega algo delicioso!</p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <div key={item.cartItemId} className="flex gap-3 items-center">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gray-50 p-1 flex-shrink-0 overflow-hidden">
                                            {item.imagen_url ? (
                                                <img src={item.imagen_url} className="w-full h-full object-cover rounded-lg" alt="" />
                                            ) : (
                                                <span className="material-icons-round text-xl text-gray-300 flex items-center justify-center h-full">fastfood</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-sm text-[#1D1D1F] truncate">{item.name}</h4>
                                            {item.selectedSize && (
                                                <p className="text-xs text-gray-400">{item.selectedSize}</p>
                                            )}
                                            {item.extras && item.extras.length > 0 && (
                                                <p className="text-xs text-orange-600 truncate">+ {item.extras.join(', ')}</p>
                                            )}
                                            <p className="text-sm font-bold text-[#F7941D] mt-1">${item.price.toFixed(2)}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1">
                                                <button
                                                    onClick={() => updateQuantity(item.cartItemId, -1)}
                                                    className="w-6 h-6 rounded-md bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600"
                                                >
                                                    <span className="material-icons-round text-sm">remove</span>
                                                </button>
                                                <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.cartItemId, 1)}
                                                    className="w-6 h-6 rounded-md bg-white hover:bg-gray-100 flex items-center justify-center text-gray-600"
                                                >
                                                    <span className="material-icons-round text-sm">add</span>
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.cartItemId)}
                                                className="text-red-400 hover:text-red-600"
                                            >
                                                <span className="material-icons-round text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 sm:p-6 border-t border-gray-100 bg-white space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Subtotal</span>
                                    <span className="font-bold">${cartTotals.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Impuestos</span>
                                    <span className="font-bold">${cartTotals.tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                    <span className="text-base sm:text-lg font-bold text-[#1D1D1F]">Total</span>
                                    <span className="text-2xl sm:text-3xl font-black text-[#1D1D1F]">${cartTotals.total.toFixed(2)}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowMobileCart(false);
                                    handleCheckout();
                                }}
                                disabled={cart.length === 0 || isCheckoutLoading}
                                className="w-full py-3.5 sm:py-4 bg-[#1D1D1F] text-white rounded-xl sm:rounded-2xl font-bold text-base sm:text-lg shadow-xl hover:bg-black hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                            >
                                {isCheckoutLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Confirmar Pedido</span>
                                        <span className="material-icons-round">arrow_forward</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading Overlay */}
            {isProcessingOrder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex flex-col items-center justify-center p-4">
                    <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-300">
                        {/* Pizza loading animation */}
                        <div className="relative size-32">
                            <div className="absolute inset-0 border-4 border-primary/30 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-5xl animate-bounce">
                                🍕
                            </div>
                        </div>

                        <div className="text-center space-y-3">
                            <h3 className="text-3xl font-extrabold text-white tracking-tight">Procesando tu pedido</h3>
                            <p className="text-gray-300 text-xl font-medium animate-pulse">
                                {processingStep}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {showOrderSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1D1D1F]/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] p-10 shadow-2xl max-w-sm w-full text-center transform animate-in zoom-in-95 duration-300 border border-white/20">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-tr from-green-100 to-transparent"></div>
                            <span className="material-icons-round text-5xl text-green-500 relative z-10 animate-bounce">check_circle</span>
                        </div>
                        <h2 className="text-3xl font-black text-[#1D1D1F] mb-4">¡Pedido Confirmado!</h2>
                        <p className="text-gray-500 mb-4 font-medium leading-relaxed">
                            Tu pedido <span className="text-[#F7941D] font-black">#{lastOrderId}</span> ha sido registrado exitosamente.
                        </p>
                        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4 mb-3">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="material-icons-round text-green-600">check_circle</span>
                                <p className="text-sm font-black text-green-800">Enviar Pedido</p>
                            </div>
                            <p className="text-xs text-green-700 leading-relaxed mb-3">
                                Si WhatsApp no se abrió automáticamente, presiona aquí:
                            </p>
                            {whatsappLink && (
                                <a
                                    href={whatsappLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm shadow-md hover:bg-[#128C7E] transition-all flex items-center justify-center gap-2"
                                >
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WA" className="w-5 h-5 filter brightness-0 invert" />
                                    Enviar por WhatsApp para confirmar pedido
                                </a>
                            )}
                        </div>
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 mb-8">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="material-icons-round text-blue-600">local_shipping</span>
                                <p className="text-sm font-black text-blue-800">Entrega a Domicilio</p>
                            </div>
                            <p className="text-xs text-blue-700 leading-relaxed">
                                Tu pedido será entregado en: {deliveryAddress}
                            </p>
                        </div>
                        <div className="space-y-4">
                            <button
                                onClick={() => router.push('/tienda/mis-pedidos')}
                                className="w-full py-4 bg-[#1D1D1F] text-white rounded-[20px] font-black text-lg shadow-xl shadow-black/10 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3"
                            >
                                <span>Ver Mi Pedido</span>
                                <span className="material-icons-round">receipt_long</span>
                            </button>
                            <button
                                onClick={() => setShowOrderSuccess(false)}
                                className="w-full py-4 bg-gray-50 text-gray-400 rounded-[20px] font-bold text-sm hover:bg-gray-100 transition-all duration-300 uppercase tracking-widest"
                            >
                                Seguir Comprando
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
