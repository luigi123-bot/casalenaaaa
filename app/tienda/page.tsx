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

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orderType, setOrderType] = useState<OrderType>('dine-in');
    const [userId, setUserId] = useState<string | null>(null);
    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
    const [showOrderSuccess, setShowOrderSuccess] = useState(false);
    const [lastOrderId, setLastOrderId] = useState<number | null>(null);

    const EXTRAS_OPTIONS = [
        { id: 'extra_cheese', name: 'Extra Queso', price: 20 },
        { id: 'stuffed_crust', name: 'Orilla Rellena', price: 35 },
        { id: 'extra_sauce', name: 'Extra Salsa', price: 10 },
    ];

    useEffect(() => {
        fetchUserData();
        fetchCategories();
        fetchProducts();
    }, []);

    const fetchUserData = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setUserId(session.user.id);
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', session.user.id)
                .single();
            setUserName(profile?.full_name || 'Cliente');
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

    const handleCheckout = async () => {
        console.log('🔵 Iniciando envío de pedido al cajero...', {
            userId,
            customerName: userName,
            cartItems: cart,
            total: cartTotals.total,
            orderType
        });

        if (!userId || cart.length === 0) {
            console.warn('❌ Intento de checkout fallido: Faltan datos', { userId, cartLength: cart.length });
            return;
        }

        if (orderType === 'delivery' && (!deliveryAddress || !phoneNumber)) {
            alert('Por favor completa la dirección y el teléfono para el envío.');
            return;
        }

        setIsCheckoutLoading(true);

        try {
            // 1. Insert Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert({
                    user_id: userId,
                    customer_name: userName,
                    status: 'pendiente',
                    order_type: orderType,
                    total_amount: cartTotals.total,
                    delivery_address: orderType === 'delivery' ? deliveryAddress : null,
                    phone_number: phoneNumber || null
                })
                .select()
                .single();

            if (orderError) throw orderError;

            // 2. Prepared Order Items
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

            // Success
            setCart([]);
            setLastOrderId(orderData.id);
            setShowOrderSuccess(true);
            // router.push('/tienda/mis-pedidos'); // Removal of immediate redirect to show the modal

        } catch (error: any) {
            console.error('Checkout error:', error);
            alert(`Error al enviar el pedido: ${error.message || 'Error desconocido'} \n\nDetalles técnicos: ${JSON.stringify(error, null, 2)}`);
        } finally {
            setIsCheckoutLoading(false);
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

    return (
        <div className="flex h-full bg-[#FAFAFA] text-[#1D1D1F] font-sans overflow-hidden">
            {/* MAIN CONTENT - Product Grid */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] relative">
                {/* Header - Now cleaner and focused on utility */}
                <header className="h-24 px-8 flex items-center justify-between sticky top-0 z-20 bg-[#FAFAFA]/90 backdrop-blur-xl transition-all">
                    <div className="flex flex-col justify-center">
                        <h1 className="text-2xl font-black text-[#1D1D1F] tracking-tight">
                            Hola, {userName.split(' ')[0]} 👋
                        </h1>
                        <p className="text-sm text-gray-400 font-medium">¿Qué se te antoja hoy?</p>
                    </div>

                    <div className="flex items-center gap-6 flex-1 justify-end max-w-2xl">
                        {/* Enhanced Search Bar */}
                        <div className="relative w-full max-w-md group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#F7941D] transition-colors material-icons-round text-xl">search</span>
                            <input
                                type="text"
                                placeholder="Buscar tu platillo favorito..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-medium shadow-sm group-focus-within:shadow-md group-focus-within:ring-2 group-focus-within:ring-[#F7941D]/20 focus:outline-none transition-all placeholder-gray-300"
                            />
                        </div>

                        {/* User Profile Pill */}
                        <div className="flex items-center gap-3 pl-6 border-l border-gray-200">
                            <button
                                onClick={() => router.push('/tienda/mis-pedidos')}
                                className="mr-4 hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 text-[#F7941D] font-bold text-xs hover:bg-orange-100 transition-colors"
                            >
                                <span className="material-icons-round text-sm">receipt_long</span>
                                Mis Pedidos
                            </button>
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-gray-900">{userName}</p>
                                <p className="text-[10px] text-[#F7941D] font-bold tracking-wide uppercase">Cliente VIP</p>
                            </div>
                            <div className="w-11 h-11 rounded-full p-[2px] bg-gradient-to-tr from-[#F7941D] to-[#FFC107] shadow-lg shadow-orange-200">
                                <img src={`https://ui-avatars.com/api/?name=${userName}&background=fff&color=F7941D`} className="w-full h-full rounded-full border-2 border-white object-cover" alt="User" />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar scroll-smooth">
                    {/* Hero Banner */}
                    <div className="w-full h-48 rounded-[32px] bg-[#1D1D1F] text-white mb-10 relative overflow-hidden shadow-2xl group flex shrink-0">
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10"></div>
                        <img
                            src="https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=3540&auto=format&fit=crop"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            alt="Pizza Banner"
                        />
                        <div className="relative z-20 flex flex-col justify-center h-full px-12 max-w-2xl">
                            <span className="inline-block px-3 py-1 rounded-full bg-[#F7941D] w-fit text-xs font-bold mb-3 shadow-lg shadow-orange-500/30">NUEVO LANZAMIENTO</span>
                            <h2 className="text-3xl font-black mb-2 leading-tight">La Pizza Suprema <br /> <span className="text-[#F7941D]">Edición Limitada</span></h2>
                            <p className="text-gray-300 font-medium text-sm max-w-md">Disfruta de nuestra nueva creación con ingredientes seleccionados y masa madre de 48 horas.</p>
                        </div>
                    </div>

                    {/* Categories - Cleaner & Sticky */}
                    <div className="sticky top-0 z-10 bg-[#FAFAFA]/95 backdrop-blur-sm py-4 mb-4 flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 ${selectedCategory === 'all'
                                ? 'bg-[#1D1D1F] text-white shadow-lg ring-2 ring-black/5 scale-105'
                                : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm border border-gray-100'
                                }`}
                        >
                            Todos
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`px-6 py-2.5 rounded-full text-sm font-bold whitespace-nowrap transition-all duration-300 ${selectedCategory === cat.id
                                    ? 'bg-[#1D1D1F] text-white shadow-lg ring-2 ring-black/5 scale-105'
                                    : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-900 shadow-sm border border-gray-100'
                                    }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Product Grid - Grouped Cards */}
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-12 h-12 border-4 border-[#F7941D] border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 pb-20">
                            {filteredGroupedProducts.map((groupedProduct) => (
                                <div
                                    key={groupedProduct.name}
                                    onClick={() => openProductModal(groupedProduct)}
                                    className="group bg-white rounded-[24px] p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 flex flex-col hover:-translate-y-1 relative border border-transparent hover:border-gray-100 cursor-pointer"
                                >
                                    <div className="relative aspect-[4/3] mb-4 rounded-[20px] overflow-hidden bg-gray-50">
                                        {groupedProduct.imagen_url ? (
                                            <img src={groupedProduct.imagen_url} alt={groupedProduct.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50">
                                                <span className="material-icons-round text-4xl opacity-50">restaurant</span>
                                            </div>
                                        )}
                                        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm text-[#1D1D1F]">
                                            Desde ${groupedProduct.basePrice}
                                        </div>
                                    </div>

                                    <div className="px-2 pb-2 flex-1 flex flex-col">
                                        <h3 className="font-bold text-[#1D1D1F] text-lg leading-tight mb-1 group-hover:text-[#F7941D] transition-colors">{groupedProduct.name}</h3>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md">
                                                {groupedProduct.variants.length} tamaños
                                            </span>
                                        </div>

                                        <p className="text-gray-400 text-xs line-clamp-2 leading-relaxed mb-4 flex-1">
                                            {groupedProduct.description}
                                        </p>
                                        <button
                                            className="w-full py-3 rounded-xl bg-gray-50 text-[#1D1D1F] font-bold text-sm hover:bg-[#1D1D1F] hover:text-white transition-all duration-300 flex items-center justify-center gap-2 group-hover:shadow-lg"
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

            {/* CART SIDEBAR - Floating Style */}
            <aside className="w-[420px] bg-white border-l border-gray-100 flex flex-col z-30 flex-shrink-0 shadow-[-10px_0_40px_rgba(0,0,0,0.02)]">
                <div className="p-8 pb-4">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-black text-[#1D1D1F]">Tu Comanda</h2>
                        <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[#1D1D1F] font-bold text-xs ring-1 ring-black/5">
                            {cart.length}
                        </div>
                    </div>

                    {/* Modern Order Type Switcher */}
                    <div className="bg-[#F5F6F8] p-1.5 rounded-2xl flex relative isolation-auto">
                        {(['dine-in', 'takeout', 'delivery'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setOrderType(type)}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-bold capitalize transition-all duration-300 z-10 relative ${orderType === type
                                    ? 'shadow-sm text-[#1D1D1F]'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {orderType === type && (
                                    <span className="absolute inset-0 bg-white rounded-xl shadow-sm -z-10 animate-in fade-in zoom-in-95 duration-200"></span>
                                )}
                                {type.replace('-', ' ')}
                            </button>
                        ))}
                    </div>

                    {/* Delivery Fields */}
                    {orderType === 'delivery' && (
                        <div className="mt-4 p-4 bg-orange-50 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-bold text-orange-800 text-sm flex items-center gap-2">
                                <span className="material-icons-round text-sm">delivery_dining</span>
                                Datos de Envío
                            </h4>
                            <input
                                type="text"
                                placeholder="Dirección completa"
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 text-sm"
                            />
                            <input
                                type="tel"
                                placeholder="Teléfono"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-500 text-sm"
                            />
                        </div>
                    )}
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
            {showOrderSuccess && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1D1D1F]/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] p-10 shadow-2xl max-w-sm w-full text-center transform animate-in zoom-in-95 duration-300 border border-white/20">
                        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner overflow-hidden relative">
                            <div className="absolute inset-0 bg-gradient-to-tr from-green-100 to-transparent"></div>
                            <span className="material-icons-round text-5xl text-green-500 relative z-10 animate-bounce">check_circle</span>
                        </div>
                        <h2 className="text-3xl font-black text-[#1D1D1F] mb-4">¡Pedido Recibido!</h2>
                        <p className="text-gray-500 mb-10 font-medium leading-relaxed">
                            Tu orden <span className="text-[#F7941D] font-black">#{lastOrderId}</span> está siendo procesada. Te avisaremos cuando cambie su estado.
                        </p>
                        <div className="space-y-4">
                            <button
                                onClick={() => router.push('/tienda/mis-pedidos')}
                                className="w-full py-4 bg-[#1D1D1F] text-white rounded-[20px] font-black text-lg shadow-xl shadow-black/10 hover:bg-black hover:scale-[1.02] active:scale-95 transition-all duration-300 flex items-center justify-center gap-3"
                            >
                                <span>Rastrear Pedido</span>
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
