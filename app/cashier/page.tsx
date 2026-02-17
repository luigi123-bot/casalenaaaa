'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import NotificationPanel from '@/components/NotificationPanel';
import CashierSupportChat from '@/components/CashierSupportChat';
import TicketPrintModal from '@/components/TicketPrintModal';

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
    isHalfAndHalf?: boolean;
    secondHalfVariant?: {
        id: number;
        name: string;
        price: number;
    };
}

type OrderType = 'dine-in' | 'takeout' | 'delivery';

export default function CashierPage() {
    const router = useRouter();
    const { isOnline, isSyncing, pendingCount, saveOrderOffline } = useOfflineSync();
    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeBanner, setActiveBanner] = useState<any>(null);

    // Filter UI State
    const [selectedCategory, setSelectedCategory] = useState<string | number>('all');
    const [printPreviewUrl, setPrintPreviewUrl] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Customization UI State (The Modal)
    const [selectedGroupedProduct, setSelectedGroupedProduct] = useState<GroupedProduct | null>(null);
    const [currentSize, setCurrentSize] = useState<string>('');
    const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
    const [isHalfAndHalf, setIsHalfAndHalf] = useState(false);
    const [secondHalf, setSecondHalf] = useState<GroupedProduct | null>(null);

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
    const successModalRef = useRef(false); // Persist modal state across re-renders
    const [lastOrderId, setLastOrderId] = useState<string | null>(null);

    // Customer State (for Delivery)
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
        address: '',
        street: '',
        neighborhood: '',
        reference: ''
    });
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

    // UI Modals State
    const [showNotifications, setShowNotifications] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [foundCustomers, setFoundCustomers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [ticketData, setTicketData] = useState<any>(null);

    // Dropdown State
    const [availableClients, setAvailableClients] = useState<any[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
    const [cashierName, setCashierName] = useState('CAJERO');

    useEffect(() => {
        if (showCustomerModal) {
            fetchClientsForDropdown();
        }
    }, [showCustomerModal]);

    const fetchClientsForDropdown = async () => {
        setLoadingClients(true);
        try {
            console.log('🔄 [Cashier] Cargando clientes...');

            // 1. Customers Table (Ocasionales)
            const { data: customersData, error: custError } = await supabase
                .from('customers')
                .select('*')
                .order('full_name');

            if (custError) console.error('Error fetching customers:', custError);

            // 2. Profiles Table (Clientes Registrados)
            let profilesData: any[] = [];
            try {
                // Try fetching case-insensitive or multiple variations
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .in('role', ['cliente', 'CLIENTE', 'Cliente']);

                if (error) throw error;
                if (data) profilesData = data;
            } catch (e) {
                console.warn('⚠️ Error fetching profiles, trying fallback or ignoring:', e);
            }

            // 3. Usuarios Table (Legacy/Fallback)
            let usuariosData: any[] = [];
            try {
                const { data, error } = await supabase
                    .from('usuarios')
                    .select('*')
                    .in('role', ['cliente', 'CLIENTE', 'Cliente']);

                if (!error && data) {
                    // Smart Merge: If user exists in both, enrich profile with legacy data if missing
                    data.forEach(u => {
                        const existingProfileIndex = profilesData.findIndex(p => p.id === u.id);
                        if (existingProfileIndex >= 0) {
                            // User exists in both. Check if profile is missing info that legacy has.
                            const p = profilesData[existingProfileIndex];
                            const legacyPhone = u.phone || u.phone_number || u.telefono || '';
                            const legacyAddress = u.address || u.direccion || '';

                            // If profile phone is empty but legacy has one, update profile
                            if ((!p.phone_number && !p.phone && !p.celular) && legacyPhone) {
                                profilesData[existingProfileIndex].phone_merged = legacyPhone;
                            }
                            // If profile address is empty but legacy has one, update profile
                            if ((!p.address && !p.location && !p.direccion) && legacyAddress) {
                                profilesData[existingProfileIndex].address_merged = legacyAddress;
                            }
                        } else {
                            // User only in legacy table
                            usuariosData.push(u);
                        }
                    });
                }
            } catch (e) {
                console.warn('⚠️ Error fetching usuarios legacy:', e);
            }

            console.log(`📊 [Cashier] Found: ${customersData?.length || 0} customers, ${profilesData.length} profiles, ${usuariosData.length} legacy users`);

            // Combine
            const combined = [
                ...(customersData || []).map(c => ({
                    id: c.id,
                    name: c.full_name,
                    phone: c.phone,
                    address: c.address,
                    origin: 'customer' // Ocasional
                })),
                ...profilesData.map(p => ({
                    id: p.id,
                    name: p.full_name || p.nombre || 'Usuario App',
                    phone: p.phone_merged || p.phone || p.phone_number || p.phoneNumber || p.telefono || p.celular || '',
                    address: p.address_merged || p.address || p.direccion || p.location || '',
                    origin: 'profile' // Registrado
                })),
                ...usuariosData.map(u => ({
                    id: u.id,
                    name: u.full_name || u.email || 'Usuario Legado',
                    phone: u.phone || u.phone_number || u.telefono || '',
                    address: u.address || u.direccion || '',
                    origin: 'legacy' // Registrado (Tabla vieja)
                }))
            ].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            setAvailableClients(combined);
        } catch (err) {
            console.error('❌ Error general cargando clientes:', err);
        } finally {
            setLoadingClients(false);
        }
    };

    const handleClientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        const client = availableClients.find(c => String(c.id) === val);
        if (client) {
            // Attempt to split address if it's comma separated
            const parts = (client.address || '').split(',').map((p: string) => p.trim());

            setCustomerInfo({
                name: client.name || '',
                phone: client.phone || '',
                address: client.address || '',
                street: parts[0] || '',
                neighborhood: parts[1] || '',
                reference: parts.slice(2).join(', ') || ''
            });
        }
    };

    // Fetch customers for the searchable list
    const searchCustomersList = async (term: string) => {
        if (!term) {
            setFoundCustomers([]);
            return;
        }
        try {
            // 1. Search in 'customers' table (Ad-hoc customers)
            const { data: customersData, error: customersError } = await supabase
                .from('customers')
                .select('*')
                .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
                .limit(5);

            if (customersError) throw customersError;

            // 2. Search in 'profiles' table (Registered Users with role 'cliente')
            // Note: We use try-catch specifically for this query in case specific columns don't exist yet
            let profilesData: any[] = [];
            try {
                const { data, error: profilesError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'cliente')
                    .or(`full_name.ilike.%${term}%,phone_number.ilike.%${term}%`)
                    .limit(5);

                if (!profilesError) {
                    profilesData = data || [];
                } else {
                    console.warn('Error searching profiles (check if phone_number column exists):', profilesError);
                }
            } catch (e) {
                console.warn('Exception searching profiles:', e);
            }

            // 3. Map profiles to match customer structure
            const mappedProfiles = profilesData.map(p => ({
                id: p.id,
                full_name: p.full_name || 'Cliente Registrado',
                phone: p.phone_number || '',
                address: p.address || ''
            }));

            // 4. Combine results
            // Prioritize ad-hoc customers if needed, or just mix them.
            const combined = [...(customersData || []), ...mappedProfiles];

            setFoundCustomers(combined.slice(0, 10));
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
                    console.error('Error sefactuarching customer:', err);
                } finally {
                    setIsSearchingCustomer(false);
                }
            }
        };

        const timer = setTimeout(searchCustomerByPhone, 500);
        return () => clearTimeout(timer);
    }, [customerInfo.phone]);


    // Fetch Active Banner
    useEffect(() => {
        const fetchActiveBanner = async () => {
            try {
                const { data } = await supabase
                    .from('banners')
                    .select('*')
                    .eq('is_active', true)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (data) setActiveBanner(data);
            } catch (err) {
                console.error('Error fetching banner:', err);
            }
        };
        fetchActiveBanner();
    }, []);

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
        const getCashierName = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', user.id)
                        .single();

                    if (profile?.full_name) {
                        const name = profile.full_name.toUpperCase();
                        setCashierName(name);
                        localStorage.setItem('cached_cashier_name', name);
                    }
                } else {
                    const cachedName = localStorage.getItem('cached_cashier_name');
                    if (cachedName) setCashierName(cachedName);
                }
            } catch (err) {
                const cachedName = localStorage.getItem('cached_cashier_name');
                if (cachedName) setCashierName(cachedName);
            }
        };

        getCashierName();
        fetchCategories();
        fetchProducts();
    }, []);

    async function fetchCategories() {
        try {
            // Fetch only categories that actually HAVE products to avoid "empty" buttons
            const { data: prods, error: pError } = await supabase
                .from('products')
                .select('category_id')
                .eq('available', true);

            if (pError) throw pError;

            const activeCategoryIds = Array.from(new Set(prods?.map(p => p.category_id) || []));

            const { data, error: cError } = await supabase
                .from('categories')
                .select('*')
                .in('id', activeCategoryIds)
                .order('name');

            if (cError) throw cError;

            if (data) {
                setCategories(data);
                // Cache locally
                localStorage.setItem('cached_categories', JSON.stringify(data));
            }
        } catch (err) {
            console.warn('⚠️ [Cashier] Error fetching categories, using cache:', err);
            const cached = localStorage.getItem('cached_categories');
            if (cached) setCategories(JSON.parse(cached));
        }
    };

    async function fetchProducts() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*, categories(name)')
                .eq('available', true)
                .order('name');

            if (error) throw error;

            if (data) {
                setProducts(data);
                // Cache locally
                localStorage.setItem('cached_products', JSON.stringify(data));
            }
        } catch (err) {
            console.warn('⚠️ [Cashier] Error fetching products, using cache:', err);
            const cached = localStorage.getItem('cached_products');
            if (cached) setProducts(JSON.parse(cached));
        } finally {
            setLoading(false);
        }
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
            const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
            const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [groupedProducts, selectedCategory, searchQuery]);

    const handleBannerClick = () => {
        if (!activeBanner?.product_id) return;

        const targetProduct = products.find(p => p.id === activeBanner.product_id);
        if (!targetProduct) return;

        const match = targetProduct.name.match(/^(.*?)\s*\((.*?)\)$/);
        const baseName = match ? match[1] : targetProduct.name;
        const targetSize = match ? match[2] : '';

        const group = groupedProducts.find(g => g.name === baseName);
        if (group) {
            setSelectedGroupedProduct(group);
            if (targetSize) setCurrentSize(targetSize);
            else if (group.variants.length > 0) setCurrentSize(group.variants[0].size);
        }
    };

    // Cart Logic
    const openProductCustomizer = (group: GroupedProduct, editItem?: CartItem) => {
        setSelectedGroupedProduct(group);

        if (editItem) {
            setEditingCartItemId(editItem.cartItemId);
            setCurrentSize(editItem.selectedSize || (group.variants.length > 0 ? group.variants[0].size : ''));
            setSelectedExtras(editItem.extras || []);
            setIsHalfAndHalf(editItem.isHalfAndHalf || false);

            if (editItem.isHalfAndHalf && editItem.secondHalfVariant) {
                const secondHalfGroup = groupedProducts.find(g => g.name === editItem.secondHalfVariant?.name);
                setSecondHalf(secondHalfGroup || null);
            } else {
                setSecondHalf(null);
            }
        } else {
            setEditingCartItemId(null);
            setIsHalfAndHalf(false);
            setSecondHalf(null);
            setSelectedExtras([]);
            // Default to first variant size
            if (group.variants.length > 0) {
                setCurrentSize(group.variants[0].size);
            }
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

        let finalPrice = variant.price;
        let finalName = variant.fullProduct.name;
        let secondHalfData = undefined;

        // Handle Half & Half
        if (isHalfAndHalf && secondHalf) {
            const variant2 = secondHalf.variants.find(v => v.size === currentSize);
            if (!variant2) {
                // Should be prevented by UI but just in case
                console.warn('La segunda mitad no tiene el mismo tamaño disponible');
                return;
            }
            // Logic: Average price
            finalPrice = Math.max(variant.price, variant2.price);
            finalName = `½ ${selectedGroupedProduct.name} / ½ ${secondHalf.name} (${currentSize})`;

            secondHalfData = {
                id: variant2.id, // Store ID of second variant
                name: secondHalf.name,
                price: variant2.price
            };
        }

        if (editingCartItemId) {
            // Update existing item
            setCart(prev => prev.map(item => {
                if (item.cartItemId === editingCartItemId) {
                    return {
                        ...item,
                        name: finalName,
                        price: finalPrice + extrasCost,
                        selectedSize: currentSize,
                        extras: [...selectedExtras],
                        isHalfAndHalf: isHalfAndHalf,
                        secondHalfVariant: secondHalfData
                    };
                }
                return item;
            }));
        } else {
            // Add new item
            const newItem: CartItem = {
                ...variant.fullProduct,
                name: finalName, // Override Name
                price: finalPrice + extrasCost, // Override Price
                cartItemId: crypto.randomUUID(),
                quantity: 1,
                selectedSize: currentSize,
                extras: [...selectedExtras],
                isHalfAndHalf: isHalfAndHalf,
                secondHalfVariant: secondHalfData
            };

            setCart(prev => [...prev, newItem]);
        }

        // Reset and close
        setSelectedGroupedProduct(null);
        setEditingCartItemId(null); // Added this
        setCurrentSize('');
        setSelectedExtras([]);
        setIsHalfAndHalf(false);
        setSecondHalf(null);
    };

    const removeFromCart = (cartItemId: string) => {
        setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    };

    const updateQuantity = (cartItemId: string, delta: number) => {
        setCart(prev => {
            const updated = prev.map(item => {
                if (item.cartItemId === cartItemId) {
                    const newQty = item.quantity + delta;
                    if (newQty <= 0) return null;
                    return { ...item, quantity: newQty };
                }
                return item;
            });
            return updated.filter((item): item is CartItem => item !== null);
        });
    };

    const clearCart = () => {
        setCart([]);
    };

    const handleOpenTicketModal = (orderData: any, items: CartItem[]) => {
        console.log('🚀 [Caja] Abriendo modal de ticket para orden:', orderData.id);

        const data = {
            atendido_por: cashierName,
            comercio: {
                nombre: "Casalena Pizza & Grill",
                telefono: "741-101-1595",
                direccion: "Blvd. Juan N Alvarez, CP 41706"
            },
            pedido: {
                id: orderData.id ? orderData.id.toString() : 'NO-ID',
                tipo: orderData.order_type || 'Comedor',
                mesa: orderData.table_number || '',
                subtotal: orderData.subtotal || orderData.total_amount,
                total: orderData.total_amount,
                metodo_pago: orderData.payment_method || 'Efectivo',
                pago_con: parseFloat(amountPaid) || 0,
                cambio: Math.max(0, (parseFloat(amountPaid) || 0) - orderData.total_amount),
            },
            productos: items.map(it => {
                // Map extra IDs to names
                const extrasNames = it.extras?.map(extraId => {
                    const extra = EXTRAS_OPTIONS.find(e => e.id === extraId);
                    return extra ? extra.name : extraId;
                }).filter(Boolean) || [];

                return {
                    cantidad: it.quantity,
                    nombre: it.name,
                    precio: it.price,
                    detalle: it.selectedSize || '',
                    extras: extrasNames.length > 0 ? extrasNames : undefined
                };
            }),
            cliente: orderData.order_type === 'delivery' ? {
                nombre: orderData.customer_name || 'Cliente Genérico',
                telefono: orderData.phone_number || 'S/N',
                direccion: orderData.delivery_address || 'Sin dirección'
            } : undefined
        };

        setTicketData(data);
        setShowTicketModal(true);
    };


    const handlePlaceOrder = async () => {
        if (orderType === 'dine-in' && !tableNumber.trim()) {
            alert('⚠️ POR FAVOR INGRESA EL NÚMERO DE MESA.');
            return;
        }

        console.log('🚀 [Cashier] Iniciar proceso de confirmación de pedido...');
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            const userId = user?.id || 'offline-placeholder'; // Fallback if totally offline

            const orderPayload = {
                user_id: userId,
                status: 'confirmado',
                total_amount: cartTotals.total,
                tax_amount: cartTotals.tax,
                order_type: orderType,
                payment_method: paymentMethod,
                customer_name: orderType === 'delivery' ? customerInfo.name : null,
                phone_number: orderType === 'delivery' ? customerInfo.phone : null,
                delivery_address: orderType === 'delivery' ? customerInfo.address : null,
                table_number: orderType === 'dine-in' ? tableNumber : null,
                created_at: new Date().toISOString()
            };

            const orderItemsPayload = cart.map(item => {
                const extrasData: any[] = [...(item.extras || [])];
                if (item.isHalfAndHalf && item.secondHalfVariant) {
                    extrasData.push({
                        type: 'half_and_half',
                        second_half_id: item.secondHalfVariant.id,
                        second_half_name: item.secondHalfVariant.name,
                        second_half_price: item.secondHalfVariant.price
                    });
                }

                return {
                    product_id: item.id,
                    product_name: item.name,
                    quantity: item.quantity,
                    unit_price: item.price,
                    total_price: item.price * item.quantity,
                    selected_size: item.selectedSize,
                    extras: extrasData.length > 0 ? extrasData : null
                };
            });

            // --- LÓGICA DE PERSISTENCIA (ONLINE vs OFFLINE) ---
            let createdOrder = null;

            if (isOnline) {
                try {
                    // Try real-time save
                    const { data: orderData, error: orderError } = await supabase
                        .from('orders')
                        .insert(orderPayload)
                        .select()
                        .single();

                    if (orderError) throw orderError;

                    const itemsWithOrderId = orderItemsPayload.map(it => ({ ...it, order_id: orderData.id }));
                    const { error: itemsError } = await supabase.from('order_items').insert(itemsWithOrderId);

                    if (itemsError) throw itemsError;

                    createdOrder = orderData;
                } catch (netErr) {
                    console.error('⚠️ [Cashier] Falló guardado en la nube, guardando localmente...', netErr);
                    const localId = saveOrderOffline(orderPayload, orderItemsPayload);
                    createdOrder = { ...orderPayload, id: localId, is_offline: true };
                }
            } else {
                // Device is recognized as offline
                const localId = saveOrderOffline(orderPayload, orderItemsPayload);
                createdOrder = { ...orderPayload, id: localId, is_offline: true };
            }

            // --- UI SUCCESS FLOW ---
            if (createdOrder) {
                setLastOrderId(createdOrder.id);
                setShowSuccessModal(true);
                successModalRef.current = true;

                // Open Ticket Modal
                try {
                    handleOpenTicketModal(createdOrder, cart);
                } catch (printErr) {
                    console.error('⚠️ [Cashier] Error abriendo modal de ticket:', printErr);
                }
            }

            setLoading(false);

        } catch (error: any) {
            console.error('🛑 [Cashier] ERROR EN PROCESO:', error);
            alert(error.message || 'Ocurrió un error inesperado al procesar la orden');
            setLoading(false);
        }
    };

    const handleCancelOrder = async () => {
        if (!lastOrderId) return;

        setLoading(true);
        try {
            console.log(`🛑 [Cashier] Cancelando pedido ID: ${lastOrderId}...`);

            // Delete order items first (if no cascade)
            await supabase.from('order_items').delete().eq('order_id', lastOrderId);

            // Delete the order
            const { error } = await supabase
                .from('orders')
                .delete()
                .eq('id', lastOrderId);

            if (error) throw error;

            // Success reset
            setShowSuccessModal(false);
            successModalRef.current = false;
            setShowTicketModal(false);
            setLastOrderId(null);

            console.log('✅ [Cashier] Pedido cancelado correctamente de la BD.');
        } catch (err: any) {
            console.error('❌ [Cashier] Error al cancelar:', err);
            alert('No se pudo cancelar el pedido de la base de datos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        } finally {
            window.location.href = '/login';
        }
    };

    return (
        <div className="flex h-full bg-[#f8f7f5] text-[#181511]">
            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Responsive Header */}
                <header className="min-h-[60px] lg:h-16 bg-white border-b border-[#e8e5e1] flex flex-col lg:flex-row items-stretch lg:items-center px-4 sm:px-6 lg:px-8 gap-3 lg:gap-8 py-2 lg:py-0 shrink-0">
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

                    {/* Notification and Chat Buttons */}
                    <div className="hidden lg:flex gap-2">
                        <button
                            onClick={() => setShowNotifications(true)}
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-orange-50 hover:text-[#F7941D] text-[#8c785f] transition-colors relative"
                            title="Notificaciones"
                        >
                            <span className="material-icons-round">notifications</span>
                        </button>

                        <button
                            onClick={() => setShowChat(true)}
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-purple-50 hover:text-purple-600 text-[#8c785f] transition-colors"
                            title="Chat Soporte"
                        >
                            <span className="material-icons-round">support_agent</span>
                        </button>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-500 text-[#8c785f] transition-colors"
                        title="Cerrar Sesión"
                    >
                        <span className="material-icons-round">logout</span>
                    </button>

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

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden bg-[#f8f7f5]">
                    {/* Products Section - No Horizontal Scroll */}
                    <section className="flex-1 p-3 lg:p-4 overflow-hidden flex flex-col">

                        {/* Categories Selection - Full Width Grid at the top to avoid scroll */}
                        <div className="mb-3 shrink-0">
                            <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-1 lg:gap-1.5">
                                <button
                                    onClick={() => setSelectedCategory('all')}
                                    className={`flex flex-col lg:flex-row items-center justify-center gap-1 rounded-lg py-1.5 px-1 transition-all border ${selectedCategory === 'all'
                                        ? 'bg-[#f7951d] border-[#f7951d] text-white shadow-sm'
                                        : 'bg-white border-gray-100 text-[#8c785f] hover:bg-gray-50'
                                        }`}
                                >
                                    <span className="material-icons-round text-sm">apps</span>
                                    <span className="text-[8px] lg:text-[10px] font-black uppercase tracking-tighter text-center">Todas</span>
                                </button>

                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`flex flex-col lg:flex-row items-center justify-center gap-1 rounded-lg py-1.5 px-0.5 lg:px-2 transition-all border ${selectedCategory === cat.id
                                            ? 'bg-[#f7951d] border-[#f7951d] text-white shadow-sm'
                                            : 'bg-white border-gray-100 text-[#8c785f] hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="material-icons-round text-sm">
                                            {cat.name.toLowerCase().includes('pizza') ? 'local_pizza' :
                                                cat.name.toLowerCase().includes('especialidades') ? 'local_pizza' :
                                                    cat.name.toLowerCase().includes('gourmet') ? 'local_pizza' :
                                                        cat.name.toLowerCase().includes('combo') ? 'loyalty' :
                                                            cat.name.toLowerCase().includes('orilla') ? 'add_circle' :
                                                                cat.name === 'Bebidas' ? 'local_drink' :
                                                                    cat.name === 'Hamburguesas' ? 'lunch_dining' :
                                                                        cat.name === 'Postres' ? 'cake' :
                                                                            cat.name === 'Entradas y snacks' ? 'fastfood' :
                                                                                'restaurant'}
                                        </span>
                                        <span className="text-[8px] lg:text-[9px] xl:text-[10px] font-black uppercase tracking-tighter text-center leading-[1] truncate w-full">
                                            {cat.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Banner - Extra Compact */}
                        {activeBanner && (
                            <div
                                onClick={handleBannerClick}
                                className="hidden 2xl:flex mb-3 rounded-xl overflow-hidden relative h-20 shrink-0 bg-[#1D1D1F] text-white shadow-sm group cursor-pointer"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/20 to-transparent z-10"></div>
                                <img
                                    src={activeBanner.image_url}
                                    alt={activeBanner.title}
                                    className="absolute inset-0 w-full h-full object-cover"
                                />
                                <div className="relative z-20 flex flex-col justify-center px-6">
                                    <h3 className="text-xl font-black mb-0.5">{activeBanner.title}</h3>
                                    <p className="text-xs text-white/70 font-medium line-clamp-1">{activeBanner.description}</p>
                                </div>
                            </div>
                        )}

                        {/* Products Grid - Maximum Density */}
                        <div className="flex-1 overflow-y-auto scrollbar-hide">
                            {loading ? (
                                <div className="flex items-center justify-center h-full">
                                    <div className="w-8 h-8 border-3 border-[#f7951d] border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            ) : (
                                <div className="space-y-6 pb-4">
                                    {categories
                                        .filter(cat => filteredGroupedProducts.some(p => p.category_id === cat.id))
                                        .map(category => {
                                            const categoryProducts = filteredGroupedProducts.filter(p => p.category_id === category.id);

                                            return (
                                                <div key={category.id} className="space-y-3">
                                                    {/* Category Header - Compact */}
                                                    <div className="sticky top-0 z-10 bg-gradient-to-r from-[#f8f7f5]/95 to-[#f8f7f5]/80 backdrop-blur-md py-1.5 flex items-center gap-2">
                                                        <div className="h-4 w-1 bg-[#f7951d] rounded-full"></div>
                                                        <h2 className="text-xs font-black text-[#181511] uppercase tracking-wider">
                                                            {category.name}
                                                        </h2>
                                                        <div className="flex-1 h-px bg-gray-200"></div>
                                                        <span className="text-[9px] font-bold text-gray-400">
                                                            {categoryProducts.length} items
                                                        </span>
                                                    </div>

                                                    {/* Grid with 8 columns on large screens */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
                                                        {categoryProducts.map((group) => (
                                                            <div
                                                                key={group.name}
                                                                onClick={() => openProductCustomizer(group)}
                                                                className="bg-white p-2 rounded-xl border border-gray-100 flex flex-col group hover:border-[#f7951d] transition-all cursor-pointer relative"
                                                            >
                                                                {/* Compact Image */}
                                                                <div className="relative w-full aspect-square bg-[#F2F2F7] rounded-lg mb-1.5 overflow-hidden">
                                                                    <img
                                                                        src="/icon.png"
                                                                        className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform duration-300"
                                                                        alt={group.name}
                                                                    />
                                                                    <div className="absolute bottom-1 right-1 bg-white/95 px-1 py-0.5 rounded text-[10px] font-black shadow-sm text-[#181511]">
                                                                        ${group.basePrice}
                                                                    </div>
                                                                </div>

                                                                {/* Compact Content */}
                                                                <div className="flex flex-col gap-0.5">
                                                                    <h3 className="font-bold text-[10px] text-[#1D1D1F] leading-tight line-clamp-2 h-7">
                                                                        {group.name}
                                                                    </h3>
                                                                    {group.variants.length > 1 && (
                                                                        <div className="flex items-center gap-1 text-[#f7951d]">
                                                                            <span className="material-icons-round text-[10px]">expand_more</span>
                                                                            <span className="text-[8px] font-bold uppercase">{group.variants.length} Tam.</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                    {filteredGroupedProducts.length === 0 && (
                                        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                            <span className="material-icons-round text-6xl mb-4 opacity-20">search_off</span>
                                            <p className="font-bold">No se encontraron productos</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </main>

            {/* RIGHT SIDEBAR - Hidden on mobile, shown on lg+ */}
            <aside className="hidden lg:flex w-[380px] xl:w-[400px] bg-white border-l border-[#e8e5e1] flex-col h-screen shrink-0 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-[#e8e5e1]">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-[#181511] text-2xl font-black tracking-tight">Comanda Actual</h2>

                        {/* Offline / Sync Indicators */}
                        <div className="flex items-center gap-2">
                            {isSyncing && (
                                <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-full animate-pulse">
                                    <span className="material-icons-round text-sm animate-spin">sync</span>
                                    <span className="text-[10px] font-black uppercase">Sincronizando...</span>
                                </div>
                            )}

                            {!isOnline && (
                                <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded-full border border-red-100">
                                    <span className="material-icons-round text-sm">cloud_off</span>
                                    <span className="text-[10px] font-black uppercase">Offline</span>
                                </div>
                            )}

                            {pendingCount > 0 && !isSyncing && (
                                <div className="flex items-center gap-1 bg-orange-50 text-[#f7951d] px-2 py-1 rounded-full border border-orange-100">
                                    <span className="material-icons-round text-sm">schedule</span>
                                    <span className="text-[10px] font-black uppercase">{pendingCount} Pendientes</span>
                                </div>
                            )}
                        </div>
                    </div>
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
                                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="text-[10px] font-black text-red-500 hover:underline">QUITAR</button>
                                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="text-[10px] font-black text-green-600 hover:underline">AÑADIR</button>
                                        <button
                                            onClick={() => {
                                                const group = groupedProducts.find(g => g.name === item.name || item.name.includes(g.name));
                                                if (group) openProductCustomizer(group, item);
                                            }}
                                            className="text-[10px] font-black text-blue-500 hover:underline"
                                        >
                                            EDITAR
                                        </button>
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
            {
                selectedGroupedProduct && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[95vh] sm:max-h-[90vh]">
                            {/* Left Image - Hidden on mobile, shown on md+ */}
                            <div className="hidden md:block md:w-5/12 bg-gray-50 p-6 flex-col relative">
                                {isHalfAndHalf && secondHalf ? (
                                    <div className="absolute inset-0 flex">
                                        <div className="w-1/2 h-full overflow-hidden relative">
                                            <img src={selectedGroupedProduct.imagen_url} className="w-full h-full object-cover" alt="" />
                                            <div className="absolute inset-0 bg-black/10"></div>
                                        </div>
                                        <div className="w-1/2 h-full overflow-hidden relative">
                                            <img src={secondHalf.imagen_url} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-black shadow-lg border border-gray-100">½ & ½</div>
                                        </div>
                                    </div>
                                ) : (
                                    <img src={selectedGroupedProduct.imagen_url} className="w-full aspect-square object-cover rounded-2xl shadow-lg mb-4" alt="" />
                                )}
                                <div className="relative z-10 mt-auto">
                                    <h3 className="text-2xl font-black mb-2 leading-tight">
                                        {isHalfAndHalf && secondHalf ? (
                                            <span>
                                                <span className="text-gray-400">½</span> {selectedGroupedProduct.name} <br />
                                                <span className="text-gray-400">½</span> {secondHalf.name}
                                            </span>
                                        ) : selectedGroupedProduct.name}
                                    </h3>
                                    <p className="text-sm text-[#8c785f] leading-relaxed line-clamp-3">
                                        {isHalfAndHalf && secondHalf
                                            ? 'Combinación de dos especialidades.'
                                            : selectedGroupedProduct.description}
                                    </p>
                                </div>
                            </div>

                            {/* Right Content */}
                            <div className="flex-1 md:w-7/12 p-4 sm:p-6 md:p-8 flex flex-col max-h-[95vh] sm:max-h-full">
                                {/* Mobile Header with Image */}
                                <div className="md:hidden mb-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-black mb-1">
                                                {isHalfAndHalf && secondHalf ? `½ ${selectedGroupedProduct.name} / ½ ${secondHalf.name}` : selectedGroupedProduct.name}
                                            </h3>
                                            <p className="text-xs text-[#8c785f] line-clamp-2">{selectedGroupedProduct.description}</p>
                                        </div>
                                        <button onClick={() => { setSelectedGroupedProduct(null); setIsHalfAndHalf(false); setSecondHalf(null); }} className="ml-2 size-8 flex items-center justify-center bg-gray-100 rounded-full shrink-0">
                                            <span className="material-icons-round text-lg">close</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Desktop Close Button */}
                                <button onClick={() => { setSelectedGroupedProduct(null); setIsHalfAndHalf(false); setSecondHalf(null); }} className="hidden md:block absolute top-4 right-4 size-8 flex items-center justify-center bg-gray-100 rounded-full z-20 hover:bg-red-50 hover:text-red-500 transition-colors">
                                    <span className="material-icons-round text-lg">close</span>
                                </button>

                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-y-auto space-y-6 sm:space-y-8 pr-1 sm:pr-2 custom-scrollbar">

                                    {/* Half & Half Toggle */}
                                    {(() => {
                                        // Helper to check if Pizza
                                        const catName = products.find(p => p.category_id === selectedGroupedProduct.category_id)?.categories?.name;
                                        const isPizza = catName?.toLowerCase().includes('pizza') ||
                                            catName?.toLowerCase().includes('especialidades') ||
                                            catName?.toLowerCase().includes('gourmet');

                                        if (isPizza) {
                                            return (
                                                <div className="bg-[#f8f7f5] p-3 rounded-xl border border-[#e8e5e1]">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-black text-sm text-[#181511]">🍕 ¿Armar Mitad y Mitad?</span>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" checked={isHalfAndHalf} onChange={(e) => {
                                                                setIsHalfAndHalf(e.target.checked);
                                                                if (!e.target.checked) setSecondHalf(null);
                                                            }} />
                                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#f7951d]"></div>
                                                        </label>
                                                    </div>

                                                    {isHalfAndHalf && (
                                                        <div className="animate-in fade-in slide-in-from-top-1 mt-2">
                                                            <label className="block text-xs font-bold text-gray-500 mb-1">Selecciona la segunda mitad:</label>
                                                            <select
                                                                className="w-full bg-white border border-gray-200 rounded-lg p-2 text-sm font-bold outline-none focus:border-[#f7951d]"
                                                                onChange={(e) => {
                                                                    const group = groupedProducts.find(g => g.name === e.target.value);
                                                                    setSecondHalf(group || null);
                                                                }}
                                                                value={secondHalf?.name || ''}
                                                            >
                                                                <option value="" disabled>-- Elegir Sabor --</option>
                                                                {groupedProducts
                                                                    .filter(g => {
                                                                        const gCat = g.variants[0]?.fullProduct?.categories?.name?.toLowerCase() || '';
                                                                        const isGPizza = gCat.includes('pizza') || gCat.includes('especialidades') || gCat.includes('gourmet');
                                                                        return isGPizza &&
                                                                            g.name !== selectedGroupedProduct.name &&
                                                                            g.variants.some(v => v.size === currentSize);
                                                                    })
                                                                    .map(g => (
                                                                        <option key={g.name} value={g.name}>{g.name}</option>
                                                                    ))
                                                                }
                                                            </select>
                                                            <p className="text-[9px] font-bold text-[#f7951d] mt-1.5 uppercase">
                                                                * Se cobra la mitad más cara
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Size Selection */}
                                    <div>
                                        <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-3 sm:mb-4 flex items-center gap-2">
                                            <span className="size-2 bg-[#f7951d] rounded-full"></span> Tamaño
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                            {selectedGroupedProduct.variants.map(variant => {
                                                // Calculate price for display
                                                let displayPrice = variant.price;
                                                if (isHalfAndHalf && secondHalf) {
                                                    const secondVariant = secondHalf.variants.find(v => v.size === variant.size);
                                                    if (secondVariant) {
                                                        displayPrice = Math.max(variant.price, secondVariant.price);
                                                    }
                                                }

                                                return (
                                                    <button
                                                        key={variant.id}
                                                        onClick={() => setCurrentSize(variant.size)}
                                                        className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all ${currentSize === variant.size ? 'border-[#f7951d] bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`}
                                                    >
                                                        <p className="font-bold text-sm">{variant.size}</p>
                                                        <p className="text-[#f7951d] font-black text-sm sm:text-base">${displayPrice.toFixed(2)}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {isHalfAndHalf && secondHalf && !secondHalf.variants.find(v => v.size === currentSize) && (
                                            <p className="text-[10px] text-red-500 font-bold mt-2">⚠️ {secondHalf.name} no está disponible en tamaño {currentSize}.</p>
                                        )}
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
                                        disabled={isHalfAndHalf && (!secondHalf || (secondHalf && !secondHalf.variants.find(v => v.size === currentSize)))}
                                        className="w-full bg-[#181511] text-white py-3 sm:py-4 rounded-xl font-black shadow-lg shadow-black/20 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isHalfAndHalf ? (secondHalf ? 'Añadir Combinación' : 'Selecciona 2da Mitad') : 'Añadir a la comanda'}
                                    </button>
                                    <button onClick={() => { setSelectedGroupedProduct(null); setIsHalfAndHalf(false); setSecondHalf(null); }} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest">Cancelar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Payment Modal */}
            {
                showPaymentModal && (
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
                                {orderType === 'dine-in' && (
                                    <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex justify-between items-center">
                                        <span className="text-xs font-black text-blue-500 uppercase">Número de Mesa</span>
                                        <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-blue-200">
                                            <span className="text-sm font-bold text-blue-400">#</span>
                                            <input
                                                type="text"
                                                placeholder="00"
                                                value={tableNumber}
                                                onChange={(e) => setTableNumber(e.target.value)}
                                                className="w-12 text-center font-black text-[#181511] outline-none"
                                            />
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === 'efectivo' && (
                                    <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="bg-white rounded-2xl p-4 border-2 border-gray-200 shadow-sm focus-within:border-[#F7941D] transition-colors relative">
                                            <p className="text-[10px] font-black text-gray-400 uppercase mb-1 absolute top-2 left-4">
                                                {orderType === 'delivery' ? 'Monto Recibido (Opcional)' : 'Monto Recibido'}
                                            </p>
                                            <div className="flex items-center text-4xl font-black text-[#181511] mt-4">
                                                <span className="mr-2 text-gray-300">$</span>
                                                <input
                                                    type="number"
                                                    value={amountPaid}
                                                    onChange={(e) => setAmountPaid(e.target.value)}
                                                    className="w-full outline-none bg-transparent placeholder-gray-200"
                                                    placeholder="0.00"
                                                />
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
                                        (orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address)) ||
                                        (orderType === 'dine-in' && !tableNumber.trim())
                                    }
                                    className="w-full bg-[#f7951d] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {loading ? 'PROCESANDO...' :
                                        (orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address)) ? 'FALTA DATOS CLIENTE' :
                                            (orderType === 'dine-in' && !tableNumber.trim()) ? 'FALTA MESA' :
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
                )
            }

            {/* CUSTOMER MODAL (FOR DELIVERY) */}
            {
                showCustomerModal && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
                        <div className="bg-white rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col md:flex-row border border-white/20">

                            {/* LEFT SIDE: DATA ENTRY */}
                            <div className="flex-1 p-6 lg:p-10">
                                <div className="flex justify-between items-center mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 bg-[#f7951d] rounded-xl flex items-center justify-center shadow-lg shadow-[#f7951d]/20 text-white">
                                            <span className="material-icons-round">local_shipping</span>
                                        </div>
                                        <h3 className="text-2xl font-black text-[#181511] tracking-tight">Datos para Envío</h3>
                                    </div>
                                    <button onClick={() => { setShowCustomerModal(false); setSearchTerm(''); setFoundCustomers([]); }} className="size-10 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                                        <span className="material-icons-round text-xl">close</span>
                                    </button>
                                </div>

                                {/* LARGE PHONE FIELD - High visibility like the POS image */}
                                <div className="mb-8 p-1 bg-yellow-400/10 border-2 border-yellow-400/30 rounded-[24px]">
                                    <div className="bg-white rounded-[20px] px-6 py-4 border border-white shadow-sm flex items-center gap-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-yellow-600 uppercase tracking-widest leading-none mb-1">TELEFONO</span>
                                            <div className="flex items-center gap-2">
                                                <span className="material-icons-round text-[#f7951d]">phone_android</span>
                                                <input
                                                    type="tel"
                                                    value={customerInfo.phone || ''}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                                    className="bg-transparent border-none p-0 text-3xl font-black text-[#181511] focus:ring-0 outline-none w-full placeholder:text-gray-200"
                                                    placeholder="741 000 0000"
                                                />
                                            </div>
                                        </div>
                                        {isSearchingCustomer && (
                                            <div className="animate-spin text-[#f7951d]">
                                                <span className="material-icons-round text-3xl">sync</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* CLIENT SELECTION DROPDOWN */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Autocompletar Cliente</label>
                                        <div className="relative">
                                            <select
                                                onChange={handleClientSelect}
                                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3 text-sm font-bold focus:border-[#f7951d] outline-none transition-all appearance-none cursor-pointer text-[#181511]"
                                                value={availableClients.find(c => c.phone === customerInfo.phone)?.id || ""}
                                            >
                                                <option value="" disabled>-- {loadingClients ? 'Cargando lista...' : 'Seleccionar de la lista'} --</option>
                                                {availableClients.map((client) => (
                                                    <option key={`${client.origin}-${client.id}`} value={client.id}>
                                                        {client.name} {client.phone ? `(${client.phone})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                                <span className="material-icons-round">people</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* NAME */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">NOMBRE DEL CLIENTE</label>
                                        <input
                                            type="text"
                                            value={customerInfo.name || ''}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:border-[#f7951d] outline-none"
                                            placeholder="Nombre completo"
                                        />
                                    </div>

                                    {/* STREET */}
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">CALLE Y NÚMERO</label>
                                        <input
                                            type="text"
                                            value={customerInfo.street || ''}
                                            onChange={(e) => {
                                                const street = e.target.value;
                                                setCustomerInfo({
                                                    ...customerInfo,
                                                    street,
                                                    address: `${street}, ${customerInfo.neighborhood || ''}, ${customerInfo.reference || ''}`
                                                });
                                            }}
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:border-[#f7951d] outline-none"
                                            placeholder="Ej. Av. Juárez #123"
                                        />
                                    </div>

                                    {/* NEIGHBORHOOD */}
                                    <div className="md:col-span-1">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">COLONIA</label>
                                        <input
                                            type="text"
                                            value={customerInfo.neighborhood || ''}
                                            onChange={(e) => {
                                                const neighborhood = e.target.value;
                                                setCustomerInfo({
                                                    ...customerInfo,
                                                    neighborhood,
                                                    address: `${customerInfo.street || ''}, ${neighborhood}, ${customerInfo.reference || ''}`
                                                });
                                            }}
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:border-[#f7951d] outline-none"
                                            placeholder="Nombre de la colonia"
                                        />
                                    </div>

                                    {/* REFERENCE */}
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">REFERENCIA / NOTAS</label>
                                        <textarea
                                            rows={2}
                                            value={customerInfo.reference || ''}
                                            onChange={(e) => {
                                                const reference = e.target.value;
                                                setCustomerInfo({
                                                    ...customerInfo,
                                                    reference,
                                                    address: `${customerInfo.street || ''}, ${customerInfo.neighborhood || ''}, ${reference}`
                                                });
                                            }}
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:border-[#f7951d] outline-none resize-none"
                                            placeholder="Ej. Frente a la tienda El Porvenir"
                                        />
                                    </div>
                                </div>

                                <div className="mt-10 flex gap-4">
                                    <button
                                        onClick={() => setShowCustomerModal(false)}
                                        className="flex-1 bg-[#181511] text-white py-4 rounded-2xl font-black shadow-xl shadow-black/10 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                                    >
                                        <span className="material-icons-round text-green-400 group-hover:scale-125 transition-transform">check_circle</span>
                                        ACEPTAR DATOS
                                    </button>
                                    <button
                                        onClick={() => {
                                            setCustomerInfo({ name: '', phone: '', address: '', street: '', neighborhood: '', reference: '' });
                                            setShowCustomerModal(false);
                                        }}
                                        className="px-6 bg-red-50 text-red-500 py-4 rounded-2xl font-black active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="material-icons-round">delete_outline</span>
                                        BORRAR
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT SIDE: ADDITIONAL INFO */}
                            <div className="w-full md:w-80 bg-gray-50/50 border-l border-gray-100 flex flex-col p-6 lg:p-10">
                                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-8 text-center md:text-left">INFORMACIÓN ADICIONAL</h4>

                                <div className="space-y-8">
                                    <div className="bg-white p-5 rounded-3xl shadow-sm border border-white">
                                        <div className="bg-blue-50 size-10 rounded-xl mb-4 flex items-center justify-center text-blue-500">
                                            <span className="material-icons-round">calendar_today</span>
                                        </div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Cliente desde:</p>
                                        <p className="text-xl font-black text-[#181511] tracking-tight">20/05/2025</p>
                                    </div>

                                    <div className="bg-yellow-400 p-6 rounded-3xl shadow-lg shadow-yellow-400/20 text-yellow-950 flex flex-col gap-1">
                                        <div className="bg-yellow-950/20 size-10 rounded-xl mb-3 flex items-center justify-center">
                                            <span className="material-icons-round">history</span>
                                        </div>
                                        <p className="text-[10px] font-black uppercase opacity-60">Último Pedido Realizado:</p>
                                        <p className="text-xl font-black tracking-tight leading-tight">04/01/2026</p>
                                        <p className="text-3xl font-black mt-2">$ 375.00</p>
                                    </div>

                                    <div className="mt-auto pt-6 border-t border-gray-200/50">
                                        <div className="flex items-center gap-3">
                                            <div className="size-12 rounded-full overflow-hidden bg-[#f7951d] flex items-center justify-center text-white text-xl font-black">
                                                {customerInfo.name ? customerInfo.name.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-black text-[#181511] line-clamp-1">{customerInfo.name || 'Sin nombre'}</p>
                                                <p className="text-[10px] font-bold text-[#f7951d]">Nivel Gold 🏆</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }



            {
                (showSuccessModal || successModalRef.current) && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#181511]/90 backdrop-blur-md">
                        <div className="bg-white rounded-[40px] p-12 text-center shadow-2xl transform scale-100 animate-in zoom-in-95 duration-300">
                            <div className="size-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
                                <span className="material-icons-round text-6xl text-green-500 animate-bounce">check_circle</span>
                            </div>
                            <h3 className="text-4xl font-black mb-4">¡LISTO!</h3>
                            <p className="text-gray-500 font-medium max-w-[240px] mx-auto mb-4">La orden ha sido enviada correctamente.</p>

                            {/* Printing indicator */}
                            <div className="flex items-center justify-center gap-2 mb-8 text-[#f7951d]">
                                <span className="material-icons-round text-lg animate-pulse">print</span>
                                <span className="text-sm font-bold">Imprimiendo ticket...</span>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        console.log('🔄 [Cashier] Recargando página para nueva orden...');
                                        window.location.reload();
                                    }}
                                    className="w-full bg-[#181511] text-white py-4 rounded-2xl font-black active:scale-95 transition-all shadow-xl shadow-black/20"
                                >
                                    NUEVA ORDEN
                                </button>

                                <button
                                    onClick={handleCancelOrder}
                                    className="w-full bg-white border-2 border-red-500 text-red-500 py-4 rounded-2xl font-black hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <span className="material-icons-round group-hover:rotate-90 transition-transform">cancel</span>
                                    {loading ? 'ELIMINANDO...' : 'CANCELAR Y ELIMINAR PEDIDO'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }




            {/* Modals */}
            {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
            {showChat && <CashierSupportChat onClose={() => setShowChat(false)} />}

            {/* Ticket Print Modal */}
            <TicketPrintModal
                isOpen={showTicketModal}
                onClose={() => setShowTicketModal(false)}
                data={ticketData}
            />

        </div >
    );
}
