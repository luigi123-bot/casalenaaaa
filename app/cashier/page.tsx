'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';

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
    extras?: string[]; // Array of extra IDs
}

type OrderType = 'dine-in' | 'takeout' | 'delivery';

export default function CashierPage() {
    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Filter UI State
    const [selectedCategory, setSelectedCategory] = useState<string | number>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Customization UI State (The Modal)
    const [selectedGroupedProduct, setSelectedGroupedProduct] = useState<GroupedProduct | null>(null);
    const [currentSize, setCurrentSize] = useState<string>('');
    const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

    // Cart State
    const [cart, setCart] = useState<CartItem[]>([]);
    const [orderType, setOrderType] = useState<OrderType>('dine-in');

    // Payment State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [amountPaid, setAmountPaid] = useState('');
    const [paymentMethod, setPaymentMethod] = useState('efectivo');
    const [tableNumber, setTableNumber] = useState('');

    // Printing State
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    // Customer State (for Delivery)
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', address: '' });
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [foundCustomers, setFoundCustomers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch customers for the searchable list
    const searchCustomersList = async (term: string) => {
        if (term.length < 2) {
            setFoundCustomers([]);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
                .limit(5);

            if (error) throw error;
            setFoundCustomers(data || []);
        } catch (err) {
            console.error('Error searching customers:', err);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => searchCustomersList(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Auto-search customer by exact phone
    useEffect(() => {
        const searchCustomerByPhone = async () => {
            const phone = customerInfo.phone.trim();
            if (phone.length >= 7) {
                setIsSearchingCustomer(true);
                try {
                    const { data } = await supabase
                        .from('customers')
                        .select('full_name, address')
                        .eq('phone', phone)
                        .maybeSingle();

                    if (data) {
                        setCustomerInfo(prev => ({
                            ...prev,
                            name: prev.name || data.full_name,
                            address: prev.address || data.address
                        }));
                    }
                } catch (err) {
                    console.error('Error searching customer:', err);
                } finally {
                    setIsSearchingCustomer(false);
                }
            }
        };

        const timer = setTimeout(searchCustomerByPhone, 500);
        return () => clearTimeout(timer);
    }, [customerInfo.phone]);
    const [showCustomerModal, setShowCustomerModal] = useState(false);

    const EXTRAS_OPTIONS = [
        { id: 'extra_cheese', name: 'Extra Queso', price: 20 },
        { id: 'stuffed_crust', name: 'Orilla Rellena', price: 35 },
        { id: 'extra_sauce', name: 'Extra Salsa', price: 10 },
    ];

    const cartTotals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return {
            subtotal,
            tax: 0,
            total: subtotal
        };
    }, [cart]);

    // Derived payment values
    const paidAmount = parseFloat(amountPaid) || 0;
    const changeAmount = Math.max(0, paidAmount - cartTotals.total);
    const missingAmount = Math.max(0, cartTotals.total - paidAmount);
    const isSufficientPayment = paidAmount >= cartTotals.total;

    useEffect(() => {
        fetchCategories();
        fetchProducts();
    }, []);

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

    // Derived State: Group Products (Logic from Tienda)
    const groupedProducts = useMemo(() => {
        const groups: { [key: string]: GroupedProduct } = {};

        products.forEach(product => {
            const match = product.name.match(/^(.*?)\s*\((.*?)\)$/);
            const baseName = match ? match[1] : product.name;
            const size = match ? match[2] : 'Estándar';

            if (!groups[baseName]) {
                groups[baseName] = {
                    name: baseName,
                    description: product.description,
                    imagen_url: product.imagen_url,
                    category_id: product.category_id,
                    basePrice: product.price,
                    variants: []
                };
            }

            groups[baseName].variants.push({
                id: product.id,
                size: size,
                price: product.price,
                fullProduct: product
            });

            if (product.price < groups[baseName].basePrice) {
                groups[baseName].basePrice = product.price;
            }
        });

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
    const openProductCustomizer = (group: GroupedProduct) => {
        setSelectedGroupedProduct(group);
        // Default to first variant size
        if (group.variants.length > 0) {
            setCurrentSize(group.variants[0].size);
        }
    };

    const confirmAddToCart = () => {
        if (!selectedGroupedProduct || !currentSize) return;

        const variant = selectedGroupedProduct.variants.find(v => v.size === currentSize);
        if (!variant) return;

        const extrasCost = selectedExtras.reduce((sum, extraId) => {
            const extra = EXTRAS_OPTIONS.find(e => e.id === extraId);
            return sum + (extra ? extra.price : 0);
        }, 0);

        const newItem: CartItem = {
            ...variant.fullProduct,
            cartItemId: crypto.randomUUID(),
            quantity: 1,
            selectedSize: currentSize,
            extras: [...selectedExtras],
            price: variant.price + extrasCost
        };

        setCart(prev => [...prev, newItem]);

        // Reset and close
        setSelectedGroupedProduct(null);
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

    const clearCart = () => {
        setCart([]);
    };

    const handleGeneratePDF = async (orderData: any, items: CartItem[]) => {
        console.log('🚀 [Caja-PDF] Iniciando generación para orden folios/ID:', orderData.id);
        try {
            const payload = {
                order: {
                    ...orderData,
                    pago_con: parseFloat(amountPaid) || 0,
                    cambio: Math.max(0, (parseFloat(amountPaid) || 0) - orderData.total_amount)
                },
                items: items,
                commerce: {
                    nombre: "Casalena Pizza & Grill",
                    telefono: "741-101-1595",
                    direccion: "Blvd. Juan N Alvarez, CP 41706"
                }
            };
            console.log('📤 [Caja-PDF] Payload enviado:', payload);

            const response = await fetch('/api/print/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log('📥 [Caja-PDF] Estado de respuesta:', response.status);
            const data = await response.json();

            if (data.url) {
                console.log('✅ [Caja-PDF] URL recibida:', data.url);

                if (data.printed) {
                    // Success toast or similar
                    // alert('Ticket enviado a la impresora.'); 
                    // We can just log it or show a non-intrusive notification. 
                    // Using console for now as the SuccessModal is already shown.
                    console.log('Factura impresa automáticamente.');
                } else {
                    // Fallback: Open PDF if server couldn't print
                    window.open(data.url, '_blank');
                }
            } else {
                console.error('❌ [Caja-PDF] Error en respuesta del servidor:', data);
                alert('La orden se guardó pero falló la generación del ticket PDF profesional.');
            }
        } catch (err) {
            console.error('💥 [Caja-PDF] Error fatal:', err);
            alert('Error de conexión al generar factura PDF.');
        }
    };


    const handlePlaceOrder = async () => {
        console.log('🚀 [Cashier] Iniciar proceso de confirmación de pedido...');
        setLoading(true);
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error('Sesión expirada o inválida. Por favor reinicie sesión.');
            }

            const orderPayload = {
                user_id: user.id,
                status: 'confirmado',
                total_amount: cartTotals.total,
                tax_amount: cartTotals.tax,
                order_type: orderType,
                payment_method: paymentMethod,
                customer_name: orderType === 'delivery' ? customerInfo.name : null,
                phone_number: orderType === 'delivery' ? customerInfo.phone : null,
                delivery_address: orderType === 'delivery' ? customerInfo.address : null,
                table_number: orderType === 'dine-in' ? tableNumber : null,
            };

            console.log('📦 [Cashier] Payload de Orden:', orderPayload);

            // 1. Insert Order
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .insert(orderPayload)
                .select();

            if (orderError) {
                console.error('❌ [Cashier] Error INSERT orders:', orderError);
                throw new Error(`Error BD: ${orderError.message}`);
            }

            const createdOrder = orderData?.[0];
            if (!createdOrder) {
                console.error('❌ [Cashier] No se recibió orderData');
                throw new Error('La orden se guardó pero no pudimos confirmarla. Revisa el historial.');
            }

            console.log('✅ [Cashier] Orden creada ID:', createdOrder.id);

            // 2. Insert Items
            const orderItems = cart.map(item => ({
                order_id: createdOrder.id,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity,
                selected_size: item.selectedSize,
                extras: item.extras || null // Supabase handles objects directly for jsonb
            }));

            console.log('🛒 [Cashier] Items a insertar:', orderItems);

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) {
                console.error('❌ [Cashier] Error INSERT order_items:', itemsError);
                throw new Error(`Error en productos: ${itemsError.message}`);
            }

            console.log('🖨️ [Cashier] Orden completa. Iniciando UI de éxito...');

            // Success!
            setShowSuccessModal(true);

            // Print Ticket (PDF)
            try {
                handleGeneratePDF(createdOrder, cart);
            } catch (printErr) {
                console.error('⚠️ [Cashier] Error de impresión PDF:', printErr);
            }

            // Reset UI after delay
            setTimeout(() => {
                clearCart();
                setAmountPaid('');
                setCustomerInfo({ name: '', phone: '', address: '' });
                setTableNumber('');
                setShowSuccessModal(false);
                setShowPaymentModal(false);
                setLoading(false);
                console.log('✨ [Cashier] Flujo completado.');
            }, 3000);

        } catch (error: any) {
            console.error('🛑 [Cashier] ERROR EN PROCESO:', error);
            alert(error.message || 'Ocurrió un error inesperado al procesar la orden');
            setLoading(false);
        } finally {
            // Un-set loading if we caught early
            // Only if we haven't set the success timeout
        }
    };

    return (
        <div className="flex h-full bg-[#f8f7f5] text-[#181511]">
            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Responsive Header */}
                <header className="min-h-[80px] lg:h-20 bg-white border-b border-[#e8e5e1] flex flex-col lg:flex-row items-stretch lg:items-center px-4 sm:px-6 lg:px-8 gap-3 lg:gap-8 py-3 lg:py-0 shrink-0">
                    {/* Search Bar - Full width on mobile */}
                    <div className="flex-1 relative w-full lg:max-w-md">
                        <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#f8f7f5] border-none rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none placeholder-gray-400"
                            placeholder="Buscar pizzas, bebidas..."
                        />
                    </div>

                    {/* Categories - Horizontal scroll on all screens */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-2 px-2">
                        <button
                            onClick={() => setSelectedCategory('all')}
                            className={`flex h-10 shrink-0 items-center justify-center rounded-xl px-4 sm:px-5 transition-colors ${selectedCategory === 'all' ? 'bg-[#f7951d] text-white shadow-md' : 'bg-gray-100 text-[#181511]'}`}
                        >
                            <span className="text-sm font-semibold whitespace-nowrap">Todos</span>
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(cat.id)}
                                className={`flex h-10 shrink-0 items-center justify-center rounded-xl px-4 sm:px-5 transition-colors ${selectedCategory === cat.id ? 'bg-[#f7951d] text-white' : 'bg-gray-100'}`}
                            >
                                <span className="text-sm font-medium whitespace-nowrap">{cat.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Mobile Cart Button */}
                    <button
                        onClick={() => setShowPaymentModal(true)}
                        className="lg:hidden fixed bottom-4 right-4 z-50 w-14 h-14 bg-[#f7951d] text-white rounded-full shadow-2xl flex items-center justify-center"
                    >
                        <div className="relative">
                            <span className="material-icons-round text-2xl">shopping_cart</span>
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                    {cart.length}
                                </span>
                            )}
                        </div>
                    </button>
                </header>

                {/* Products Grid - Responsive */}
                <section className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
                    {loading && !products.length ? (
                        <div className="flex items-center justify-center h-64"><div className="w-10 h-10 border-4 border-[#f7951d] border-t-transparent rounded-full animate-spin"></div></div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5 lg:gap-6 pb-20 lg:pb-8">
                            {filteredGroupedProducts.map((group) => (
                                <div
                                    key={group.name}
                                    onClick={() => openProductCustomizer(group)}
                                    className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-[#e8e5e1] flex flex-col group hover:shadow-lg transition-all cursor-pointer"
                                >
                                    <div className="relative w-full aspect-square bg-gray-50 rounded-lg mb-3 sm:mb-4 overflow-hidden">
                                        {group.imagen_url ? <img src={group.imagen_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><span className="material-icons-round text-3xl sm:text-4xl">restaurant</span></div>}
                                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-md text-[10px] font-black shadow-sm">DESDE ${group.basePrice}</div>
                                    </div>
                                    <h3 className="font-bold text-base sm:text-lg mb-1 line-clamp-1">{group.name}</h3>
                                    <p className="text-[#8c785f] text-xs line-clamp-2 mb-3 sm:mb-4 flex-1">{group.description}</p>
                                    <button className="w-full bg-[#181511] text-white py-2 sm:py-2.5 rounded-lg text-sm font-bold active:scale-95 transition-all">Seleccionar</button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* RIGHT SIDEBAR - Hidden on mobile, shown on lg+ */}
            <aside className="hidden lg:flex w-[380px] xl:w-[400px] bg-white border-l border-[#e8e5e1] flex-col h-screen shrink-0 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-[#e8e5e1]">
                    <h2 className="text-[#181511] text-2xl font-black mb-4 tracking-tight">Comanda Actual</h2>
                    <div className="flex bg-[#f8f7f5] p-1 rounded-xl mb-4">
                        {(['dine-in', 'takeout', 'delivery'] as const).map((type) => (
                            <button key={type} onClick={() => setOrderType(type)} className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all ${orderType === type ? 'bg-white shadow-sm text-[#f7951d]' : 'text-[#8c785f]'}`}>
                                {type === 'dine-in' ? 'Comedor' : type === 'takeout' ? 'Llevar' : 'Domicilio'}
                            </button>
                        ))}
                    </div>

                    {orderType === 'dine-in' && (
                        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 animate-in fade-in slide-in-from-top-2 flex items-center justify-between mb-4">
                            <span className="text-[10px] font-black text-blue-500 uppercase">Configuración de Mesa</span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-blue-400">#</span>
                                <input
                                    type="text"
                                    placeholder="00"
                                    value={tableNumber}
                                    onChange={(e) => setTableNumber(e.target.value)}
                                    className="w-12 bg-white border border-blue-200 rounded-lg px-2 py-1 text-sm font-black text-center focus:border-blue-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {orderType === 'delivery' && (
                        <div className="bg-orange-50 rounded-xl p-4 border border-orange-100 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-black text-[#f7951d] uppercase">Datos de Entrega</span>
                                <button onClick={() => setShowCustomerModal(true)} className="text-[10px] font-black text-[#181511] hover:underline underline-offset-2">
                                    {customerInfo.name ? 'EDITAR' : 'AGREGAR+'}
                                </button>
                            </div>
                            {customerInfo.name ? (
                                <div className="space-y-1">
                                    <p className="text-sm font-bold truncate">{customerInfo.name}</p>
                                    <p className="text-[10px] text-[#8c785f] font-medium">{customerInfo.phone}</p>
                                    <p className="text-[10px] text-[#8c785f] font-medium line-clamp-1 italic">{customerInfo.address}</p>
                                </div>
                            ) : (
                                <p className="text-[10px] text-[#f7951d]/60 font-medium italic">Sin datos de cliente asignados</p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-20">
                            <span className="material-icons-round text-6xl mb-2">shopping_basket</span>
                            <p className="font-bold">Orden vacía</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartItemId} className="flex gap-3 animate-in slide-in-from-right-2 duration-200">
                                <div className="size-10 bg-orange-50 text-[#f7951d] rounded-lg flex items-center justify-center font-black shrink-0">{item.quantity}x</div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm truncate">{item.name}</p>
                                    <p className="text-[10px] text-[#8c785f] font-bold uppercase tracking-tighter">
                                        {item.selectedSize} {item.extras && item.extras.length > 0 ? `+ ${item.extras.length} extras` : ''}
                                    </p>
                                    <div className="flex gap-3 mt-1">
                                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="text-[10px] font-black text-gray-400 hover:text-red-500">QUITAR</button>
                                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="text-[10px] font-black text-gray-400 hover:text-green-600">AÑADIR</button>
                                    </div>
                                </div>
                                <p className="font-bold text-sm shrink-0">${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-6 bg-[#f8f7f5] border-t border-[#e8e5e1]">
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-[#8c785f] font-bold text-sm">TOTAL A PAGAR</span>
                        <span className="text-3xl font-black text-[#f7951d] tracking-tighter">${cartTotals.total.toFixed(2)}</span>
                    </div>
                    <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="w-full bg-[#181511] text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50">PROCESAR PAGO</button>
                </div>
            </aside>

            {/* PRODUCT CUSTOMIZATION MODAL - Responsive */}
            {selectedGroupedProduct && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[95vh] sm:max-h-[90vh]">
                        {/* Left Image - Hidden on mobile, shown on md+ */}
                        <div className="hidden md:block md:w-5/12 bg-gray-50 p-6 flex-col">
                            <img src={selectedGroupedProduct.imagen_url} className="w-full aspect-square object-cover rounded-2xl shadow-lg mb-4" alt="" />
                            <h3 className="text-2xl font-black mb-2">{selectedGroupedProduct.name}</h3>
                            <p className="text-sm text-[#8c785f] leading-relaxed flex-1">{selectedGroupedProduct.description}</p>
                        </div>

                        {/* Right Content */}
                        <div className="flex-1 md:w-7/12 p-4 sm:p-6 md:p-8 flex flex-col max-h-[95vh] sm:max-h-full">
                            {/* Mobile Header with Image */}
                            <div className="md:hidden mb-4">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-black mb-1">{selectedGroupedProduct.name}</h3>
                                        <p className="text-xs text-[#8c785f]">{selectedGroupedProduct.description}</p>
                                    </div>
                                    <button onClick={() => setSelectedGroupedProduct(null)} className="ml-2 size-8 flex items-center justify-center bg-gray-100 rounded-full shrink-0">
                                        <span className="material-icons-round text-lg">close</span>
                                    </button>
                                </div>
                                <img src={selectedGroupedProduct.imagen_url} className="w-full aspect-video object-cover rounded-xl mb-3" alt="" />
                            </div>

                            {/* Desktop Close Button */}
                            <button onClick={() => setSelectedGroupedProduct(null)} className="hidden md:block absolute top-4 right-4 size-8 flex items-center justify-center bg-gray-100 rounded-full">
                                <span className="material-icons-round text-lg">close</span>
                            </button>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto space-y-6 sm:space-y-8 pr-1 sm:pr-2 custom-scrollbar">
                                {/* Size Selection */}
                                <div>
                                    <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-3 sm:mb-4 flex items-center gap-2">
                                        <span className="size-2 bg-[#f7951d] rounded-full"></span> Tamaño
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                        {selectedGroupedProduct.variants.map(variant => (
                                            <button
                                                key={variant.id}
                                                onClick={() => setCurrentSize(variant.size)}
                                                className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${currentSize === variant.size ? 'border-[#f7951d] bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`}
                                            >
                                                <p className="font-bold text-sm">{variant.size}</p>
                                                <p className="text-[#f7951d] font-black text-sm sm:text-base">${variant.price}</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Extras Selection */}
                                <div>
                                    <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-3 sm:mb-4 flex items-center gap-2">
                                        <span className="size-2 bg-[#f7951d] rounded-full"></span> Extras
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {EXTRAS_OPTIONS.map(extra => {
                                            const isSelected = selectedExtras.includes(extra.id);
                                            return (
                                                <button
                                                    key={extra.id}
                                                    onClick={() => setSelectedExtras(prev => isSelected ? prev.filter(id => id !== extra.id) : [...prev, extra.id])}
                                                    className={`p-2.5 sm:p-3 rounded-xl border-2 flex justify-between items-center transition-all ${isSelected ? 'border-[#f7951d] bg-orange-50' : 'border-gray-100'}`}
                                                >
                                                    <span className="text-xs font-bold leading-none">{extra.name}</span>
                                                    <span className="text-[#f7951d] text-[10px] font-black">+${extra.price}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="pt-4 sm:pt-6 border-t border-gray-100 mt-4 sm:mt-6 flex flex-col gap-3 sm:gap-4">
                                <button
                                    onClick={confirmAddToCart}
                                    className="w-full bg-[#181511] text-white py-3 sm:py-4 rounded-xl font-black shadow-lg shadow-black/20 text-sm sm:text-base"
                                >
                                    Añadir a la comanda
                                </button>
                                <button onClick={() => setSelectedGroupedProduct(null)} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest">Cancelar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                    <div className="bg-[#f8f7f5] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-lg font-black uppercase tracking-tight">Cobro de Pedido</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="size-8 flex items-center justify-center bg-gray-100 rounded-full"><span className="material-icons-round">close</span></button>
                        </div>
                        <div className="p-8 text-center">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total a Pagar</p>
                            <p className="text-7xl font-black tracking-tighter text-[#181511]">${cartTotals.total.toFixed(2)}</p>
                        </div>
                        <div className="px-8 pb-8 space-y-6">
                            <div className="grid grid-cols-3 gap-2 p-1.5 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                {['efectivo', 'tarjeta', 'transferencia'].map(m => (
                                    <button key={m} onClick={() => setPaymentMethod(m)} className={`py-4 rounded-xl transition-all ${paymentMethod === m ? 'bg-[#181511] text-white shadow-xl' : 'text-gray-400 hover:bg-gray-50'}`}>
                                        <p className="text-xs font-black uppercase">{m}</p>
                                    </button>
                                ))}
                            </div>
                            {paymentMethod === 'efectivo' && (
                                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                    <div className="bg-white rounded-2xl p-6 border-2 border-gray-50 shadow-sm">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-2">
                                            {orderType === 'delivery' ? 'Monto Recibido (Opcional)' : 'Monto Recibido'}
                                        </p>
                                        <div className="flex items-center text-4xl font-black text-[#181511]">
                                            <span className="mr-2">$</span>
                                            <input type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full outline-none bg-transparent" placeholder="0.00" autoFocus />
                                        </div>
                                    </div>
                                    {isSufficientPayment && (paidAmount > 0) && (
                                        <div className="p-5 rounded-2xl flex justify-between items-center bg-green-50 text-green-700">
                                            <p className="font-black text-xs uppercase">Cambio</p>
                                            <p className="text-3xl font-black tracking-tighter">${changeAmount.toFixed(2)}</p>
                                        </div>
                                    )}
                                    {!isSufficientPayment && orderType !== 'delivery' && (
                                        <div className="p-5 rounded-2xl flex justify-between items-center bg-red-50 text-red-700">
                                            <p className="font-black text-xs uppercase">Falta recibir</p>
                                            <p className="text-3xl font-black tracking-tighter">${missingAmount.toFixed(2)}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                            <button
                                onClick={handlePlaceOrder}
                                disabled={
                                    loading ||
                                    (paymentMethod === 'efectivo' && orderType !== 'delivery' && !isSufficientPayment) ||
                                    (orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address))
                                }
                                className="w-full bg-[#f7951d] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50"
                            >
                                {loading ? 'PROCESANDO...' :
                                    (orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address)) ? 'FALTA DATOS CLIENTE' :
                                        'FINALIZAR E IMPRIMIR'}
                            </button>
                            {orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address) && (
                                <p className="text-center text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                                    Debes agregar Nombre, Teléfono y Dirección
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOMER MODAL (FOR DELIVERY) */}
            {showCustomerModal && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-8">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-black">Datos del Cliente</h3>
                                <button onClick={() => { setShowCustomerModal(false); setSearchTerm(''); setFoundCustomers([]); }} className="text-gray-400 hover:text-black">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>

                            {/* SEARCH BOX FOR EXISTING CUSTOMERS */}
                            <div className="mb-6 relative">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Buscar Cliente Existente</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-round text-gray-300 group-focus-within:text-[#f7951d]">search</span>
                                    <input
                                        type="text"
                                        placeholder="Nombre o teléfono..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-12 pr-5 py-4 text-sm font-bold focus:border-[#f7951d] outline-none transition-all"
                                    />
                                </div>

                                {foundCustomers.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[130] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                        <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                                            <p className="text-[10px] font-black text-gray-400 uppercase px-2">Resultados</p>
                                        </div>
                                        {foundCustomers.map(customer => (
                                            <button
                                                key={customer.id}
                                                onClick={() => {
                                                    setCustomerInfo({
                                                        name: customer.full_name,
                                                        phone: customer.phone,
                                                        address: customer.address || ''
                                                    });
                                                    setFoundCustomers([]);
                                                    setSearchTerm('');
                                                }}
                                                className="w-full text-left p-4 hover:bg-orange-50 transition-colors border-b border-gray-50 last:border-0"
                                            >
                                                <p className="font-bold text-sm text-[#181511]">{customer.full_name}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] bg-orange-100 text-[#f7951d] px-2 py-0.5 rounded-full font-black">{customer.phone}</span>
                                                    {customer.address && <span className="text-[10px] text-gray-400 truncate flex-1 italic">{customer.address}</span>}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="h-[2px] bg-gray-100 w-full mb-6"></div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre Completo</label>
                                    <input
                                        type="text"
                                        value={customerInfo.name}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-[#f7951d] outline-none transition-all"
                                        placeholder="Ej. Juan Pérez"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Teléfono</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={customerInfo.phone}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-[#f7951d] outline-none transition-all"
                                            placeholder="741 000 0000"
                                        />
                                        {isSearchingCustomer && (
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                                <span className="material-icons-round animate-spin text-gray-300 text-lg">sync</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Dirección de Entrega</label>
                                    <textarea
                                        rows={3}
                                        value={customerInfo.address}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:border-[#f7951d] outline-none transition-all resize-none"
                                        placeholder="Calle, número, colonia y referencias..."
                                    />
                                </div>
                            </div>
                            <div className="mt-8 flex flex-col gap-3">
                                <button
                                    onClick={() => setShowCustomerModal(false)}
                                    className="w-full bg-[#181511] text-white py-4 rounded-xl font-black shadow-lg"
                                >
                                    Guardar Datos
                                </button>
                                <button
                                    onClick={() => {
                                        setCustomerInfo({ name: '', phone: '', address: '' });
                                        setShowCustomerModal(false);
                                    }}
                                    className="text-xs font-bold text-gray-400 hover:text-red-500 py-2"
                                >
                                    Limpiar y Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {showSuccessModal && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#181511]/90 backdrop-blur-md">
                    <div className="bg-white rounded-[40px] p-12 text-center shadow-2xl transform scale-100 animate-in zoom-in-95 duration-300">
                        <div className="size-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
                            <span className="material-icons-round text-6xl text-green-500 animate-bounce">check_circle</span>
                        </div>
                        <h3 className="text-4xl font-black mb-4">¡LISTO!</h3>
                        <p className="text-gray-500 font-medium max-w-[240px] mx-auto mb-8">La orden ha sido enviada e impresa correctamente.</p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    // The ID is not easily available here without more state, but we can store it after handlePlaceOrder
                                    window.location.reload();
                                }}
                                className="w-full bg-[#181511] text-white py-4 rounded-2xl font-black"
                            >
                                NUEVA ORDEN
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
