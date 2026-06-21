'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';

import { useSessionKeepAlive } from '@/hooks/useSessionKeepAlive';
import { isAbortError } from '@/hooks/useSafeFetch';
import NotificationPanel from '@/components/NotificationPanel';
import CashierSupportChat from '@/components/CashierSupportChat';
import TicketPrintModal from '@/components/TicketPrintModal';
import CierreCajaModal from '@/components/CierreCajaModal';
import AperturaCajaModal from '@/components/AperturaCajaModal';
import CustomerDeliveryModal from '@/components/CustomerDeliveryModal';
import { useAuth } from '@/contexts/AuthContext';
import CashierSidebar from './components/CashierSidebar';

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
    image_url?: string;
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
    note?: string; // Special instructions / customization note
    isHalfAndHalf?: boolean;
    secondHalfVariant?: {
        id: number;
        name: string;
        price: number;
    };
}

type OrderType = 'dine-in' | 'takeout' | 'delivery';

// ✅ FIX: Module-level constant — avoids recreation on every render
const EXTRAS_OPTIONS = [
    { id: 'extra_ingredient', name: 'Ingrediente extra', price: 20 },
    { id: 'extra_cheese', name: 'Extra queso', price: 35 },
    { id: 'extra_sauce', name: 'Aderezo extra', price: 10 },
];

