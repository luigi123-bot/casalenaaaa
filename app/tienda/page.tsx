'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { addPointsForOrder, applyCoupon } from '@/utils/gamification';
import dynamic from 'next/dynamic';
import React, { FC, ReactNode } from 'react';
import Image from 'next/image';
import GamificationInline from '@/components/GamificationInline';

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
    const [userLevel, setUserLevel] = useState<string>('bronce');

    // UI State
    const [selectedCategory, setSelectedCategory] = useState<string | number>('Todas');
    const [pointsEarned, setPointsEarned] = useState(0);
    const [newLevel, setNewLevel] = useState<string | null>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        { id: 'extra_ingredient', name: 'Ingrediente extra', price: 20 },
        { id: 'extra_cheese', name: 'Extra queso', price: 35 },
        { id: 'extra_sauce', name: 'Aderezo extra', price: 10 },
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
            const pendingDeliveryAddress = localStorage.getItem('pendingDeliveryAddress');
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

            // Obtener nivel del usuario desde gamificación
            try {
                const response = await fetch(`/api/gamification?userId=${session.user.id}`);
                const data = await response.json();
                if (data.points) {
                    setUserLevel(data.points.current_level || 'bronce');
                }
            } catch (error) {
                console.error('Error fetching user level:', error);
            }
        }
    };

    const getLevelBadgeColor = (level: string) => {
        switch (level) {
            case 'platino': return 'text-purple-600';
            case 'oro': return 'text-yellow-600';
            case 'plata': return 'text-gray-600';
            default: return 'text-orange-600';
        }
    };

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'platino': return '💎';
            case 'oro': return '👑';
            case 'plata': return '⭐';
            default: return '🥉';
        }
    };

    const fetchCategories = async () => {
        console.log('🔄 Fetching Categories...');
        const { data, error } = await supabase
            .from('categories')
            .select('*')
            .order('id');

        console.log('📦 Categories result:', data?.length, error);
        if (error) console.error('Error categories:', error);

        if (data) {
            // Custom order mapping for consistency with cashier
            const categorySortOrder: Record<string, number> = {
                'PIZZAS TRADICIONALES': 1,
                'ESPECIALIDADES': 2,
                'GOURMET': 3,
                'ORILLAFRESCA': 4,
                'ENTRADAS Y SNACKS': 5,
                'HAMBURGUESAS': 6,
                'BEBIDAS': 7,
                'POSTRES': 8,
                'COMBOS': 9
            };

            const sortedData = [...data].sort((a, b) => {
                const orderA = categorySortOrder[a.name.toUpperCase()] || 999;
                const orderB = categorySortOrder[b.name.toUpperCase()] || 999;
                return orderA - orderB;
            });
            setCategories(sortedData);
        } else {
            setCategories([]);
        }
    };

    const fetchProducts = async () => {
        console.log('🔄 Fetching Products...');
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*, categories(name)')
                .eq('available', true) // Keep original product selection
                .order('name'); // Keep original ordering

            console.log('🍔 Products result:', data?.length, error);
            if (error) console.error('Error products:', error);

            setProducts(data || []);
        } catch (e) {
            console.error('Exception fetching products:', e);
        } finally {
            setLoading(false);
        }
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
            const sizeOrder = {
                'Chica': 1, 'Chica 12"': 1,
                'Mediana': 2,
                'Grande': 3, 'Grande 14"': 3,
                'Familiar': 4, 'Familiar 16"': 4,
                'Estándar': 0
            };
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
            const matchesCategory = selectedCategory === 'Todas' || product.category_id === selectedCategory;
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
            const whatsappNumber = '527411075056'; // Mexico format: 52 + number (Update: 741-107-5056)

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

            // 6. Agregar puntos de gamificación
            setProcessingStep('Sumando puntos de recompensa...');
            try {
                const pointsResult = await addPointsForOrder(userId, cartTotals.total, orderData.id.toString());
                if (pointsResult && pointsResult.success) {
                    setPointsEarned(pointsResult.pointsEarned || 0);
                    setNewLevel(pointsResult.newLevel);
                    console.log(`✨ ¡${pointsResult.pointsEarned} puntos ganados!`);
                }
            } catch (pointsError) {
                console.error('Error al agregar puntos:', pointsError);
                // No bloqueamos el flujo si falla la gamificación
            }

            // 7. Clear cart and show success
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
                            <h1 className={`text-lg sm:text-xl md:text-2xl font-black text-[#1D1D1F] tracking-tight truncate ${userId ? 'pl-12 xl:pl-0' : ''}`}>
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
                        <div className={`${userId ? 'hidden sm:flex' : 'flex'} items-center gap-2 md:gap-3 pl-2 sm:pl-3 md:pl-4 border-l border-gray-200 shrink-0`}>
                            {userId ? (
                                <>
                                    <button
                                        onClick={() => router.push('/tienda/gamification')}
                                        className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all whitespace-nowrap group ${getLevelBadgeColor(userLevel)}`}
                                        title="Ver mis recompensas y nivel"
                                    >
                                        <span className="text-lg group-hover:scale-110 transition-transform">{getLevelIcon(userLevel)}</span>
                                        <span className="text-xs font-bold uppercase tracking-wide">{userLevel}</span>
                                    </button>
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
                                        <p className={`text-[10px] font-bold tracking-wide uppercase ${getLevelBadgeColor(userLevel)}`}>
                                            {getLevelIcon(userLevel)} {userLevel}
                                        </p>
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
                        {categories.map((cat) => {
                            const displayNames: Record<string, string> = {
                                'PIZZAS TRADICIONALES': 'Tradicionales',
                                'ESPECIALIDADES': 'Especialidades',
                                'GOURMET': 'Gourmet',
                                'ORILLAFRESCA': 'Orilla',
                                'ENTRADAS Y SNACKS': 'Snacks',
                                'HAMBURGUESAS': 'Hamburguesas',
                                'BEBIDAS': 'Bebidas',
                                'POSTRES': 'Postres',
                                'COMBOS': 'Combos'
                            };
                            const cleanName = displayNames[cat.name.toUpperCase()] || cat.name;

                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm md:text-base font-black uppercase tracking-tight whitespace-nowrap transition-all duration-300 flex-shrink-0 ${selectedCategory === cat.id
                                        ? 'bg-[#1D1D1F] text-white shadow-xl scale-105'
                                        : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm border border-gray-100'
                                        }`}
                                >
                                    {cleanName}
                                </button>
                            )
                        })}

                        {/* Todos moved to the end */}
                        <button
                            onClick={() => setSelectedCategory('Todas')}
                            className={`px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm md:text-base font-black uppercase tracking-tight whitespace-nowrap transition-all duration-300 flex-shrink-0 ${selectedCategory === 'Todas'
                                ? 'bg-[#1D1D1F] text-white shadow-xl scale-105'
                                : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm border border-gray-100'
                                }`}
                        >
                            Todas
                        </button>
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
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                        {/* Overlay to close */}
                        <div className="absolute inset-0" onClick={() => setSelectedProduct(null)}></div>

                        <div className="relative bg-white rounded-[32px] w-full max-w-4xl max-h-[90%] shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200">
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
                            <div className="flex-1 flex flex-col min-h-0 bg-white relative">
                                <div className="p-6 sm:p-8 pb-4 flex justify-between items-center border-b border-gray-100">
                                    <h3 className="text-xl font-bold text-[#1D1D1F] md:hidden line-clamp-1">{selectedProduct.name}</h3>
                                    <span className="text-gray-400 text-xs uppercase font-bold tracking-wider hidden md:block">Personaliza tu orden</span>
                                    <button
                                        onClick={() => setSelectedProduct(null)}
                                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                                    >
                                        <span className="material-icons-round text-lg">close</span>
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar">
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
                                        <div className="flex flex-wrap gap-2 sm:gap-3">
                                            {EXTRAS_OPTIONS.map((extra) => {
                                                const isSelected = selectedExtras.includes(extra.id);
                                                return (
                                                    <button
                                                        key={extra.id}
                                                        onClick={() => toggleExtra(extra.id)}
                                                        className={`flex flex-col items-start px-4 py-3 rounded-2xl border-2 transition-all min-w-[140px] flex-1 sm:flex-none ${isSelected
                                                            ? 'border-[#F7941D] bg-[#F7941D] text-white shadow-lg shadow-orange-500/20'
                                                            : 'border-gray-100 bg-gray-50 text-gray-900 hover:border-gray-200 hover:bg-white'}`}
                                                    >
                                                        <div className="flex justify-between items-center w-full mb-1">
                                                            <span className={`text-xs font-black uppercase tracking-wider ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                                                                {extra.name}
                                                            </span>
                                                            {isSelected && (
                                                                <span className="material-icons-round text-sm animate-in zoom-in">check_circle</span>
                                                            )}
                                                        </div>
                                                        <span className={`text-[11px] font-bold ${isSelected ? 'text-white/80' : 'text-[#F7941D]'}`}>
                                                            +${extra.price}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Modal Footer */}
                                <div className="p-5 sm:p-6 border-t border-gray-100 bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none mb-1">Total a agregar</p>
                                            <p className="text-3xl font-black text-[#1D1D1F] leading-none">
                                                ${(currentVariantPrice + currentExtrasPrice).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={addToCart}
                                        disabled={!currentSize}
                                        className="w-full py-4 bg-[#1D1D1F] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-gray-200 hover:shadow-2xl hover:bg-black hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-3"
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
            <aside className="hidden xl:flex w-[400px] 2xl:w-[440px] bg-white border-l border-gray-100 flex-col z-30 flex-shrink-0 shadow-[-20px_0_60px_rgba(0,0,0,0.03)] relative overflow-hidden">
                <div className="p-8 pb-6 flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black text-[#1D1D1F] tracking-tight decoration-[#F7941D] underline decoration-4 underline-offset-4">Tu Orden</h2>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">Casaleña Store</span>
                        </div>
                        <div className="flex items-center gap-2 bg-[#F7941D]/10 px-3 py-1.5 rounded-full ring-1 ring-[#F7941D]/20 animate-pulse">
                            <span className="material-icons-round text-[#F7941D] text-sm">shopping_basket</span>
                            <span className="text-[#F7941D] font-black text-sm">{cart.length}</span>
                        </div>
                    </div>
                    <div className="p-5 bg-gray-50/50 rounded-[28px] border border-gray-100 space-y-4 shadow-inner relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#F7941D]/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110 duration-700"></div>
                        
                        <h4 className="font-extrabold text-[#1D1D1F] text-[10px] uppercase tracking-widest flex items-center gap-2 relative z-10 px-1">
                            <span className="w-6 h-6 rounded-full bg-white shadow-sm flex items-center justify-center text-[#F7941D]">
                                <span className="material-icons-round text-[14px]">location_on</span>
                            </span>
                            Detalles de Entrega
                        </h4>
                        
                        <div className="space-y-3 relative z-10">
                            <div className="relative group/input">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-sm group-focus-within/input:text-[#F7941D] transition-colors duration-300">person</span>
                                <input
                                    type="text"
                                    placeholder="Nombre"
                                    value={userName}
                                    disabled
                                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-100 bg-white/80 text-[11px] font-bold text-gray-800 disabled:opacity-75 outline-none"
                                />
                            </div>
                            <div className="relative group/input">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-sm group-focus-within/input:text-[#F7941D] transition-colors duration-300">home</span>
                                <input
                                    type="text"
                                    placeholder="¿Dónde entregamos?"
                                    value={deliveryAddress}
                                    onChange={(e) => setDeliveryAddress(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-100 focus:border-[#F7941D] focus:ring-4 focus:ring-[#F7941D]/5 outline-none text-[11px] font-medium transition-all duration-300"
                                    required
                                />
                            </div>
                            <div className="relative group/input">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-sm group-focus-within/input:text-[#F7941D] transition-colors duration-300">phone</span>
                                <input
                                    type="tel"
                                    placeholder="WhatsApp de contacto"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-100 focus:border-[#F7941D] focus:ring-4 focus:ring-[#F7941D]/5 outline-none text-[11px] font-medium transition-all duration-300"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto px-8 space-y-6 custom-scrollbar pb-8">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-6">
                            <div className="w-24 h-24 rounded-[32px] bg-gray-50 flex items-center justify-center shadow-inner">
                                <span className="material-icons-round text-4xl opacity-30 animate-pulse">shopping_bag</span>
                            </div>
                            <div className="text-center px-4">
                                <p className="font-black text-gray-900 text-lg mb-1">Tu carrito está vacío</p>
                                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">¡Explora nuestro delicioso menú y agrega tus favoritos!</p>
                            </div>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartItemId} className="flex gap-4 items-center group animate-in slide-in-from-right-4 duration-500 hover:bg-gray-50 rounded-[28px] p-2 -mx-2 transition-all duration-300">
                                <div className="w-22 h-22 rounded-2xl bg-gray-100 p-1 flex-shrink-0 relative overflow-hidden shadow-sm group-hover:shadow-md transition-all duration-500">
                                    {item.imagen_url ? (
                                        <img src={item.imagen_url} className="w-full h-full object-cover rounded-xl" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <span className="material-icons-round text-3xl">fastfood</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-black text-[#1D1D1F] text-[13px] truncate pr-2 tracking-tight uppercase leading-none">{item.name}</h4>
                                        <p className="font-black text-[#1D1D1F] text-[13px] leading-none">${(item.price * item.quantity).toFixed(2)}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {item.selectedSize && (
                                            <span className="text-[9px] px-2 py-0.5 bg-white border border-gray-100 text-gray-400 rounded-full font-bold uppercase tracking-wider">
                                                {item.selectedSize}
                                            </span>
                                        )}
                                        {item.extras && item.extras.length > 0 && (
                                            <span className="text-[9px] px-2 py-0.5 bg-orange-50 text-[#F7941D] rounded-full font-bold uppercase tracking-wider">
                                                +{item.extras.length} Extras
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl p-1 shadow-sm ring-1 ring-black/5">
                                            <button
                                                onClick={() => item.quantity > 1 ? updateQuantity(item.cartItemId, -1) : removeFromCart(item.cartItemId)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                                            >
                                                <span className="material-icons-round text-[16px]">remove</span>
                                            </button>
                                            <span className="text-xs font-black w-6 text-center text-[#1D1D1F]">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.cartItemId, 1)}
                                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                                            >
                                                <span className="material-icons-round text-[16px]">add</span>
                                            </button>
                                        </div>
                                        
                                        <button
                                            onClick={() => removeFromCart(item.cartItemId)}
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 hover:text-red-500 transition-all active:scale-90"
                                        >
                                            <span className="material-icons-round text-lg">delete_outline</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Totals */}
                <div className="p-8 bg-white border-t border-gray-100 shadow-[0_-20px_60px_rgba(0,0,0,0.05)] z-20">
                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] leading-none">
                            <span>Subtotal</span>
                            <span className="text-[#1D1D1F]">${cartTotals.subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-end pt-5 border-t border-dashed border-gray-200">
                            <div>
                                <span className="text-xs font-black text-[#1D1D1F] uppercase tracking-[0.2em] block mb-1">Total Orden</span>
                                <span className="text-[10px] font-bold text-green-500 uppercase">Envío Incluido ✓</span>
                            </div>
                            <div className="text-right">
                                <span className="text-4xl font-black text-[#1D1D1F] block leading-none tracking-tighter tabular-nums">${cartTotals.total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || isCheckoutLoading}
                        className="w-full py-5 bg-[#1D1D1F] text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-gray-200 hover:shadow-black/20 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all duration-500 disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none flex items-center justify-center gap-3 overflow-hidden relative group"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full duration-1000 transition-transform"></div>
                        {isCheckoutLoading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                <span>Confirmar Pedido</span>
                                <span className="material-icons-round text-lg">arrow_forward</span>
                            </>
                        )}
                    </button>
                </div>
            </aside>

            {/* MOBILE CART MODAL - Premium Bottom Sheet Design */}
            {showMobileCart && (
                <div className="xl:hidden fixed inset-0 z-[100] flex items-end justify-center bg-[#1D1D1F]/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div
                        className="absolute inset-0"
                        onClick={() => setShowMobileCart(false)}
                    />
                    <div className="relative w-full max-w-xl bg-[#FAFAFA] rounded-t-[48px] shadow-[0_-20px_80px_rgba(0,0,0,0.3)] max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-500 spring-bounce-400">
                        {/* Drag Handle */}
                        <div className="w-full flex justify-center pt-4 pb-2">
                            <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
                        </div>

                        {/* Header */}
                        <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white rounded-t-[48px]">
                            <div className="flex flex-col">
                                <h2 className="text-2xl font-black text-[#1D1D1F] tracking-tight leading-none mb-1">Tu Comanda</h2>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{cart.length} artículos agregados</p>
                            </div>
                            <button
                                onClick={() => setShowMobileCart(false)}
                                className="w-12 h-12 rounded-2xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center transition-all active:scale-90"
                            >
                                <span className="material-icons-round text-gray-600">close</span>
                            </button>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                           {/* Delivery Fields - Elegant Card Style (Mobile) */}
                           <div className="p-6">
                                <div className="p-6 bg-white rounded-[32px] border border-gray-100 space-y-4 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-12 -mt-12 transition-transform group-active:scale-110"></div>
                                    
                                    <h4 className="font-extrabold text-[#1D1D1F] text-[11px] uppercase tracking-widest flex items-center gap-2 mb-2 relative z-10">
                                        <span className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center text-[#F7941D]">
                                            <span className="material-icons-round text-[16px]">delivery_dining</span>
                                        </span>
                                        Dirección de Entrega
                                    </h4>
                                    
                                    <div className="space-y-3 relative z-10">
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-sm">person</span>
                                            <input
                                                type="text"
                                                placeholder="Nombre"
                                                value={userName}
                                                disabled
                                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-gray-50 bg-gray-50/50 text-[11px] font-bold text-gray-800 outline-none"
                                            />
                                        </div>
                                        <div className="relative group/input">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-sm group-focus-within/input:text-[#F7941D] transition-colors">home</span>
                                            <input
                                                type="text"
                                                placeholder="¿A dónde lo enviamos?"
                                                value={deliveryAddress}
                                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-gray-100 focus:border-[#F7941D] focus:ring-4 focus:ring-orange-500/5 bg-white text-[11px] font-medium transition-all outline-none"
                                            />
                                        </div>
                                        <div className="relative group/input">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-sm group-focus-within/input:text-[#F7941D] transition-colors">phone</span>
                                            <input
                                                type="tel"
                                                placeholder="WhatsApp de contacto"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-gray-100 focus:border-[#F7941D] focus:ring-4 focus:ring-orange-500/5 bg-white text-[11px] font-medium transition-all outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items List (Mobile) */}
                            <div className="px-6 pb-32 space-y-4">
                                {cart.length === 0 ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-gray-300">
                                        <div className="w-20 h-20 bg-white rounded-[28px] shadow-sm flex items-center justify-center mb-4">
                                            <span className="material-icons-round text-4xl opacity-20">shopping_bag</span>
                                        </div>
                                        <p className="font-black text-gray-900 uppercase tracking-widest text-[11px]">Carrito Vacío</p>
                                    </div>
                                ) : (
                                    cart.map((item) => (
                                        <div key={item.cartItemId} className="flex gap-4 items-center bg-white p-4 rounded-[32px] border border-gray-50 shadow-sm relative overflow-hidden active:scale-[0.98] transition-transform">
                                            <div className="w-20 h-20 rounded-2xl bg-gray-50 p-1 flex-shrink-0 overflow-hidden relative">
                                                {item.imagen_url ? (
                                                    <img src={item.imagen_url} className="w-full h-full object-cover rounded-xl" alt="" />
                                                ) : (
                                                    <span className="material-icons-round text-3xl text-gray-200 absolute inset-0 m-auto w-fit h-fit">fastfood</span>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-black text-[13px] text-[#1D1D1F] truncate tracking-tight uppercase mb-1">{item.name}</h4>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[9px] px-2 py-0.5 bg-gray-50 text-gray-400 rounded-full font-extrabold uppercase tracking-widest leading-none border border-gray-100">{item.selectedSize || 'Standard'}</span>
                                                    <span className="text-sm font-black text-[#1D1D1F] tabular-nums">${(item.price * item.quantity).toFixed(2)}</span>
                                                </div>
                                                
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-0.5 px-1 border border-gray-100">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartItemId, -1); }}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm text-gray-600 active:scale-90 transition-transform"
                                                        >
                                                            <span className="material-icons-round text-sm">remove</span>
                                                        </button>
                                                        <span className="text-xs font-black min-w-[20px] text-center text-[#1D1D1F]">{item.quantity}</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); updateQuantity(item.cartItemId, 1); }}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white shadow-sm text-gray-600 active:scale-90 transition-transform"
                                                        >
                                                            <span className="material-icons-round text-sm">add</span>
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); removeFromCart(item.cartItemId); }}
                                                        className="w-9 h-9 flex items-center justify-center text-gray-300 active:text-red-500 transition-colors"
                                                    >
                                                        <span className="material-icons-round text-xl">delete_outline</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Footer (Mobile Stickie) */}
                        <div className="p-8 pb-10 bg-white border-t border-gray-100 rounded-t-[48px] shadow-[0_-15px_40px_rgba(0,0,0,0.03)] space-y-6 mt-auto">
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-2 leading-none">Subtotal a Pagar</span>
                                    <span className="text-4xl font-black text-[#1D1D1F] tracking-tighter tabular-nums leading-none">${cartTotals.total.toFixed(2)}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-green-500 font-black uppercase tracking-widest bg-green-50 px-3 py-1.5 rounded-full">Envío Gratis ✓</p>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    setShowMobileCart(false);
                                    handleCheckout();
                                }}
                                disabled={cart.length === 0 || isCheckoutLoading}
                                className="w-full py-5 bg-[#1D1D1F] text-white rounded-[28px] font-black text-[14px] uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-active:translate-x-full duration-700 transition-transform"></div>
                                {isCheckoutLoading ? (
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Confirmar Pedido</span>
                                        <span className="material-icons-round text-[20px]">check_circle</span>
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
                        {pointsEarned > 0 && (
                            <div className="bg-gradient-to-r from-yellow-300 to-orange-400 p-4 rounded-xl mb-6 shadow-lg transform rotate-1 border-2 border-white/50">
                                <p className="font-bold text-white text-lg drop-shadow-sm flex items-center justify-center gap-2">
                                    <span className="material-icons-round animate-spin-slow">stars</span>
                                    ¡Ganaste {pointsEarned} Puntos!
                                </p>
                                {newLevel && <p className="text-white text-sm font-bold mt-1">¡Nuevo Nivel: {newLevel.toUpperCase()}! 🎉</p>}
                            </div>
                        )}
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            Tu pedido ha sido enviado al sistema. Serás redirigido a WhatsApp para confirmar los detalles.
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