export default function CashierPage() {
    const router = useRouter();
    // Removed offline sync per user request
    const isOnline = true; // Placeholder or use navigator.onLine if needed, but per request we skip offline handling logic
    const pendingCount = 0;
    const isSyncing = false;
    const { user, loading: authLoading, signOut } = useAuth();
    const cashierName = user?.full_name || 'CAJERO';

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push('/login');
            } else {
                const role = user.role.toLowerCase();
                if (role !== 'cajero' && role !== 'administrador') {
                    router.push('/redirect');
                } else if (user.full_name) {
                    localStorage.setItem('cached_cashier_name', user.full_name);
                }
            }
        }
    }, [user, authLoading, router]);

    // ── SESIÓN KEEP-ALIVE ────────────────────────────────────────────────────────
    // El cliente Supabase ya tiene autoRefreshToken: true — renueva solo.
    // Este hook añade una capa extra de defensa: refresca al volver a la pestaña,
    // al recuperar foco, y cada 20 minutos en background.
    // onSessionLost: solo mostramos un warning, NO redirigimos — el cajero
    // puede seguir cobrando en modo offline y la sesión se recuperará sola.
    useSessionKeepAlive(useCallback(() => {
        console.warn('[CashierPage] Token expirado. El auto-refresh intentará renovarlo en el siguiente foco/visibilidad.');
        // No redirigimos: la caja debe seguir funcionando en modo offline.
    }, []));

    /**
     * Obtiene el userId de la sesión actual de forma no bloqueante.
     * Si la sesión expiró temporalmente, devuelve null (la orden se guarda offline).
     * NUNCA lanza excepción.
     */
    const getUserIdSafe = async (): Promise<string | null> => {
        try {
            // Añadimos un timeout corto para no colgar el proceso de cobro si Supabase tarda
            const sessionPromise = supabase.auth.getSession();
            const timeoutPromise = new Promise<null>(resolve => setTimeout(() => resolve(null), 2000));
            
            const result = await Promise.race([
                sessionPromise.catch(err => {
                    if (isAbortError(err)) {
                        return { data: { session: null } };
                    }
                    throw err;
                }),
                timeoutPromise
            ]);

            if (!result || !('data' in result)) return null;
            return result.data.session?.user?.id ?? null;
        } catch (err: any) {
            // Silently ignore failures - preserving the cashier's ability to work offline
            console.warn('[Cashier] ⚠️ Error no crítico en getUserIdSafe:', err?.message || 'Aborted');
            return null;
        }
    };

    // Data State
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);       // menú / productos
    const [orderLoading, setOrderLoading] = useState(false); // procesar orden
    const [activeBanner, setActiveBanner] = useState<any>(null);

    // Filter UI State
    const [selectedCategory, setSelectedCategory] = useState<string | number>('all');
    const [printPreviewUrl, setPrintPreviewUrl] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Customization UI State (The Modal)
    const [selectedGroupedProduct, setSelectedGroupedProduct] = useState<GroupedProduct | null>(null);
    const [currentSize, setCurrentSize] = useState<string>('');
    const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
    const [itemNote, setItemNote] = useState<string>('');
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
    const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
    
    // Customer State (for Delivery)
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
        address: '',
        street: '',
        neighborhood: '',
        reference: ''
    });
    const [customerInsights, setCustomerInsights] = useState<{
        totalOrders: number;
        totalSpent: number;
        lastOrderDate: string | null;
        firstOrderDate: string | null;
        favoriteProducts: string[];
        isFrequent: boolean;
        lastOrderAmount: number;
    } | null>(null);
    const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
    const [isPreTicket, setIsPreTicket] = useState(false);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

    // UI Modals State
    const [showNotifications, setShowNotifications] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [foundCustomers, setFoundCustomers] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [ticketData, setTicketData] = useState<any>(null);
    const [showOpenTabsModal, setShowOpenTabsModal] = useState(false);
    const isProcessingOrder = useRef(false);

    // Dropdown State
    const [availableClients, setAvailableClients] = useState<any[]>([]);
    const [loadingClients, setLoadingClients] = useState(false);
    const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);

    const [showOrdersView, setShowOrdersView] = useState(false);
    const [showCierreCaja, setShowCierreCaja] = useState(false);
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [recentOrdersLoading, setRecentOrdersLoading] = useState(false);
    const [recentOrdersFilter, setRecentOrdersFilter] = useState('Todos');
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    const [pendingNewOrder, setPendingNewOrder] = useState<any>(null);
    const [allPendingVirtualOrders, setAllPendingVirtualOrders] = useState<any[]>([]);
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);

    const startAlarm = () => {
        if (typeof window === 'undefined') return;
        try {
            if (!alarmAudioRef.current) {
                alarmAudioRef.current = new Audio('/Dinner_Rush_Cycle.mp3');
                alarmAudioRef.current.loop = true;
                alarmAudioRef.current.volume = 0.6;
            }
            const playPromise = alarmAudioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.warn('🔊 [Alarm] Reproducción bloqueada por el navegador:', e);
                });
            }
        } catch (err) {
            console.error('❌ [Alarm] Error inicializando audio:', err);
        }
    };

    const stopAlarm = () => {
        if (alarmAudioRef.current) {
            alarmAudioRef.current.pause();
            alarmAudioRef.current.currentTime = 0;
            console.log('🔇 [Alarm] Alarma detenida.');
        }
    };

    // Shift Management State
    const [shiftState, setShiftState] = useState<'checking' | 'too_early' | 'must_open' | 'open' | 'must_close' | 'closed'>('checking');
    const [systemSettings, setSystemSettings] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    // --- Persistencia Local (SessionStorage) ---
    const [isStateRestored, setIsStateRestored] = useState(false);
    const [isLocalStorageEnabled, setIsLocalStorageEnabled] = useState(true);

    useEffect(() => {
        try {
            const savedCart = sessionStorage.getItem('caja_cart');
            if (savedCart) setCart(JSON.parse(savedCart));

            const savedOrderType = sessionStorage.getItem('caja_orderType');
            if (savedOrderType) setOrderType(savedOrderType as OrderType);

            const savedTableNumber = sessionStorage.getItem('caja_tableNumber');
            if (savedTableNumber) setTableNumber(savedTableNumber);

            const savedCustomerInfo = sessionStorage.getItem('caja_customerInfo');
            if (savedCustomerInfo) setCustomerInfo(JSON.parse(savedCustomerInfo));

            const savedActiveOrderId = sessionStorage.getItem('caja_activeOrderId');
            if (savedActiveOrderId) setActiveOrderId(savedActiveOrderId);
        } catch (e) {
            // Safe silent catch
        } finally {
            setIsStateRestored(true);
            isProcessingOrder.current = false;
        }
    }, []);

    useEffect(() => { if (isStateRestored && isLocalStorageEnabled) sessionStorage.setItem('caja_cart', JSON.stringify(cart)); }, [cart, isStateRestored, isLocalStorageEnabled]);
    useEffect(() => { if (isStateRestored && isLocalStorageEnabled) sessionStorage.setItem('caja_orderType', orderType); }, [orderType, isStateRestored, isLocalStorageEnabled]);
    useEffect(() => { if (isStateRestored && isLocalStorageEnabled) sessionStorage.setItem('caja_tableNumber', tableNumber); }, [tableNumber, isStateRestored, isLocalStorageEnabled]);
    useEffect(() => { if (isStateRestored && isLocalStorageEnabled) sessionStorage.setItem('caja_customerInfo', JSON.stringify(customerInfo)); }, [customerInfo, isStateRestored, isLocalStorageEnabled]);
    useEffect(() => { 
        if (isStateRestored && isLocalStorageEnabled) {
            if (activeOrderId) sessionStorage.setItem('caja_activeOrderId', activeOrderId); 
            else sessionStorage.removeItem('caja_activeOrderId');
        }
    }, [activeOrderId, isStateRestored, isLocalStorageEnabled]);

    // -----------------------------------------

    useEffect(() => {
        let isMounted = true;

        const cleanupOldShiftKeys = () => {
            try {
                const now = new Date();
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('caja_casalena_')) {
                        const dateStr = key.replace('caja_casalena_', '');
                        const shiftDate = new Date(dateStr);
                        if ((now.getTime() - shiftDate.getTime()) / (1000 * 3600 * 24) > 7) {
                            localStorage.removeItem(key);
                        }
                    }
                });
            } catch (e) {}
        };

        // Settings se cargan UNA sola vez al montar — no hay polling
        const fetchSystemConfig = async () => {
            if (!isMounted) return;
            try {
                const res = await fetch('/api/settings');
                if (!res.ok) throw new Error('Settings fetch failed');
                const data = await res.json();
                if (isMounted) setSystemSettings(data);
            } catch (error) {
                console.error('Error syncing settings:', error);
            }
        };

        cleanupOldShiftKeys();
        fetchSystemConfig();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        // Esperar a que AuthContext termine de cargar antes de verificar
        if (authLoading) return;

        let isEffectActive = true;

        const evaluateShiftStrict = async () => {
            try {
                console.log('[Shift] 🔄 Verificando sesión...');

                // 1. Usar el user ya resuelto por AuthContext (sin llamadas extra a Supabase)
                if (!user) {
                    // No mostrar "Turno Cerrado" — eso confunde cuando solo expiró la sesión.
                    // El efecto de autenticación (auth useEffect) ya redirige a /login.
                    console.warn('[Shift] Sin usuario autenticado — esperando redirección de auth.');
                    return; // Mantenemos 'checking' hasta que el redirect ocurra
                }

                console.log('[Shift] 👤 Usuario:', user.id, '| Rol:', user.role);

                // 2. Verificar rol de administrador desde AuthContext (sin query extra)
                const isAdminUser = user.role === 'administrador';
                setIsAdmin(isAdminUser);

                if (isAdminUser) {
                    console.log('[Shift] 👑 Admin detectado, acceso directo.');
                    setShiftState('open');
                    return;
                }

                // 3. Verificación ESTRICTA a través de la API (con timeout)
                console.log('[Shift] 🔍 Consultando estado de caja en API...');
                const res = await Promise.race([
                    fetch(`/api/cashier/sessions/status?userId=${user.id}`),
                    // ✅ FIX: Aumentado de 8s a 10s — el safety global ahora es mayor,
                    // así la API siempre tiene oportunidad de responder primero.
                    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout-api')), 10000))
                ]) as Response;

                if (!isEffectActive) return;

                if (!res.ok) {
                    console.error('[Shift] Error en API de estado:', await res.text());
                    setShiftState('must_open');
                    return;
                }

                const { isOpen, session } = await res.json();

                // 4. Decision: Abierta vs Cerrada
                if (isOpen && session) {
                    console.log(`✅ [Shift] Caja ABIERTA (Sesión: ${session.id})`);
                    setShiftState('open');
                } else {
                    console.log('🔒 [Shift] Caja CERRADA. Requiere apertura.');
                    setShiftState('must_open');
                }

            } catch (err: any) {
                if (!isEffectActive) return;
                if (isAbortError(err)) return;
                console.warn('[Shift] ⚠️ Error en verificación:', err.message);
                // ✅ FIX: Si es un timeout de red (no error de lógica), intentar continuar
                // en lugar de forzar must_open que crea sesiones duplicadas.
                // Sólo forzamos must_open si es un error real de API.
                if (err.message === 'timeout-api') {
                    console.warn('[Shift] ⏱️ Timeout de API — mostrando apertura de caja como fallback seguro.');
                }
                setShiftState('must_open');
            }
        };

        // ✅ FIX: Safety timeout ahora en 14s (mayor que el timeout de API de 10s).
        // Antes era 5s, lo que hacía que siempre ganara sobre la API (8s), rompiendo
        // el flujo de verificación de sesión en conexiones lentas.
        const globalSafety = setTimeout(() => {
            if (isEffectActive) {
                console.warn('[Shift] ⏱️ Safety timeout — forzando pantalla de apertura');
                setShiftState(prev => prev === 'checking' ? 'must_open' : prev);
            }
        }, 14000);

        evaluateShiftStrict().finally(() => clearTimeout(globalSafety));

        return () => { isEffectActive = false; clearTimeout(globalSafety); };
    }, [authLoading, user]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleOpenShift = async (info: { fondo: number, notas: string }) => {
        setShiftState('checking'); // Show loading while processing
        try {
            // Guardar en la base de datos a través de la API estrictamente
            const res = await fetch('/api/cashier/sessions/open', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cashier_name: cashierName,
                    user_id: user?.id,
                    initial_fund: info.fondo,
                    notes: info.notas
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Error al conectar con la base de datos');
            }
            
            const data = await res.json();
            
            if (data.success && data.session) {
                console.log('✅ [Shift] Apertura de caja registrada en el servidor:', data.session.id);
                setShiftState('open');
            } else {
                throw new Error('Respuesta inválida del servidor');
            }

        } catch (err: any) {
            console.error('❌ [Shift] Error al registrar apertura en la base de datos:', err);
            alert(`No se pudo abrir la caja: ${err.message}. La caja DEBE registrarse en el servidor para operar.`);
            setShiftState('must_open');
        }
    };
    
    const handleCloseShiftSuccess = () => {
         setShiftState('closed');
         // Recargar para forzar una re-evaluación limpia desde la base de datos
         window.location.reload();
    };

    useEffect(() => {
        fetchClientsForDropdown();
    }, []);

    // BROWSER NOTIFICATIONS SYSTEM
    const handleAcceptOrder = async (orderId: number | string) => {
        try {
            console.log(`✅ [Shift] Aceptando pedido #${orderId}...`);
            const res = await fetch('/api/cashier/orders/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId,
                    status: 'preparando',
                    user_id: user?.id,
                    cashier_name: cashierName
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }

            fetchRecentOrders(false);
        } catch (err) {
            console.error('❌ [Shift] Error al aceptar pedido:', err);
        }
    };

    useEffect(() => {
        let isEffectActive = true;

        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        }

        const checkInitialPendingOrders = async () => {
            try {
                const res = await fetch('/api/orders?status=pendiente&orderType=delivery,takeout&cashierNameNull=true');
                if (!res.ok) throw new Error('Error al cargar pedidos pendientes');
                const data = await res.json();

                if (data && data.length > 0 && isEffectActive) {
                    console.log('🔔 [Notifications] Encontrados pedidos pendientes iniciales:', data.length);
                    // Reverse to keep oldest first (original ascending order)
                    const sortedData = [...data].reverse();
                    setAllPendingVirtualOrders(sortedData);
                    setPendingNewOrder(sortedData[0]);
                    // startAlarm(); // Desactivado por solicitud del usuario
                }
            } catch (err: any) {
                // Ignore AbortError which happens on rapid re-renders or unmounts
                if (isAbortError(err) || !isEffectActive) {
                    return;
                }
                console.error('❌ [Notifications] Error en carga inicial de pendientes:', err);
            }
        };

        checkInitialPendingOrders();

        // Subscribe to NEW ORDERS for notifications
        console.log('🔔 [Notifications] Activando escucha en tiempo real para pedidos...');
        const ordersChannel = supabase
            .channel('cashier_realtime_notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'orders'
            }, (payload) => {
                if (!isEffectActive) return;
                const newOrder = payload.new;
                
                // Refresh list
                fetchRecentOrders(false);

                // Browser Notification (Only for Delivery as requested, or others if needed)
                // SOLO MOSTRAR SI ES UN PEDIDO VIRTUAL (Sin cajero asignado inicialmente)
                if (newOrder.status === 'pendiente' && !newOrder.cashier_name && (newOrder.order_type === 'delivery' || newOrder.order_type === 'takeout')) {
                    const title = newOrder.order_type === 'delivery' ? '🚀 ¡Nuevo Domicilio!' : '🛍️ ¡Nuevo Pick-up!';
                    const body = `Orden #${newOrder.id} - $${newOrder.total_amount}\nCliente: ${newOrder.customer_name || 'Desconocido'}`;
                    
                    if (Notification.permission === 'granted') {
                        const notif = new Notification(title, {
                            body,
                            icon: '/logo-main.jpg',
                            badge: '/icon.png'
                        });
                        notif.onclick = () => {
                            window.focus();
                            handleAcceptOrder(newOrder.id);
                            stopAlarm();
                            setShowOrdersView(true);
                            setPendingNewOrder(null);
                        };
                    }

                    // Start Continuous Alarm - Desactivado por solicitud del usuario
                    // startAlarm();

                    // PERSISTENT UI ALERT
                    setAllPendingVirtualOrders(prev => [...prev, newOrder]);
                    setPendingNewOrder((prev: any) => prev || newOrder);
                }
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders'
            }, (payload) => {
                if (!isEffectActive) return;
                const updatedOrder = payload.new;

                // Si deja de estar pendiente (fue aceptado en otro lugar)
                if (updatedOrder.status !== 'pendiente') {
                    setAllPendingVirtualOrders(prev => {
                        const filtered = prev.filter(o => o.id !== updatedOrder.id);
                        if (filtered.length === 0) {
                            setPendingNewOrder(null);
                            stopAlarm();
                        } else if (pendingNewOrder?.id === updatedOrder.id) {
                            setPendingNewOrder(filtered[0]);
                        }
                        return filtered;
                    });
                }
            })
            .subscribe();

        return () => {
            isEffectActive = false;
            supabase.removeChannel(ordersChannel);
        };
    }, []);

    // STOP ALARM WHEN OPENING MODALS
    useEffect(() => {
        if (showNotifications || showOrdersView) {
            stopAlarm();
        }
    }, [showNotifications, showOrdersView]);

    // Resetear estado de orden cada vez que se abre el modal de pago
    useEffect(() => {
        if (showPaymentModal) {
            setOrderLoading(false);
            isProcessingOrder.current = false;
        }
    }, [showPaymentModal]);

    // EFECTO PARA BUSCAR SI LA MESA YA TIENE UNA COMANDA ABIERTA
    useEffect(() => {
        if (orderType === 'dine-in' && tableNumber.trim()) {
            const tableNum = tableNumber.trim();
            const fetchOpenTableOrder = async () => {
                console.log(`🔍 [Cashier] Buscando comanda abierta para Mesa: ${tableNum}...`);
                try {
                    const res = await fetch(`/api/cashier/orders/search?table_number=${tableNum}`);
                    if (!res.ok) throw new Error('Error en API de búsqueda');
                    
                    const { orders: data } = await res.json();

                    if (data && data.length > 0) {
                        const order = data[0];
                        console.log(`✅ [Cashier] Encontrada comanda #${order.id} abierta para mesa ${tableNum}`);
                        
                        // Cargar los items de la BD siempre que sea una orden diferente a la activa.
                        // Esto garantiza que al editar/reabrir una orden, se muestren los items ya guardados.
                        if (activeOrderId !== order.id) {
                            setActiveOrderId(order.id);
                            setPaymentMethod(order.payment_method || 'efectivo');

                            // Mapear items al carrito
                            const loadedCart = order.order_items.map((item: any) => ({
                                id: item.product_id ?? 0,
                                name: item.product_name,
                                price: item.unit_price,
                                quantity: item.quantity,
                                selectedSize: item.selected_size,
                                extras: (function() {
                                    if (!item.extras) return [];
                                    if (typeof item.extras === 'string') {
                                        try { return JSON.parse(item.extras); } catch(e) { return []; }
                                    }
                                    if (Array.isArray(item.extras)) return item.extras;
                                    return [];
                                })(),
                                note: item.notes || '',
                                cartItemId: Math.random().toString(36).substr(2, 9),
                                _originalProductId: item.product_id // preserve for API
                            }));
                            setCart(loadedCart);
                        }
                    } else {
                        // Si no hay comanda abierta y el carrito estaba cargado por una mesa previa, limpiar
                        // Pero solo si el activeOrderId era diferente de null (indicando que veníamos de una carga)
                        if (activeOrderId && cart.length === 0) {
                            setActiveOrderId(null);
                        }
                    }
                } catch (err) {
                    console.error('❌ Error buscando mesa abierta:', err);
                }
            };

            const timer = setTimeout(fetchOpenTableOrder, 500); // Debounce para no saturar mientras escriben
            return () => clearTimeout(timer);
        } else if (orderType !== 'dine-in' || !tableNumber.trim()) {
            if (activeOrderId) {
                setActiveOrderId(null);
                setCart([]);
            }
        }
    }, [tableNumber, orderType]);

    const fetchClientsForDropdown = async () => {
        setLoadingClients(true);
        try {
            // Usar la API centralizada que ya maneja profiles + customers correctamente
            const res = await fetch('/api/cashier/customers/search');
            if (!res.ok) return;
            const data = await res.json();
            const combined = (data.customers || []).map((c: any) => ({
                id: c.id,
                name: c.full_name || 'Sin Nombre',
                phone: c.phone || '',
                address: c.address || '',
                origin: c.is_app_user ? 'profile' : 'customer',
            }));
            setAvailableClients(combined);
        } catch (err) {
            if (!isAbortError(err)) console.error('❌ Error en fetchClientsForDropdown:', err);
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

    const normalizePhone = (phone: string) => phone.replace(/\D/g, '');

    // Fetch customers for the searchable list — triggered manually only
    const searchCustomersList = async (term: string) => {
        if (!term || term.length < 2) {
            setFoundCustomers([]);
            return;
        }
        try {
            const res = await fetch(`/api/cashier/customers/search?term=${encodeURIComponent(term)}`);
            if (!res.ok) throw new Error('Error en búsqueda de clientes');
            
            const data = await res.json();
            const mapped = (data.customers || []).map((c: any) => ({
                id: c.id,
                name: c.full_name || c.name || 'Sin Nombre',
                phone: c.phone || '',
                address: c.address || '',
                origin: c.is_app_user ? 'profile' : 'customer'
            }));
            setFoundCustomers(mapped);
        } catch (err) {
            console.error('Error searching customers:', err);
        }
    };

    // ── NO auto-search useEffect — búsqueda solo se dispara manualmente ──────

    const searchCustomerByTerm = useCallback(async (manualTerm?: string) => {
        const queryTerm = manualTerm || customerInfo.phone.trim();
        if (queryTerm.length < 3) return;

        setIsSearchingCustomer(true);
        try {
            const res = await fetch(`/api/cashier/customers/search?term=${encodeURIComponent(queryTerm)}`);
            const data = await res.json();
            const mapped = (data.customers || []).map((c: any) => ({
                id: c.id,
                name: c.full_name || c.name || 'Sin Nombre',
                phone: c.phone || '',
                address: c.address || '',
                origin: c.is_app_user ? 'profile' : 'customer'
            }));

            setFoundCustomers(mapped);
            setAvailableClients(mapped);
            setSearchTerm(queryTerm);

            const exactMatch = mapped.find((c: any) => normalizePhone(c.phone || '') === normalizePhone(queryTerm));
            const customerData = exactMatch || (mapped.length === 1 ? mapped[0] : null);

            if (customerData) {
                const parts = (customerData.address || '').split(',').map((p: string) => p.trim());
                
                setCustomerInfo({
                    phone: customerData.phone || queryTerm,
                    name: customerData.name || '',
                    address: customerData.address || '',
                    street: parts[0] || '',
                    neighborhood: parts[1] || '',
                    reference: parts.slice(2).join(', ') || ''
                });

                const phoneQuery = customerData.phone || queryTerm;
                const historyRes = await fetch(`/api/orders?phone=${encodeURIComponent(phoneQuery)}`);
                if (!historyRes.ok) throw new Error('Error al obtener historial del cliente');
                const orderHistory = await historyRes.json();

                if (orderHistory && orderHistory.length > 0) {
                    const totalOrders = orderHistory.length;
                    const totalSpent = (orderHistory as any[]).reduce((acc: number, curr: any) => acc + (curr.total_amount || 0), 0);
                    const lastOrderDate = orderHistory[0].created_at;
                    const lastOrderAmount = orderHistory[0].total_amount;
                    const firstOrderDate = orderHistory[orderHistory.length - 1].created_at;

                    const productCounts: Record<string, number> = {};
                    (orderHistory as any[]).forEach((o: any) => {
                        (o.order_items as any[])?.forEach((item: any) => {
                            productCounts[item.product_name] = (productCounts[item.product_name] || 0) + 1;
                        });
                    });
                    const favoriteProducts = Object.entries(productCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([name]) => name);

                    setCustomerInsights({
                        totalOrders,
                        totalSpent,
                        lastOrderDate,
                        firstOrderDate,
                        favoriteProducts,
                        isFrequent: totalOrders >= 3,
                        lastOrderAmount
                    });
                } else {
                    setCustomerInsights(null);
                }
            } else {
                setCustomerInsights(null);
            }
        } catch (err) {
            console.error('Error fetching customer insights:', err);
        } finally {
            setIsSearchingCustomer(false);
        }
    }, [customerInfo.phone]);

    // ── NO auto-search useEffect — búsqueda solo se dispara manualmente ──────


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

    // Reset loading state whenever the payment modal is opened
    // This prevents buttons from being stuck in "PROCESANDO..." after a failed/interrupted request
    useEffect(() => {
        if (showPaymentModal) {
            setOrderLoading(false);
            isProcessingOrder.current = false;
        }
    }, [showPaymentModal]);

    useEffect(() => {
        fetchMenu();
    }, []);

    async function fetchMenu(retryCount = 0) {
        // ── 1. Mostrar caché inmediatamente (no bloquear la UI) ──────────────
        try {
            const cachedProds = localStorage.getItem('cached_products');
            const cachedCats = localStorage.getItem('cached_categories');
            if (cachedProds && cachedCats) {
                const parsedProds = JSON.parse(cachedProds);
                const parsedCats = JSON.parse(cachedCats);
                if (Array.isArray(parsedProds) && parsedProds.length > 0) {
                    setProducts(parsedProds);
                    setCategories(parsedCats);
                    setLoading(false); // Mostrar menu de caché mientras se actualiza
                    console.log(`⚡ [Caja] ${parsedProds.length} productos cargados desde caché local.`);
                }
            }
        } catch (_) { /* caché inaccesible — continuar con fetch */ }

        // ── 2. Fetch desde servidor con timeout de 8s ────────────────────────
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        console.log('🍕 [Caja] Actualizando menú desde API...');
        try {
            const res = await fetch('/api/cashier/products', {
                signal: controller.signal,
                headers: { 'Cache-Control': 'max-age=60' }
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                throw new Error(`API respondió ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();

            // ── 3. Validar que los datos tienen la forma esperada ────────────
            if (!data || typeof data !== 'object') {
                throw new Error('Respuesta inesperada del servidor (no es un objeto)');
            }
            if (data.error) {
                throw new Error(data.error);
            }

            const productList: Product[] = Array.isArray(data.products) ? data.products : [];
            const categoryList: Category[] = Array.isArray(data.categories) ? data.categories : [];

            if (productList.length === 0) {
                console.warn('⚠️ [Caja] API devolvió 0 productos. Verificar disponibilidad en DB.');
            }

            // ── 4. Ordenar categorías ────────────────────────────────────────
            const categorySortOrder: Record<string, number> = {
                'PIZZAS TRADICIONALES': 1,
                'ESPECIALIDADES CASALEÑA': 2,
                'ESPECIALIDADES': 2,
                'GOURMET': 3,
                'PIZZA & FRIENDS - COMBOS': 4,
                'COMBOS': 4,
                'ORILLA DE QUESO (EXTRA)': 5,
                'ORILLAFRESCA': 5,
                'HAMBURGUESAS': 6,
                'ENTRADAS Y SNACKS': 7,
                'POSTRES': 8,
                'BEBIDAS': 9
            };

            const sortedCategories = [...categoryList].sort((a, b) => {
                const orderA = categorySortOrder[a.name.toUpperCase()] || 999;
                const orderB = categorySortOrder[b.name.toUpperCase()] || 999;
                return orderA - orderB;
            });

            // ── 5. Actualizar estado y caché ─────────────────────────────────
            setProducts(productList);
            setCategories(sortedCategories);
            console.log(`✅ [Caja] ${productList.length} productos actualizados desde servidor.`);

            try {
                localStorage.setItem('cached_products', JSON.stringify(productList));
                localStorage.setItem('cached_categories', JSON.stringify(sortedCategories));
            } catch (_) { /* quota exceeded — no critical */ }

        } catch (err: any) {
            clearTimeout(timeoutId);

            const isAbort = err?.name === 'AbortError';
            const isNetwork = err?.message?.includes('fetch') || err?.message?.includes('network');

            if (isAbort) {
                console.warn('⏱️ [Caja] Timeout al cargar productos (>8s). Usando caché.');
            } else if (isNetwork && retryCount < 2) {
                // Auto-retry once on network failure with exponential backoff
                const delay = 1500 * (retryCount + 1);
                console.warn(`🔄 [Caja] Error de red. Reintentando en ${delay}ms... (intento ${retryCount + 1}/2)`);
                setTimeout(() => fetchMenu(retryCount + 1), delay);
                return;
            } else {
                console.warn('⚠️ [Caja] Error al cargar productos:', err.message);
            }

            // Fallback a caché si todavía no tenemos productos
            try {
                if (products.length === 0) {
                    const cachedCats = localStorage.getItem('cached_categories');
                    const cachedProds = localStorage.getItem('cached_products');
                    if (cachedCats) setCategories(JSON.parse(cachedCats));
                    if (cachedProds) {
                        const p = JSON.parse(cachedProds);
                        if (Array.isArray(p)) setProducts(p);
                    }
                }
            } catch (_) { /* localStorage inaccesible */ }
        } finally {
            setLoading(false);
        }
    };

    // Derived State: Group Products (Logic from Tienda)
    const groupedProducts = useMemo(() => {
        const groups: { [key: string]: GroupedProduct } = {};

        products.forEach(product => {
            if (!product || !product.name) return; // Safety check

            const match = product.name.match(/^(.*?)\s*\((.*?)\)$/);
            const baseName = match ? match[1] : product.name;
            const size = match ? match[2] : 'Estándar';

            if (!groups[baseName]) {
                groups[baseName] = {
                    name: baseName,
                    description: product.description || '',
                    imagen_url: product.imagen_url || product.image_url || "/icon.png",
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
            setItemNote(editItem.note || '');
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
            setItemNote('');
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
                        note: itemNote.trim() || undefined,
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
                note: itemNote.trim() || undefined,
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
        setItemNote('');
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
        if (cart.length > 0 && !window.confirm('¿Estás seguro de limpiar la comanda actual? Se perderán los productos no guardados.')) return;
        setCart([]);
        setTableNumber('');
        setActiveOrderId(null);
        setCustomerInfo({ name: '', phone: '', address: '', street: '', neighborhood: '', reference: '' });
    };

    const handleOpenTicketModal = (orderData: any, items: CartItem[]) => {
        console.log('🚀 [Caja] Abriendo modal de ticket para orden:', orderData.id);

        const data = {
            atendido_por: orderData.cashier_name || cashierName,
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
                is_pre_ticket: orderData.is_pre_ticket || false,
                ticket_number: orderData.ticket_number,
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
                    extras: extrasNames.length > 0 ? extrasNames : undefined,
                    note: it.note
                };
            }),
            cliente: (orderData.order_type === 'delivery' || orderData.order_type === 'takeout') ? {
                nombre: orderData.customer_name || 'Cliente Genérico',
                telefono: orderData.phone_number || 'S/N',
                direccion: orderData.delivery_address || 'Sin dirección'
            } : undefined
        };

        setTicketData(data);
        setShowTicketModal(true);
    };

    const handlePlaceOrder = async (isFinalPayment: boolean = true, overridePaymentMethod?: string, skipPrinting: boolean = false) => {
        if (isProcessingOrder.current) {
            console.warn('⚠️ [Cashier] Ya hay un proceso en curso.');
            setOrderLoading(false);
            isProcessingOrder.current = false;
            return;
        }

        if (orderType === 'dine-in' && !tableNumber.trim()) {
            alert('⚠️ POR FAVOR INGRESA EL NÚMERO DE MESA.');
            return;
        }

            setOrderLoading(true);
            isProcessingOrder.current = true;

            try {
                const userId = await getUserIdSafe();

                // El status es 'pendiente' si es pre-ticket.
                // Para llevar -> 'preparando' para que siga en Cuentas Abiertas.
                // Domicilio -> 'confirmado'.
                // Mesa -> 'entregado' (ya que se consume ahí).
                const finalStatus = isFinalPayment 
                    ? (orderType === 'delivery' ? 'confirmado' : (orderType === 'takeout' ? 'preparando' : 'entregado')) 
                    : 'pendiente';

                const orderPayload: any = {
                    user_id: userId,
                    status: finalStatus,
                    payment_status: isFinalPayment ? 'paid' : 'pending',
                    total_amount: cartTotals.total,
                    tax_amount: cartTotals.tax,
                    order_type: orderType,
                    payment_method: (overridePaymentMethod || paymentMethod).toLowerCase().trim(),
                    customer_name: orderType === 'dine-in' ? null : customerInfo.name,
                    phone_number: orderType === 'dine-in' ? null : customerInfo.phone,
                    delivery_address: orderType === 'delivery' ? customerInfo.address : null,
                    table_number: orderType === 'dine-in' ? tableNumber : null,
                    pago_con: (overridePaymentMethod || paymentMethod).toLowerCase().trim() === 'efectivo' ? (parseFloat(amountPaid) || cartTotals.total) : cartTotals.total,
                    cambio: (overridePaymentMethod || paymentMethod).toLowerCase().trim() === 'efectivo' ? Math.max(0, (parseFloat(amountPaid) || cartTotals.total) - cartTotals.total) : 0,
                    updated_at: new Date().toISOString(),
                    cashier_name: cashierName
                };

                if (!activeOrderId) {
                    orderPayload.created_at = new Date().toISOString();
                }

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

                    // Si el item fue cargado desde el historial, puede tener id=0
                    // Usamos _originalProductId si está disponible, o null para no fallar la API
                    const productId = (item as any)._originalProductId ?? (item.id > 0 ? item.id : null);
                    return {
                        product_id: productId,
                        product_name: item.name,
                        quantity: item.quantity,
                        unit_price: item.price,
                        total_price: item.price * item.quantity,
                        selected_size: item.selectedSize,
                        extras: extrasData.length > 0 ? extrasData : null,
                        notes: item.note || null
                    };
                });

                console.log('🚀 [Cashier] Enviando orden al servidor...');
                
                const controller = new AbortController();
                const fetchTimeout = setTimeout(() => controller.abort(), 15000);

                const payloadOrderInfo = { ...orderPayload };
                if (activeOrderId) {
                    payloadOrderInfo.id = activeOrderId;
                }

                const response = await fetch('/api/cashier/save-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order: payloadOrderInfo,
                        items: orderItemsPayload
                    }),
                    signal: controller.signal
                }).finally(() => clearTimeout(fetchTimeout));

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                    throw new Error(errData.error || `Error al guardar (${response.status})`);
                }

                const result = await response.json();
                const createdOrder = result.order;
                console.log(`✅ [Cashier] ORDEN GUARDADA (ID: ${createdOrder?.id})`);

                // UI SUCCESS FLOW
                if (createdOrder) {
                setLastOrderId(createdOrder.id);

                // AUTO-GUARDAR CLIENTE: si es llevar/domicilio y hay teléfono, guardar silenciosamente
                if ((orderType === 'takeout' || orderType === 'delivery') && customerInfo.phone?.trim() && customerInfo.name?.trim()) {
                    const autoSaveAddr = customerInfo.address || [customerInfo.street, customerInfo.neighborhood, customerInfo.reference].filter(Boolean).join(', ') || '';
                    fetch('/api/cashier/customers/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone: customerInfo.phone.trim(),
                            full_name: customerInfo.name.trim(),
                            address: autoSaveAddr
                        })
                    }).then(() => {
                        console.log('✅ [Cashier] Cliente guardado automáticamente.');
                    }).catch((err) => {
                        console.warn('⚠️ [Cashier] No se pudo guardar cliente automáticamente:', err?.message);
                    });
                }

                // Capturar copia del carrito ANTES de limpiar
                const cartSnapshot = [...cart];

                // Generar Ticket (Pre-cuenta o Final) — siempre, a menos que skipPrinting
                if (!skipPrinting) {
                    try {
                        handleOpenTicketModal({ ...createdOrder, is_pre_ticket: !isFinalPayment }, cartSnapshot);
                    } catch (printErr) {
                        console.error('⚠️ [Cashier] Error abriendo modal de ticket:', printErr);
                    }
                }

                // Solo mostrar success modal para pago final Y cuando no hay ticket abierto
                if (isFinalPayment && skipPrinting) {
                    setShowSuccessModal(true);
                    successModalRef.current = true;
                } else if (!isFinalPayment) {
                    // Pre-ticket: toast sutil
                    const toast = document.createElement('div');
                    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-[9999] font-black uppercase text-xs animate-in slide-in-from-top-10 fade-in';
                    toast.innerHTML = '<span class="material-icons-round align-middle mr-2">save</span> Cuenta Abierta Guardada';
                    document.body.appendChild(toast);
                    setTimeout(() => { toast.classList.add('animate-out', 'fade-out', 'slide-out-to-top-10'); setTimeout(() => toast.remove(), 300); }, 3000);
                }

                // SIEMPRE LIMPIAMOS TODO (Incluso en Solo Guardar) para liberar la máquina
                setCart([]);
                setTableNumber('');
                setActiveOrderId(null);
                setCustomerInfo({ name: '', phone: '', address: '', street: '', neighborhood: '', reference: '' });
                setShowPaymentModal(false);

                // ACTUALIZAR LA VISTA DE INMEDIATO PARA VER LA NUEVA CUENTA MÁS RÁPIDO
                setTimeout(() => fetchRecentOrders(false), 500);
            }

            setOrderLoading(false);
            isProcessingOrder.current = false;

        } catch (error: any) {
            console.error('🛑 [Cashier] ERROR EN PROCESO:', error);
            if (!isAbortError(error)) {
                alert(error.message || 'Error al procesar la orden');
            }
        } finally {
            setOrderLoading(false);
            isProcessingOrder.current = false;
        }
    };

    const handleCancelOrder = async (orderId?: number | string) => {
        const idToDelete = orderId || lastOrderId;
        if (!idToDelete) return;

        if (!window.confirm('¿Estás seguro de que deseas ELIMINAR esta cuenta? Esta acción no se puede deshacer.')) return;

        setOrderLoading(true);
        try {
            console.log(`🛑 [Cashier] Cancelando pedido ID: ${idToDelete}...`);

            const res = await fetch('/api/cashier/orders/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: idToDelete })
            });

            if (!res.ok) throw new Error('Error al cancelar en el servidor');

            // Success reset
            if (!orderId) {
                setShowSuccessModal(false);
                successModalRef.current = false;
                setShowTicketModal(false);
                setLastOrderId(null);
            }

            // Si la orden cancelada es la que tenemos activa, limpiar
            if (activeOrderId === idToDelete) {
                setActiveOrderId(null);
                setCart([]);
                setTableNumber('');
            }

            await fetchRecentOrders(false);
            console.log('✅ [Cashier] Pedido cancelado correctamente.');
        } catch (err: any) {
            console.error('❌ [Cashier] Error al cancelar:', err);
            alert('No se pudo cancelar el pedido: ' + err.message);
        } finally {
            setOrderLoading(false);
        }
    };

    useEffect(() => {
        let isEffectActive = true;
        let timeoutId: NodeJS.Timeout;

        // PERSISTENT BACKGROUND NOTIFICATION LISTENER
        const ordersChannel = supabase
            .channel('global_cashier_notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
                if (!isEffectActive) return;
                if (payload.new.order_source === 'web' || payload.new.order_type === 'delivery') {
                    // playNotificationSound(); // Desactivado por solicitud del usuario
                    setUnreadNotifications(prev => prev + 1);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cashier_notifications' }, (payload) => {
                if (!isEffectActive) return;
                // playNotificationSound(); // Desactivado por solicitud del usuario
                setUnreadNotifications(prev => prev + 1);
            })
            .subscribe();

        // Safe recursive sync to avoid AbortError and overlapping
        const runSync = async () => {
            if (!isEffectActive) return;
            
            if (isOnline) {
                try {
                    await fetchRecentOrders(false);
                } catch (err: any) {
                    // Ignore abort errors from the environment
                    if (!isAbortError(err)) {
                        console.error('Sync Error:', err);
                    }
                }
            }

            if (isEffectActive) {
                timeoutId = setTimeout(runSync, 20000); // ✅ FIX: 20s (was 7s) — Realtime handles instant updates
            }
        };

        runSync();

        return () => {
            isEffectActive = false;
            supabase.removeChannel(ordersChannel);
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isOnline]); // Depend on isOnline to restart/stop if needed

    const playNotificationSound = () => {
        try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (e) { }
    };

    const handleLogout = async () => {
        try {
            await signOut();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        }
    };

    const fetchRecentOrders = async (showLoading = true) => {
        if (showLoading) setRecentOrdersLoading(true);
        try {
            const userId = user?.id;
            const url = userId ? `/api/cashier/orders/list?userId=${userId}` : '/api/cashier/orders/list';
            const res = await fetch(url);
            if (!res.ok) throw new Error('Error al obtener lista de órdenes');
            
            const data = await res.json();
            
            if (data.success) {
                // Combinar cuentas abiertas primero, luego el historial
                const combined = [...data.openOrders, ...data.history];
                setRecentOrders(combined);
            }
        } catch (err) {
            console.error('❌ [Cashier] Error en fetchRecentOrders:', err);
        } finally {
            if (showLoading) setRecentOrdersLoading(false);
        }
    };

    // Removed the restricted useEffect for fetching - replaced by global listener

    const handleSaveCustomer = async (info: any) => {
        console.log('🚀 [Cashier] Intentando guardar cliente vía API...', info);
        try {
            if (!info.phone) throw new Error('El teléfono es obligatorio');
            
            const response = await fetch('/api/cashier/customers/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: info.phone.trim(),
                    full_name: info.name,
                    address: info.address || [info.street, info.neighborhood, info.reference].filter(Boolean).join(', ') || ''
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error desconocido en el servidor');
            }
            
            console.log(`✅ [Cashier] Cliente guardado con éxito vía API.`);
            
            // Feedback visual
            const toast = document.createElement('div');
            toast.className = `fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl z-[9999] font-black uppercase text-xs animate-in slide-in-from-top-10 fade-in`;
            toast.innerHTML = `<span class="material-icons-round align-middle mr-2">person_add</span> Cliente Guardado / Actualizado`;
            document.body.appendChild(toast);
            setTimeout(() => { 
                toast.classList.add('animate-out', 'fade-out', 'slide-out-to-top-10');
                setTimeout(() => toast.remove(), 300);
            }, 3000);

        } catch (error: any) {
            console.error('🛑 [Cashier] ERROR AL GUARDAR CLIENTE:', error.message);
            alert('Error al guardar cliente: ' + error.message);
        }
    };

    const handleWhatsAppShare = (order: any, items: any[]) => {
        const phone = '527411011595'; // Using the restaurant phone provided
        let message = `*🍕 Casaleña - Pedido #${order.ticket_number || order.id.toString().slice(-5)}*\n\n`;
        message += `*Cliente:* ${order.customer_name || (order.table_number ? 'Mesa ' + order.table_number : 'Venta Rápida')}\n`;
        message += `*Estado:* ${order.status?.toUpperCase()}\n`;
        message += `*Tipo:* ${order.order_type === 'delivery' ? '🏠 Domicilio' : order.order_type === 'takeout' ? '🛍️ Para llevar' : '🍽️ En mesa'}\n`;
        
        message += `\n*📦 Detalle del Pedido:*\n`;
        items.forEach(item => {
            message += `• *${item.quantity}x ${item.product_name}* (${item.selected_size}) - $${(item.unit_price * item.quantity).toFixed(2)}\n`;
            if (item.notes) message += `   _Nota: ${item.notes}_\n`;
        });
        
        message += `\n*💰 TOTAL A PAGAR: $${order.total_amount.toFixed(2)}*\n`;
        message += `\n¡Gracias por tu preferencia! 🔥\n_Casaleña Artisan Pizza_`;
        
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
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
                            onClick={() => setShowOrdersView(!showOrdersView)}
                            className={`h-10 px-3 shrink-0 flex items-center justify-center gap-2 rounded-xl border transition-all ${showOrdersView 
                                ? 'bg-[#f7951d] border-[#f7951d] text-white shadow-lg' 
                                : 'bg-white border-gray-200 text-[#8c785f] hover:bg-gray-50'}`}
                            title="Historial de Pedidos"
                        >
                            <span className="material-icons-round text-lg">{showOrdersView ? 'shopping_cart' : 'history'}</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">{showOrdersView ? 'Nueva Orden' : 'Historial'}</span>
                        </button>

                        <button
                            onClick={() => {
                                setShowNotifications(true);
                                setUnreadNotifications(0);
                            }}
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-orange-50 hover:text-[#F7941D] text-[#8c785f] transition-colors relative"
                            title="Notificaciones"
                        >
                            <span className="material-icons-round">notifications</span>
                            {unreadNotifications > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-sm">
                                    {unreadNotifications}
                                </span>
                            )}
                            {!isOnline && (
                                <span className="absolute -bottom-1 -right-1 bg-gray-400 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                                    <span className="material-icons-round text-[10px]">wifi_off</span>
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => setShowChat(true)}
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-purple-50 hover:text-purple-600 text-[#8c785f] transition-colors"
                            title="Chat Soporte"
                        >
                            <span className="material-icons-round">support_agent</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-gray-100 mr-1">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-black text-[#181511] leading-none uppercase">{user?.full_name || 'Cajero'}</p>
                                <p className="text-[9px] text-[#8c785f] font-black uppercase tracking-wider mt-0.5">Caja</p>
                            </div>
                            <div className="size-8 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[#f7951d] shrink-0">
                                <span className="material-icons-round text-sm">person</span>
                            </div>
                        </div>


                        <button
                            onClick={() => setShowOrdersView(!showOrdersView)}
                            className={`lg:hidden h-10 px-3 flex items-center justify-center gap-2 rounded-xl border transition-all ${showOrdersView 
                                ? 'bg-[#f7951d] border-[#f7951d] text-white shadow-lg' 
                                : 'bg-white border-gray-200 text-[#8c785f] hover:bg-gray-50'}`}
                        >
                            <span className="material-icons-round text-lg">{showOrdersView ? 'shopping_cart' : 'history'}</span>
                        </button>

                        <button
                            onClick={() => setShowCierreCaja(true)}
                            className="h-10 px-3 shrink-0 flex items-center justify-center gap-1.5 rounded-xl bg-[#181511] hover:bg-black text-white transition-colors text-xs font-black"
                            title="Cierre de Caja"
                        >
                            <span className="material-icons-round text-base">lock_clock</span>
                            <span className="hidden sm:inline">Cierre</span>
                        </button>

                        <button
                            onClick={handleLogout}
                            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-red-50 hover:text-red-500 text-[#8c785f] transition-colors"
                            title="Cerrar Sesión"
                        >
                            <span className="material-icons-round">logout</span>
                        </button>
                    </div>

                    {/* Mobile Cart Toggle Button */}
                    <button
                        onClick={() => setIsCartDrawerOpen(true)}
                        className="lg:hidden fixed bottom-6 right-6 z-[60] w-16 h-16 bg-[#f7951d] text-white rounded-full shadow-[0_10px_30px_rgba(247,149,29,0.4)] flex items-center justify-center active:scale-90 transition-all active:bg-[#e0861a]"
                    >
                        <div className="relative">
                            <span className="material-icons-round text-3xl">shopping_cart</span>
                            {cart.length > 0 && (
                                <span className="absolute -top-2 -right-2 bg-white text-[#f7951d] text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-[#f7951d]">
                                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                                </span>
                            )}
                        </div>
                    </button>
                </header>

                {/* Main Content Area */}
                <div className="flex-1 flex overflow-hidden bg-[#f8f7f5]">
                    {showOrdersView ? (
                        /* ORDERS HISTORY VIEW */
                        <section className="flex-1 p-6 overflow-y-auto scrollbar-hide animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-3xl font-black text-[#181511] tracking-tight">Registro de Todos los Pedidos</h2>
                                    <p className="text-sm text-[#8c785f] font-medium">Visualización de ventas y estados en tiempo real.</p>
                                </div>
                                <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100 overflow-x-auto scrollbar-hide">
                                    {['Todos', 'Abiertas', 'Pendiente', 'Preparando', 'Entregado'].map(f => (
                                        <button 
                                            key={f}
                                            onClick={() => setRecentOrdersFilter(f)}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all whitespace-nowrap ${recentOrdersFilter === f ? 'bg-[#f7951d] text-white' : 'text-[#8c785f] hover:bg-gray-50'}`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {recentOrdersLoading ? (
                                <div className="flex flex-col items-center justify-center h-64">
                                    <div className="w-12 h-12 border-4 border-[#f7951d] border-t-transparent rounded-full animate-spin mb-4"></div>
                                    <p className="font-black text-gray-400 uppercase tracking-widest text-xs">Cargando historial...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {(() => {
                                        const filtered = recentOrders.filter(o => {
                                            if (searchQuery.trim()) {
                                                const query = searchQuery.toLowerCase().replace('#', '');
                                                const matchesSearch = 
                                                    String(o.id).includes(query) || 
                                                    (o.customer_name && o.customer_name.toLowerCase().includes(query)) ||
                                                    (o.ticket_number && String(o.ticket_number).includes(query)) ||
                                                    (o.table_number && String(o.table_number).includes(query));
                                                
                                                if (!matchesSearch) return false;
                                            }

                                            if (recentOrdersFilter === 'Todos') return true;
                                            if (recentOrdersFilter === 'Abiertas') return ['pendiente', 'preparando', 'listo'].includes(o.status) && o.order_type === 'dine-in';
                                            if (recentOrdersFilter === 'Pendiente') return o.status === 'confirmado';
                                            if (recentOrdersFilter === 'Preparando') return o.status === 'preparando' || o.status === 'listo';
                                            if (recentOrdersFilter === 'Entregado') return o.status === 'entregado';
                                            return true;
                                        });

                                        if (filtered.length === 0) {
                                            return (
                                                <div className="col-span-full h-96 flex flex-col items-center justify-center text-center p-8 animate-in fade-in zoom-in duration-500">
                                                    <div className="size-24 bg-gray-50 text-gray-200 rounded-full flex items-center justify-center mb-6">
                                                        <span className="material-icons-round text-5xl">{searchQuery ? 'search_off' : 'receipt_long'}</span>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-[#181511] mb-2">
                                                        {searchQuery ? 'No se encontró el pedido' : 'Sin pedidos registrados'}
                                                    </h3>
                                                    <p className="text-[#8c785f] text-sm max-w-xs mx-auto font-medium">
                                                        {searchQuery 
                                                            ? `No pudimos encontrar nada que coincida con "${searchQuery}". Revisa el ID o el nombre.`
                                                            : 'Aún no hay pedidos en esta categoría para el periodo actual.'}
                                                    </p>
                                                    {searchQuery && (
                                                        <button 
                                                            onClick={() => setSearchQuery('')}
                                                            className="mt-8 px-8 py-3 bg-[#181511] text-white rounded-xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                                                        >
                                                            Limpiar Búsqueda
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        }

                                        return filtered.map((order) => (
                                            <div key={order.id} className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-xl transition-all group overflow-hidden relative">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500 opacity-50"></div>
                                                
                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="px-2 py-0.5 bg-[#f7951d]/10 text-[#f7951d] rounded text-[10px] font-black italic">#{order.ticket_number || 'S/N'}</span>
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                                order.status === 'entregado' ? 'bg-green-100 text-green-700' :
                                                                ['pendiente', 'preparando', 'listo'].includes(order.status) ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                                                order.status === 'confirmado' ? 'bg-blue-100 text-blue-700' :
                                                                'bg-orange-100 text-orange-700'
                                                            }`}>
                                                                {order.status === 'entregado' ? 'Finalizado' : ['pendiente', 'preparando', 'listo'].includes(order.status) ? 'En Mesa' : order.status === 'confirmado' ? 'Recibido' : order.status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div>
                                                            <p className="text-xl font-black text-[#181511] tracking-tight leading-none mb-1">
                                                                {order.customer_name || (order.table_number ? `Mesa #${order.table_number}` : `Orden #${order.ticket_number || order.id.toString().slice(-4).toUpperCase()}`)}
                                                            </p>
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                                    {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • {order.order_type === 'delivery' ? 'Domicilio' : 'Local'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p className="text-2xl font-black text-[#181511] tracking-tighter leading-none">${order.total_amount.toFixed(2)}</p>
                                                    </div>

                                                    <div className="space-y-2 mb-6">
                                                        {order.order_items?.map((item: any, i: number) => (
                                                            <div key={i} className="flex justify-between items-center text-xs">
                                                                <span className="text-[#8c785f] font-medium"><span className="font-black text-[#181511]">{item.quantity}x</span> {item.product_name}</span>
                                                                <span className="font-bold text-[#181511]">${(item.unit_price * item.quantity).toFixed(2)}</span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2 mt-auto">
                                                        {['pendiente', 'preparando', 'listo'].includes(order.status) && (
                                                            <>
                                                                <button 
                                                                    onClick={() => {
                                                                        setShowOrdersView(false);
                                                                        setOrderType(order.order_type || 'dine-in');
                                                                        setTableNumber(order.table_number || '');
                                                                        setActiveOrderId(order.id);
                                                                        setPaymentMethod(order.payment_method || 'efectivo');
                                                                        setCustomerInfo({
                                                                            name: order.customer_name || '',
                                                                            phone: order.phone_number || '',
                                                                            address: order.delivery_address || '',
                                                                            street: (order.delivery_address || '').split(',')[0] || '',
                                                                            neighborhood: (order.delivery_address || '').split(',')[1] || '',
                                                                            reference: ''
                                                                        });
                                                                        const loadedCart = (order.order_items || []).map((item: any) => ({
                                                                            id: item.product_id ?? item.id ?? 0,
                                                                            name: item.product_name,
                                                                            price: item.unit_price,
                                                                            quantity: item.quantity,
                                                                            selectedSize: item.selected_size,
                                                                            extras: (function() {
                                                                                if (!item.extras) return [];
                                                                                if (typeof item.extras === 'string') {
                                                                                    try { return JSON.parse(item.extras); } catch(e) { return []; }
                                                                                }
                                                                                if (Array.isArray(item.extras)) return item.extras;
                                                                                return [];
                                                                            })(),
                                                                            note: item.notes || '',
                                                                            cartItemId: Math.random().toString(36).substr(2, 9),
                                                                            _originalProductId: item.product_id // preserve for API
                                                                        }));
                                                                        setCart(loadedCart);
                                                                    }}
                                                                    className="bg-purple-50 text-purple-600 border border-purple-100 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-purple-100 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                                >
                                                                    <span className="material-icons-round text-sm">edit_note</span>
                                                                    Abrir
                                                                </button>
                                                                <button 
                                                                    onClick={() => {
                                                                        setShowOrdersView(false);
                                                                        setOrderType(order.order_type || 'dine-in');
                                                                        setTableNumber(order.table_number || '');
                                                                        setActiveOrderId(order.id);
                                                                        setPaymentMethod(order.payment_method || 'efectivo');
                                                                        const loadedCart = (order.order_items || []).map((item: any) => ({
                                                                            id: item.product_id ?? item.id ?? 0,
                                                                            name: item.product_name,
                                                                            price: item.unit_price,
                                                                            quantity: item.quantity,
                                                                            selectedSize: item.selected_size,
                                                                            extras: (function() {
                                                                                if (!item.extras) return [];
                                                                                if (typeof item.extras === 'string') {
                                                                                    try { return JSON.parse(item.extras); } catch(e) { return []; }
                                                                                }
                                                                                if (Array.isArray(item.extras)) return item.extras;
                                                                                return [];
                                                                            })(),
                                                                            note: item.notes || '',
                                                                            cartItemId: Math.random().toString(36).substr(2, 9),
                                                                            _originalProductId: item.product_id // preserve for API
                                                                        }));
                                                                        setCart(loadedCart);
                                                                        setTimeout(() => {
                                                                            isProcessingOrder.current = false;
                                                                            setOrderLoading(false);
                                                                            setShowPaymentModal(true);
                                                                        }, 150);
                                                                    }}
                                                                    className="bg-[#181511] text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                                >
                                                                    <span className="material-icons-round text-sm">payments</span>
                                                                    Cobrar
                                                                </button>
                                                            </>
                                                        )}
                                                        <button 
                                                            onClick={() => {
                                                                const mappedItems = (order.order_items || []).map((it: any) => ({
                                                                    quantity: it.quantity || 0,
                                                                    name: it.product_name || '',
                                                                    price: it.unit_price || 0,
                                                                    product_name: it.product_name,
                                                                    unit_price: it.unit_price,
                                                                    selected_size: it.selected_size,
                                                                    notes: it.notes
                                                                }));
                                                                handleWhatsAppShare(order, mappedItems);
                                                            }}
                                                            className="bg-green-500 text-white py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                        >
                                                            <span className="material-icons-round text-sm">send</span>
                                                            WhatsApp
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                const mappedItems = (order.order_items || []).map((it: any) => ({
                                                                    quantity: it.quantity || 0,
                                                                    name: it.product_name || '',
                                                                    price: it.unit_price || 0,
                                                                    selectedSize: it.selected_size,
                                                                    extras: it.extras
                                                                }));
                                                                handleOpenTicketModal(order, mappedItems);
                                                            }}
                                                            className="bg-[#181511]/10 text-[#181511] py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-[#181511]/20 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                                                        >
                                                            <span className="material-icons-round text-sm">receipt_long</span>
                                                            Ticket
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            )}
                        </section>
                    ) : (
                        /* Products Section - No Horizontal Scroll */
                        <section className="flex-1 p-3 lg:p-4 overflow-hidden flex flex-col">
                            {/* Categories Selection - Full Width Grid at the top to avoid scroll */}
                            <div className="mb-3 shrink-0">
                                <h4 className="text-[10px] font-black text-[#f7951d] uppercase tracking-[2px] mb-2 px-1">Paso 1: Categoría</h4>
                                <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-10 gap-1 lg:gap-1.5">
                                    {[...categories].sort((a, b) => {
                                        const getPriority = (name: string) => {
                                            const n = name.toUpperCase();
                                            if (n.includes('TRADICIONAL')) return 1;
                                            if (n.includes('ESPECIALIDAD')) return 2;
                                            if (n.includes('GOURMET')) return 3;
                                            if (n.includes('ORILLA')) return 4;
                                            if (n.includes('COMBO')) return 5;
                                            return 10;
                                        };
                                        return getPriority(a.name) - getPriority(b.name);
                                    }).map((cat) => {
                                        // User requested cleaner names
                                        const displayNames: Record<string, string> = {
                                            'PIZZAS TRADICIONALES': 'Tradicionales',
                                            'ESPECIALIDADES CASALEÑA': 'Especialidades',
                                            'ESPECIALIDADES': 'Especialidades',
                                            'GOURMET': 'Gourmet',
                                            'ORILLA DE QUESO (EXTRA)': 'ORILLA RELLENA',
                                            'ORILLAFRESCA': 'ORILLA RELLENA',
                                            'ENTRADAS Y SNACKS': 'Snacks',
                                            'HAMBURGUESAS': 'Hamburguesas',
                                            'BEBIDAS': 'Bebidas',
                                            'POSTRES': 'Postres',
                                            'PIZZA & FRIENDS - COMBOS': 'Combos',
                                            'COMBOS': 'Combos'
                                        };
                                        const cleanName = displayNames[cat.name.toUpperCase()] || cat.name;

                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => setSelectedCategory(cat.id)}
                                                className={`flex flex-col lg:flex-row items-center justify-center gap-1 rounded-lg py-3 px-0.5 lg:px-2 transition-all border ${selectedCategory === cat.id
                                                    ? 'bg-[#f7951d] border-[#f7951d] text-white shadow-md scale-[1.02]'
                                                    : 'bg-white border-gray-100 text-[#8c785f] hover:bg-gray-50'
                                                    }`}
                                            >
                                                <span className="material-icons-round text-base">
                                                    {cat.name.toLowerCase().includes('pizza') ? 'local_pizza' :
                                                        cat.name.toLowerCase().includes('especialidades') ? 'local_pizza' :
                                                            cat.name.toLowerCase().includes('gourmet') ? 'local_pizza' :
                                                                cat.name.toLowerCase().includes('combo') ? 'loyalty' :
                                                                    cat.name.toLowerCase().includes('orilla') ? 'add_circle' :
                                                                        cat.name.toLowerCase().includes('bebida') ? 'local_drink' :
                                                                            cat.name.toLowerCase().includes('hamburguesa') ? 'lunch_dining' :
                                                                                cat.name.toLowerCase().includes('postre') ? 'cake' :
                                                                                    cat.name.toLowerCase().includes('snack') || cat.name.toLowerCase().includes('entrada') ? 'fastfood' :
                                                                                        'restaurant'}
                                                </span>
                                                <span className="text-[10px] lg:text-[11px] xl:text-[13px] font-black uppercase tracking-tight text-center leading-[1.1] truncate w-full px-1">
                                                    {cleanName}
                                                </span>
                                            </button>
                                        );
                                    })}

                                    {/* TODAS moved to the end */}
                                    <button
                                        onClick={() => setSelectedCategory('all')}
                                        className={`flex flex-col lg:flex-row items-center justify-center gap-1 rounded-lg py-3 px-1 transition-all border ${selectedCategory === 'all'
                                            ? 'bg-[#f7951d] border-[#f7951d] text-white shadow-md scale-[1.02]'
                                            : 'bg-white border-gray-100 text-[#8c785f] hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="material-icons-round text-base">apps</span>
                                        <span className="text-[10px] lg:text-[11px] xl:text-[13px] font-black uppercase tracking-tight text-center">Todas</span>
                                    </button>
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
                                <h4 className="text-[10px] font-black text-[#f7951d] uppercase tracking-[2px] mb-3 px-1 sticky top-0 z-20 bg-[#f8f7f5]/80 backdrop-blur-sm py-1">Paso 2: Selecciona Productos</h4>
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
                                                            {categoryProducts.sort((a, b) => {
                                                                const mapToOrder = (name: string, catName: string) => {
                                                                    const n = name.toLowerCase();
                                                                    const cn = catName.toUpperCase();

                                                                    if (cn.includes('BEBIDA')) {
                                                                        const order = [
                                                                            'refrescos 600', 'coca-cola de lata', 'coca-cola 2 l', 'refrescos de sabor 2 l',
                                                                            'jugo del valle', 'piña colada', 'fresa', 'chocolate', 'limonada mineral',
                                                                            'jarra de limonada', 'copa de clericot', 'jarra de clericot', 'soda italiana',
                                                                            'agua natural', 'capuccino'
                                                                        ];
                                                                        const idx = order.findIndex(p => n.includes(p));
                                                                        return idx !== -1 ? idx : 100;
                                                                    }

                                                                    if (cn.includes('ESPECIALIDAD')) {
                                                                        const order = [
                                                                            'hawaiana especial', 'casaleña', 'mexicana', 'carnívora',
                                                                            'diabla', 'italiana', 'caprichosa'
                                                                        ];
                                                                        const idx = order.findIndex(p => n.includes(p));
                                                                        return idx !== -1 ? idx : 100;
                                                                    }

                                                                    return 100;
                                                                };

                                                                const orderA = mapToOrder(a.name, category.name);
                                                                const orderB = mapToOrder(b.name, category.name);

                                                                if (orderA !== orderB) return orderA - orderB;
                                                                return a.name.localeCompare(b.name);
                                                            }).map((group) => (
                                                                <div
                                                                    key={group.name}
                                                                    onClick={() => openProductCustomizer(group)}
                                                                    className="bg-white p-2 rounded-xl border border-gray-100 flex flex-col group hover:border-[#f7951d] transition-all cursor-pointer relative"
                                                                >
                                                                    {/* Compact Image */}
                                                                    <div className="relative w-full aspect-square bg-[#F2F2F7] rounded-lg mb-1.5 overflow-hidden">
                                                                        <img
                                                                            src={group.imagen_url || "/icon.png"}
                                                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                                            alt={group.name}
                                                                            onError={(e) => {
                                                                                (e.target as HTMLImageElement).src = "/icon.png";
                                                                                (e.target as HTMLImageElement).className = "w-full h-full object-contain p-2";
                                                                            }}
                                                                        />
                                                                        <div className="absolute bottom-1 right-1 bg-white/95 px-1 py-0.5 rounded text-[10px] font-black shadow-sm text-[#181511]">
                                                                            ${group.basePrice}
                                                                        </div>
                                                                    </div>

                                                                    {/* Compact Content */}
                                                                    <div className="flex flex-col gap-0.5">
                                                                        <h3 className="font-bold text-[10px] lg:text-[11px] text-[#1D1D1F] leading-tight line-clamp-1">
                                                                            {group.name}
                                                                        </h3>
                                                                        <p className="text-[8px] text-[#8c785f] font-medium line-clamp-1 mb-0.5">
                                                                            {group.description || 'Pizza artesanal preparada al momento'}
                                                                        </p>
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
                                                <p className="font-bold mb-4">No se encontraron productos</p>
                                                <button 
                                                    onClick={() => {
                                                        setSearchQuery('');
                                                        setSelectedCategory('all');
                                                        fetchMenu();
                                                    }}
                                                    className="px-6 py-3 bg-[#181511] text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center gap-2"
                                                >
                                                    <span className="material-icons-round text-sm">refresh</span>
                                                    Limpiar Filtros y Reintentar
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </main>

            {/* CART BACKDROP (Mobile) */}
            {isCartDrawerOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70] lg:hidden animate-in fade-in duration-300"
                    onClick={() => setIsCartDrawerOpen(false)}
                />
            )}

            {/* RIGHT SIDEBAR - Separated into component */}
            <CashierSidebar
                cashierName={cashierName}
                isCartDrawerOpen={isCartDrawerOpen}
                setIsCartDrawerOpen={setIsCartDrawerOpen}
                cart={cart}
                setCart={setCart}
                isSyncing={isSyncing}
                isOnline={isOnline}
                pendingCount={pendingCount}
                orderType={orderType}
                setOrderType={setOrderType}
                recentOrders={recentOrders}
                activeOrderId={activeOrderId}
                setActiveOrderId={setActiveOrderId}
                tableNumber={tableNumber}
                setTableNumber={setTableNumber}
                setPaymentMethod={setPaymentMethod}
                customerInfo={customerInfo}
                setCustomerInfo={setCustomerInfo}
                customerInsights={customerInsights}
                handleSaveCustomer={handleSaveCustomer}
                setLoadingClients={setLoadingClients}
                setShowCustomerModal={setShowCustomerModal}
                setAvailableClients={setAvailableClients}
                setFoundCustomers={setFoundCustomers}
                updateQuantity={updateQuantity}
                groupedProducts={groupedProducts}
                openProductCustomizer={openProductCustomizer}
                setShowOpenTabsModal={setShowOpenTabsModal}
                cartTotals={cartTotals}
                clearCart={clearCart}
                isProcessingOrder={isProcessingOrder}
                orderLoading={orderLoading}
                setOrderLoading={setOrderLoading}
                setShowPaymentModal={setShowPaymentModal}
                handlePlaceOrder={handlePlaceOrder}
            />

            {/* ── CUENTAS ABIERTAS MODAL ── */}
            {showOpenTabsModal && (
                <div className="fixed inset-0 z-[150] flex">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowOpenTabsModal(false)} />

                    {/* Slide-over panel from the right */}
                    <div className="relative ml-auto w-full max-w-md bg-white h-full flex flex-col shadow-2xl animate-in slide-in-from-right-8 duration-300">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-2xl font-black text-[#181511] tracking-tight">Cuentas Abiertas</h2>
                                <p className="text-xs text-[#8c785f] font-bold mt-0.5">
                                    {recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status) && o.payment_status !== 'paid').length} cuenta(s) pendiente(s) de cobro
                                </p>
                            </div>
                            <button
                                onClick={() => setShowOpenTabsModal(false)}
                                className="size-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                            >
                                <span className="material-icons-round text-xl">close</span>
                            </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {recentOrders.filter(o => ['pendiente', 'preparando', 'listo', 'confirmado'].includes(o.status) && o.payment_status !== 'paid').length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-in fade-in zoom-in duration-300">
                                    <div className="size-20 bg-gray-50 text-gray-200 rounded-full flex items-center justify-center mb-6">
                                        <span className="material-icons-round text-4xl">receipt_long</span>
                                    </div>
                                    <h3 className="text-xl font-black text-[#181511] mb-2">Sin Cuentas Abiertas</h3>
                                    <p className="text-[#8c785f] text-sm max-w-[200px] font-medium leading-relaxed">
                                        No hay pedidos activos en este momento. ¡Todo está al día!
                                    </p>
                                    <button 
                                        onClick={() => {
                                            setShowOpenTabsModal(false);
                                            setOrderType('dine-in');
                                        }}
                                        className="mt-8 px-6 py-3 bg-[#f7951d] text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95 transition-all"
                                    >
                                        Comenzar Nueva Orden
                                    </button>
                                </div>
                            ) : (
                                recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status) && o.payment_status !== 'paid').map(order => (
                                    <div key={order.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                        {/* Card header */}
                                        <div className="flex items-center justify-between p-4 border-b border-gray-50">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-xl bg-purple-50 flex items-center justify-center">
                                                    <span className="material-icons-round text-purple-600">
                                                        {order.order_type === 'takeout' ? 'shopping_bag' : 'table_restaurant'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-black text-[#181511]">
                                                        {order.table_number ? `Mesa ${order.table_number}` : (order.customer_name || `PARA LLEVAR #${order.ticket_number}`)}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 font-bold uppercase">
                                                        {new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · #{order.id.toString().slice(-5)}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="text-2xl font-black text-[#f7951d]">${order.total_amount?.toFixed(2)}</span>
                                        </div>

                                        {/* Items */}
                                        <div className="px-4 py-3 space-y-1.5">
                                            {(order.order_items || []).slice(0, 4).map((item: any, i: number) => (
                                                <div key={i} className="flex justify-between text-xs">
                                                    <span className="text-[#8c785f] font-medium">
                                                        <span className="font-black text-[#181511]">{item.quantity}x</span> {item.product_name}
                                                        {item.selected_size && <span className="text-gray-300"> · {item.selected_size}</span>}
                                                    </span>
                                                    <span className="font-bold text-[#181511]">${(item.unit_price * item.quantity).toFixed(2)}</span>
                                                </div>
                                            ))}
                                            {(order.order_items || []).length > 4 && (
                                                <p className="text-[10px] text-gray-400 font-bold">+{(order.order_items || []).length - 4} más...</p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex gap-2 p-4 pt-2">
                                            <button
                                                onClick={() => {
                                                    // Load order into cart
                                                    setOrderType(order.order_type || 'dine-in');
                                                    setTableNumber(order.table_number || '');
                                                    setActiveOrderId(order.id);
                                                    
                                                    if (order.order_type !== 'dine-in') {
                                                        setCustomerInfo({
                                                            name: order.customer_name || '',
                                                            phone: order.phone_number || '',
                                                            address: order.delivery_address || '',
                                                            street: (order.delivery_address || '').split(',')[0] || '',
                                                            neighborhood: (order.delivery_address || '').split(',')[1] || '',
                                                            reference: ''
                                                        });
                                                    }

                                                    const loadedCart = (order.order_items || []).map((item: any) => ({
                                                        id: item.product_id ?? 0,
                                                        name: item.product_name,
                                                        price: item.unit_price,
                                                        quantity: item.quantity,
                                                        selectedSize: item.selected_size,
                                                        extras: (function() {
                                                            if (!item.extras) return [];
                                                            if (typeof item.extras === 'string') {
                                                                try { return JSON.parse(item.extras); } catch(e) { return []; }
                                                            }
                                                            if (Array.isArray(item.extras)) return item.extras;
                                                            return [];
                                                        })(),
                                                        note: item.notes || '',
                                                        cartItemId: Math.random().toString(36).substr(2, 9),
                                                        _originalProductId: item.product_id
                                                    }));
                                                    setCart(loadedCart);
                                                    setShowOpenTabsModal(false);
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 bg-[#f8f7f5] text-[#181511] border border-gray-200 py-3 rounded-xl text-xs font-black hover:bg-gray-100 transition-all active:scale-95"
                                            >
                                                <span className="material-icons-round text-base">add_circle</span>
                                                Agregar Más
                                            </button>
                                            <button
                                                onClick={() => {
                                                    // Load and go directly to payment
                                                    setOrderType(order.order_type || 'dine-in');
                                                    if (order.table_number) setTableNumber(order.table_number);
                                                    else setTableNumber('');
                                                    
                                                    setActiveOrderId(order.id);
                                                    
                                                    if (order.order_type !== 'dine-in') {
                                                        setCustomerInfo({
                                                            name: order.customer_name || '',
                                                            phone: order.phone_number || '',
                                                            address: order.delivery_address || '',
                                                            street: (order.delivery_address || '').split(',')[0] || '',
                                                            neighborhood: (order.delivery_address || '').split(',')[1] || '',
                                                            reference: ''
                                                        });
                                                    }
                                                    
                                                    // ALWAYS load items into cart so the payment modal sees the total
                                                    const loadedCart = (order.order_items || []).map((item: any) => ({
                                                        id: item.product_id ?? 0,
                                                        name: item.product_name,
                                                        price: item.unit_price,
                                                        quantity: item.quantity,
                                                        selectedSize: item.selected_size,
                                                        extras: (function() {
                                                            if (!item.extras) return [];
                                                            if (typeof item.extras === 'string') {
                                                                try { return JSON.parse(item.extras); } catch(e) { return []; }
                                                            }
                                                            if (Array.isArray(item.extras)) return item.extras;
                                                            return [];
                                                        })(),
                                                        note: item.notes || '',
                                                        cartItemId: Math.random().toString(36).substr(2, 9),
                                                        _originalProductId: item.product_id
                                                    }));
                                                    setCart(loadedCart);
                                                    
                                                    setShowOpenTabsModal(false);
                                                    setShowPaymentModal(true);
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 bg-[#181511] text-white py-3 rounded-xl text-xs font-black hover:bg-black transition-all active:scale-95 shadow-lg"
                                            >
                                                <span className="material-icons-round text-base">payments</span>
                                                Cobrar
                                            </button>
                                            <button
                                                onClick={() => handleCancelOrder(order.id)}
                                                className="px-4 bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-100"
                                                title="Eliminar Cuenta"
                                            >
                                                <span className="material-icons-round text-xl">delete_outline</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer refresh button */}
                        <div className="p-4 border-t border-gray-100 shrink-0">
                            <button
                                onClick={() => fetchRecentOrders(false)}
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 text-gray-500 text-xs font-black hover:bg-gray-100 transition-all"
                            >
                                <span className="material-icons-round text-sm">refresh</span>
                                Actualizar Lista
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                        <div className="flex flex-wrap gap-2">
                                            {EXTRAS_OPTIONS.map(extra => {
                                                const isSelected = selectedExtras.includes(extra.id);
                                                return (
                                                    <button
                                                        key={extra.id}
                                                        onClick={() => setSelectedExtras(prev => isSelected ? prev.filter(id => id !== extra.id) : [...prev, extra.id])}
                                                        className={`px-4 py-3 rounded-xl border-2 flex flex-col items-start transition-all min-w-[120px] flex-1 sm:flex-none ${isSelected ? 'border-[#f7951d] bg-[#f7951d] text-white shadow-md' : 'border-gray-100 bg-gray-50 text-gray-900 hover:bg-white'}`}
                                                    >
                                                        <div className="flex justify-between items-center w-full mb-0.5">
                                                            <span className="text-[10px] font-black uppercase tracking-wider leading-none">{extra.name}</span>
                                                            {isSelected && <span className="material-icons-round text-xs">check_circle</span>}
                                                        </div>
                                                        <span className={`text-[10px] font-black ${isSelected ? 'text-white/80' : 'text-[#f7951d]'}`}>+${extra.price}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Special Instructions Note */}
                                    <div>
                                        <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-2">
                                            <span className="size-2 bg-amber-400 rounded-full"></span> Nota / Instrucciones Especiales
                                        </h4>
                                        <div className="relative">
                                            <textarea
                                                value={itemNote}
                                                onChange={(e) => setItemNote(e.target.value)}
                                                placeholder="Ej: sin champiñón, poco chile, orilla de gouda, quitar aceituna..."
                                                maxLength={120}
                                                rows={2}
                                                className="w-full bg-amber-50 border-2 border-amber-100 rounded-xl px-4 py-3 text-sm font-medium text-[#181511] placeholder-amber-300 focus:border-amber-400 outline-none resize-none transition-all"
                                            />
                                            {itemNote.length > 0 && (
                                                <span className="absolute bottom-2 right-3 text-[9px] font-bold text-amber-400">{itemNote.length}/120</span>
                                            )}
                                        </div>
                                        {itemNote.length > 0 && (
                                            <button
                                                onClick={() => setItemNote('')}
                                                className="mt-1 text-[10px] font-bold text-amber-500 hover:text-red-500 transition-colors"
                                            >
                                                ✕ Borrar nota
                                            </button>
                                        )}
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
                                    <button onClick={() => { setSelectedGroupedProduct(null); setIsHalfAndHalf(false); setSecondHalf(null); setItemNote(''); }} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-widest">Cancelar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Payment Modal */}
            {
                showPaymentModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
                        <div className="bg-[#f8f7f5] w-full max-w-lg rounded-[32px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
                                <h3 className="text-xl font-black uppercase tracking-tight text-[#181511]">Cobro de Pedido</h3>
                                <button onClick={() => setShowPaymentModal(false)} className="size-10 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-90">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
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

                                {/* Datos del cliente para takeout / delivery */}
                                {(orderType === 'takeout' || orderType === 'delivery') && (
                                    <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 space-y-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[10px] font-black text-[#f7951d] uppercase tracking-widest">
                                                {orderType === 'delivery' ? 'Datos de Entrega' : 'Datos del Cliente'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const addr = customerInfo.address || '';
                                                    const parts = addr.split(',').map((p: string) => p.trim());
                                                    setCustomerInfo(prev => ({
                                                        ...prev,
                                                        street: prev.street || parts[0] || '',
                                                        neighborhood: prev.neighborhood || parts[1] || '',
                                                        reference: prev.reference || parts.slice(2).join(', ') || '',
                                                    }));
                                                    setLoadingClients(true);
                                                    setShowCustomerModal(true);
                                                    setShowPaymentModal(false);
                                                    try {
                                                        const res = await fetch('/api/cashier/customers/search');
                                                        if (res.ok) {
                                                            const data = await res.json();
                                                            const mapped = (data.customers || []).map((c: any) => ({
                                                                id: c.id,
                                                                name: c.full_name || 'Sin Nombre',
                                                                phone: c.phone || '',
                                                                address: c.address || '',
                                                                origin: c.is_app_user ? 'profile' : 'customer',
                                                            }));
                                                            setAvailableClients(mapped);
                                                            setFoundCustomers(mapped);
                                                        }
                                                    } catch { /* ignore */ } finally {
                                                        setLoadingClients(false);
                                                    }
                                                }}
                                                className="flex items-center gap-1 text-[9px] font-black text-[#f7951d] uppercase bg-white border border-orange-200 px-2 py-1 rounded-lg hover:bg-orange-50 transition-all"
                                            >
                                                <span className="material-icons-round text-xs">manage_search</span>
                                                Buscar
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-orange-100">
                                            <span className="material-icons-round text-xs text-gray-300">person</span>
                                            <input
                                                type="text"
                                                placeholder="Nombre del cliente"
                                                value={customerInfo.name || ''}
                                                onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                                className="flex-1 text-xs font-black text-[#181511] outline-none bg-transparent placeholder-gray-300"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-orange-100">
                                            <span className="material-icons-round text-xs text-gray-300">phone</span>
                                            <input
                                                type="tel"
                                                placeholder="Teléfono"
                                                value={customerInfo.phone || ''}
                                                onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                                className="flex-1 text-xs font-black text-[#181511] outline-none bg-transparent placeholder-gray-300"
                                            />
                                        </div>
                                        {orderType === 'delivery' && (
                                            <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-orange-100">
                                                <span className="material-icons-round text-xs text-gray-300">location_on</span>
                                                <input
                                                    type="text"
                                                    placeholder="Dirección completa"
                                                    value={customerInfo.address || ''}
                                                    onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                                    className="flex-1 text-xs font-black text-[#181511] outline-none bg-transparent placeholder-gray-300"
                                                />
                                            </div>
                                        )}
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
                                                    onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                                    onFocus={(e) => (e.target as HTMLInputElement).select()}
                                                    className="w-full outline-none bg-transparent placeholder-gray-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                    placeholder="0.00"
                                                    step="any"
                                                />
                                            </div>
                                        </div>

                                        {/* Botones de Pago Rápido */}
                                        <div className="grid grid-cols-4 gap-2">
                                            <button onClick={() => setAmountPaid(cartTotals.total.toString())} className="py-2 bg-green-50 text-green-700 border border-green-100 rounded-xl text-[10px] font-black hover:bg-green-100 transition-all">EXACTO</button>
                                            {[20, 50, 100, 200, 500].map(val => (
                                                <button key={val} onClick={() => setAmountPaid(val.toString())} className="py-2 bg-gray-50 text-gray-600 border border-gray-100 rounded-xl text-[10px] font-black hover:bg-gray-100 transition-all">${val}</button>
                                            ))}
                                            <button onClick={() => setAmountPaid((Math.ceil(cartTotals.total / 50) * 50).toString())} className="py-2 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl text-[10px] font-black hover:bg-blue-100 transition-all">REDONDEO</button>
                                            <button onClick={() => setAmountPaid('')} className="py-2 bg-red-50 text-red-700 border border-red-100 rounded-xl text-[10px] font-black hover:bg-red-100 transition-all">LIMPIAR</button>
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

                                <div className="flex flex-col gap-3 pt-2">
                                    {orderType === 'dine-in' && (
                                        <button
                                            onClick={() => {
                                                isProcessingOrder.current = false;
                                                setOrderLoading(false);
                                                setTimeout(() => handlePlaceOrder(false), 50);
                                            }}
                                            disabled={!tableNumber.trim() || cart.length === 0}
                                            className="w-full bg-white border-2 border-[#181511] text-[#181511] font-black py-4 rounded-2xl shadow-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-icons-round">print</span>
                                            {orderLoading ? 'PROCESANDO...' : 'SOLO IMPRIMIR (CUENTA ABIERTA)'}
                                        </button>                                    )}

                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => {
                                                isProcessingOrder.current = false;
                                                setOrderLoading(false);
                                                setTimeout(() => handlePlaceOrder(true), 50);
                                            }}
                                            disabled={
                                                orderLoading ||
                                                (paymentMethod === 'efectivo' && orderType !== 'delivery' && !isSufficientPayment) ||
                                                (orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address)) ||
                                                (orderType === 'dine-in' && !tableNumber.trim()) ||
                                                cart.length === 0
                                            }
                                            className="w-full bg-[#f7951d] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-icons-round">{orderType === 'dine-in' ? 'check_circle' : 'receipt_long'}</span>
                                            {orderLoading ? 'PROCESANDO...' :
                                                (orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address)) ? 'FALTA DATOS CLIENTE' :
                                                    (orderType === 'dine-in' && !tableNumber.trim()) ? 'FALTA MESA' :
                                                        (orderType === 'dine-in' ? 'COBRAR MESA Y FINALIZAR' : 'FINALIZAR E IMPRIMIR')}
                                        </button>

                                        {(orderType === 'takeout' || orderType === 'delivery') && activeOrderId && (
                                            <button
                                                onClick={() => handlePlaceOrder(true, undefined, true)}
                                                disabled={orderLoading || (paymentMethod === 'efectivo' && !isSufficientPayment)}
                                                className="w-full bg-white border-2 border-green-600 text-green-600 font-black py-3 rounded-2xl shadow-sm active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs uppercase"
                                            >
                                                <span className="material-icons-round">check_circle</span>
                                                Marcar como Pagado (Sin Imprimir)
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address) && (
                                    <p className="text-center text-[10px] font-bold text-red-500 uppercase tracking-widest animate-pulse">
                                        Debes agregar Nombre, Teléfono y Dirección
                                    </p>
                                )}
                            </div>
                         </div>
                      </div>
                    </div>
                )
            }

            {/* CUSTOMER MODAL (FOR DELIVERY) */}
            <CustomerDeliveryModal
                isOpen={showCustomerModal}
                orderType={orderType}
                customerInfo={customerInfo}
                setCustomerInfo={setCustomerInfo}
                customerInsights={customerInsights}
                searchTerm={searchTerm}
                onSearchChange={async (term: string) => {
                    setSearchTerm(term);
                    // Buscar mientras escribe — también actualiza availableClients
                    try {
                        const url = term.length >= 2
                            ? `/api/cashier/customers/search?term=${encodeURIComponent(term)}`
                            : '/api/cashier/customers/search';
                        const res = await fetch(url);
                        if (!res.ok) return;
                        const data = await res.json();
                        const mapped = (data.customers || []).map((c: any) => ({
                            id: c.id,
                            name: c.full_name || 'Sin Nombre',
                            phone: c.phone || '',
                            address: c.address || '',
                            origin: c.is_app_user ? 'profile' : 'customer',
                        }));
                        setFoundCustomers(mapped);
                        setAvailableClients(mapped);
                    } catch { /* ignore */ }
                }}
                onSearchByPhone={searchCustomerByTerm}
                availableClients={foundCustomers}
                loadingClients={loadingClients}
                isSearchingCustomer={isSearchingCustomer}
                handleClientSelect={handleClientSelect}
                onClose={() => {
                    setShowCustomerModal(false);
                    setSearchTerm('');
                }}
                onAccept={() => setShowCustomerModal(false)}
                onClear={() => {
                    setCustomerInfo({ name: '', phone: '', address: '', street: '', neighborhood: '', reference: '' });
                    setShowCustomerModal(false);
                }}
                onSaveCustomer={handleSaveCustomer}
            />




            {
                (showSuccessModal || successModalRef.current) && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#181511]/90 backdrop-blur-md">
                        <div className="bg-white rounded-[40px] p-12 text-center shadow-2xl transform scale-100 animate-in zoom-in-95 duration-300">
                            <div className="size-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
                                <span className="material-icons-round text-6xl text-green-500 animate-bounce">check_circle</span>
                            </div>
                            <h3 className="text-4xl font-black mb-4">¡LISTO!</h3>
                            <p className="text-gray-500 font-medium max-w-[240px] mx-auto mb-4">La orden ha sido enviada correctamente.</p>

                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        successModalRef.current = false;
                                        // El ticket ya está abierto (showTicketModal = true)
                                        // Si no está abierto, recargar
                                        if (!showTicketModal) window.location.reload();
                                    }}
                                    className="w-full bg-[#181511] text-white py-4 rounded-2xl font-black active:scale-95 transition-all shadow-xl shadow-black/20 flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round">print</span>
                                    VER TICKET E IMPRIMIR
                                </button>

                                <button
                                    onClick={() => {
                                        setShowSuccessModal(false);
                                        successModalRef.current = false;
                                        setShowTicketModal(false);
                                        window.location.reload();
                                    }}
                                    className="w-full bg-gray-100 text-gray-600 py-3 rounded-2xl font-black active:scale-95 transition-all"
                                >
                                    NUEVA ORDEN SIN IMPRIMIR
                                </button>

                                <button
                                    onClick={() => handleCancelOrder()}
                                    className="w-full bg-white border-2 border-red-500 text-red-500 py-3 rounded-2xl font-black hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center gap-2 group text-sm"
                                >
                                    <span className="material-icons-round group-hover:rotate-90 transition-transform">cancel</span>
                                    {orderLoading ? 'ELIMINANDO...' : 'CANCELAR PEDIDO'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }




            {/* Modals */}
            {showNotifications && (
                <NotificationPanel 
                    onClose={() => setShowNotifications(false)} 
                    onAction={(notif) => {
                        if (notif.orderId) {
                            setShowOrdersView(true);
                            setRecentOrdersFilter('Todos');
                            setSearchQuery(`#${notif.orderId}`);
                            setShowNotifications(false);
                            
                            // Visual feedback
                            console.log(`🎯 [Nav] Navegando al pedido #${notif.orderId}`);
                        }
                    }}
                />
            )}
            {showChat && <CashierSupportChat onClose={() => setShowChat(false)} />}
            {showCierreCaja && (
                <CierreCajaModal
                    cashierName={cashierName}
                    userId={user?.id}
                    onClose={() => setShowCierreCaja(false)}
                    mustClose={shiftState === 'must_close'}
                    onCloseSuccess={handleCloseShiftSuccess}
                />
            )}

            {shiftState === 'checking' && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f8f7f5] flex-col gap-4">
                    <span className="material-icons-round animate-spin text-4xl text-[#F27405]">progress_activity</span>
                    <p className="text-xs font-bold text-gray-400 animate-pulse">Verificando sesión...</p>
                </div>
            )}



            {shiftState === 'closed' && (
                <div className="fixed inset-0 z-[200] bg-[#181511] flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-[#1c1917] rounded-[32px] p-8 border border-white/5 text-center shadow-2xl animate-in zoom-in-95 duration-500">
                        <div className="size-20 bg-green-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <span className="material-icons-round text-4xl text-green-500">lock_clock</span>
                        </div>
                        <h2 className="text-3xl font-black text-white mb-4">Turno Cerrado</h2>
                        <p className="text-gray-400 font-medium mb-8">
                            El turno de hoy ya ha finalizado. No se pueden procesar más órdenes.
                        </p>
                        

                        
                        <div className="space-y-3">
                            <button
                                onClick={() => router.push('/login')}
                                className="w-full bg-[#f7951d] text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest"
                            >
                                Desconectarse
                            </button>
                            
                            {/* Emergency Bypass for Admins */}
                            {isAdmin && (
                                <button
                                    onClick={() => setShiftState('open')}
                                    className="w-full bg-white/5 text-gray-500 font-black py-3 rounded-xl hover:bg-white/10 transition-all text-[10px] uppercase tracking-widest"
                                >
                                    Forzar Entrada (Solo Admin)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {shiftState === 'must_open' && (
                <AperturaCajaModal cashierName={cashierName} onOpen={handleOpenShift} />
            )}



            {/* Urgent New Order Alert Modal (Persistent) */}
            {pendingNewOrder && (
                <div className="fixed inset-0 z-[10000] bg-[#181511]/90 backdrop-blur-xl flex items-center justify-center p-4 overflow-hidden animate-in fade-in duration-500">
                    <div className="max-w-md w-full bg-white rounded-[40px] p-8 shadow-2xl shadow-orange-500/20 text-center relative border border-white/20 animate-in zoom-in-95 duration-500">
                        
                        {/* Animated Glow Effect */}
                        <div className="absolute inset-0 bg-gradient-to-b from-orange-50 to-white rounded-[40px] -z-10"></div>
                        
                        <div className="size-24 bg-gradient-to-br from-[#f7941d] to-[#ffb800] rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-200 animate-bounce">
                            <span className="material-icons-round text-5xl text-white">notification_important</span>
                        </div>
                        
                        <h2 className="text-3xl font-black text-[#181511] mb-2 tracking-tight uppercase">¡NUEVO PEDIDO VIRTUAL!</h2>
                        <p className="text-[#8c785f] font-bold text-sm uppercase tracking-widest mb-8">Requiere atención inmediata</p>
                        
                        <div className="bg-[#f8f7f5] rounded-[24px] p-6 mb-8 border border-gray-100 text-left">
                            <div className="flex justify-between items-center mb-4">
                                <span className="bg-orange-100 text-[#f7951d] text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                                    {pendingNewOrder.order_type === 'delivery' ? '🛵 Domicilio' : '🛍️ Para Llevar'}
                                </span>
                                <span className="text-xl font-black text-[#181511]">#{pendingNewOrder.id.toString().slice(-5)}</span>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cliente</p>
                                    <p className="text-lg font-black text-[#181511] truncate">{pendingNewOrder.customer_name || 'Sin nombre'}</p>
                                </div>
                                <div className="flex justify-between items-end pt-2 border-t border-gray-200/50">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total del Pedido</p>
                                        <p className="text-2xl font-black text-[#f7941d] tracking-tighter">${pendingNewOrder.total_amount?.toFixed(2)}</p>
                                    </div>
                                    <span className="text-[10px] font-black text-gray-300 uppercase italic">
                                        {new Date(pendingNewOrder.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="space-y-4 pt-2">
                            <button
                                onClick={() => {
                                    handleAcceptOrder(pendingNewOrder.id);
                                    stopAlarm();
                                    setShowOrdersView(true);
                                    setRecentOrdersFilter('Todos');
                                    setSearchQuery(pendingNewOrder.id.toString());
                                    
                                    // Remove from queue and set next or close
                                    setAllPendingVirtualOrders(prev => {
                                        const filtered = prev.filter(o => o.id !== pendingNewOrder.id);
                                        if (filtered.length > 0) {
                                            setPendingNewOrder(filtered[0]);
                                        } else {
                                            setPendingNewOrder(null);
                                            stopAlarm();
                                        }
                                        return filtered;
                                    });
                                }}
                                className="w-full bg-[#181511] text-white font-black py-5 rounded-[20px] shadow-xl shadow-black/20 active:scale-95 transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-3"
                            >
                                <span className="material-icons-round">visibility</span>
                                VER PEDIDO Y ATENDER
                            </button>
                            
                            {allPendingVirtualOrders.length > 1 && (
                                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">
                                    Tienes {allPendingVirtualOrders.length - 1} pedidos más pendientes
                                </p>
                            )}
                            
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">
                                LA ALARMA CONTINUARÁ SONANDO HASTA ACEPTAR
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Print Modal */}
            <TicketPrintModal
                isOpen={showTicketModal}
                onClose={() => setShowTicketModal(false)}
                data={ticketData}
            />

        </div >
    );
}
