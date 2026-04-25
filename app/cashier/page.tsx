'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';

import { useSessionKeepAlive } from '@/hooks/useSessionKeepAlive';
import NotificationPanel from '@/components/NotificationPanel';
import CashierSupportChat from '@/components/CashierSupportChat';
import TicketPrintModal from '@/components/TicketPrintModal';
import CierreCajaModal from '@/components/CierreCajaModal';
import AperturaCajaModal from '@/components/AperturaCajaModal';
import CustomerDeliveryModal from '@/components/CustomerDeliveryModal';
import { useAuth } from '@/contexts/AuthContext';


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

export default function CashierPage() {
    const router = useRouter();
    // Removed offline sync per user request
    const isOnline = true; // Placeholder or use navigator.onLine if needed, but per request we skip offline handling logic
    const pendingCount = 0;
    const isSyncing = false;
    const { user } = useAuth();
    const cashierName = user?.full_name || 'CAJERO';

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
                    if (err?.name === 'AbortError' || err?.message?.includes('aborted') || err?.message?.includes('signal')) {
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

    // --- Persistencia Local (LocalStorage) ---
    const [isStateRestored, setIsStateRestored] = useState(false);

    useEffect(() => {
        try {
            const savedCart = localStorage.getItem('caja_cart');
            if (savedCart) setCart(JSON.parse(savedCart));

            const savedOrderType = localStorage.getItem('caja_orderType');
            if (savedOrderType) setOrderType(savedOrderType as OrderType);

            const savedTableNumber = localStorage.getItem('caja_tableNumber');
            if (savedTableNumber) setTableNumber(savedTableNumber);

            const savedCustomerInfo = localStorage.getItem('caja_customerInfo');
            if (savedCustomerInfo) setCustomerInfo(JSON.parse(savedCustomerInfo));

            const savedActiveOrderId = localStorage.getItem('caja_activeOrderId');
            if (savedActiveOrderId) setActiveOrderId(savedActiveOrderId);
        } catch (e) {
            console.error('Error restoring state from localStorage:', e);
        } finally {
            setIsStateRestored(true);
        }
    }, []);

    useEffect(() => { if (isStateRestored) localStorage.setItem('caja_cart', JSON.stringify(cart)); }, [cart, isStateRestored]);
    useEffect(() => { if (isStateRestored) localStorage.setItem('caja_orderType', orderType); }, [orderType, isStateRestored]);
    useEffect(() => { if (isStateRestored) localStorage.setItem('caja_tableNumber', tableNumber); }, [tableNumber, isStateRestored]);
    useEffect(() => { if (isStateRestored) localStorage.setItem('caja_customerInfo', JSON.stringify(customerInfo)); }, [customerInfo, isStateRestored]);
    useEffect(() => { 
        if (isStateRestored) {
            if (activeOrderId) localStorage.setItem('caja_activeOrderId', activeOrderId); 
            else localStorage.removeItem('caja_activeOrderId');
        }
    }, [activeOrderId, isStateRestored]);
    // -----------------------------------------

    useEffect(() => {
        let isMounted = true;
        let timeoutId: NodeJS.Timeout;

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
            if (isMounted) timeoutId = setTimeout(fetchSystemConfig, 15000); // Poll faster (15s) for responsiveness
        };
        
        cleanupOldShiftKeys();
        fetchSystemConfig();
        return () => {
            isMounted = false;
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, []);

    useEffect(() => {
        let isEffectActive = true;

        // ─── VERIFICACIÓN INSTANTÁNEA DE LOCALSTORAGE ───────────────────────────
        const checkLocalShift = () => {
            try {
                const dateStr = new Date().toLocaleDateString('sv-SE');
                const saved = localStorage.getItem(`caja_casalena_${dateStr}`);
                if (saved) {
                    const shift = JSON.parse(saved);
                    if (shift.openedAt && !shift.closedAt) {
                        return true;
                    }
                }

                // Búsqueda extendida: por si el turno empezó ayer pero sigue abierto
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('caja_casalena_')) {
                        const val = localStorage.getItem(key);
                        if (val) {
                            try {
                                const s = JSON.parse(val);
                                if (s.openedAt && !s.closedAt) {
                                    const ageHours = (new Date().getTime() - new Date(s.openedAt).getTime()) / (1000 * 3600);
                                    if (ageHours < 24) return true;
                                }
                            } catch (e) {}
                        }
                    }
                }
            } catch (e) {}
            return false;
        };

        const evaluateShift = async () => {
            try {
                const startOfDay = new Date();
                startOfDay.setHours(0,0,0,0);
                const endOfDay = new Date();
                endOfDay.setHours(23,59,59,999);

                // 1. DETERMINAR ROL Y NOMBRE (con timeout silencioso para no colgar el arranque)
                const result = await Promise.race([
                    (async () => {
                        try {
                            const res = await supabase.auth.getUser();
                            return { type: 'success' as const, ...res };
                        } catch (err) {
                            return { type: 'error' as const, error: err };
                        }
                    })(),
                    new Promise<{ type: 'timeout' }>(res => setTimeout(() => res({ type: 'timeout' }), 5000))
                ]);

                if (!isEffectActive) return;

                if (result.type === 'timeout' || result.type === 'error') {
                    console.warn('[Shift] ⚠️ Problema con Supabase (timeout/error), usando fallback local.');
                    const locallyOpen = checkLocalShift();
                    setShiftState(locallyOpen ? 'open' : 'must_open');
                    return;
                }

                const user = result.data?.user;
                if (!user) {
                    setShiftState('closed');
                    return;
                }

                const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single();
                if (!isEffectActive) return;

                const isAdminUser = profile?.role === 'administrador' || profile?.role === 'admin';
                setIsAdmin(isAdminUser);
                if (profile?.full_name) {
                    console.log(`[ShiftCheck] Usuario identificado: ${profile.full_name}`);
                }

                // PRIORIDAD ADMIN
                if (isAdminUser) {
                    if (isEffectActive) setShiftState('open');
                    return;
                }

                // 2. BUSCAR SESIÓN ACTIVA EN DB
                const { data: activeSessions, error: sessionError } = await supabase
                    .from('cashier_sessions')
                    .select('id')
                    .eq('status', 'open')
                    .gte('opened_at', startOfDay.toISOString())
                    .lte('opened_at', endOfDay.toISOString())
                    .limit(1);

                if (!isEffectActive) return;

                const hasActiveDbSession = activeSessions && activeSessions.length > 0;
                const locallyOpen = checkLocalShift();

                if (hasActiveDbSession || locallyOpen) {
                    if (shiftState !== 'open') {
                         console.log(`[Shift] ✅ Sesión detectada. Entrando...`);
                         setShiftState('open');
                    }
                } else if (shiftState === 'checking') {
                    // Solo pedimos abrir si es la primera comprobación y no hay nada
                    console.log('[Shift] ℹ️ No se detectó sesión activa. Requiere apertura.');
                    setShiftState('must_open');
                }
                // Si ya estaba 'open', no lo regresamos a 'must_open' automáticamente 
                // para evitar que pida la caja de nuevo por errores de red temporales.
            } catch (err: any) {
                // Ignorar silenciosamente errores de abort (desmonte del componente / StrictMode)
                if (err?.name === 'AbortError' || err?.message?.includes('aborted') || err?.message?.includes('signal')) {
                    return;
                }
                if (!isEffectActive) return;
                console.error('[Shift] ❌ Error evaluando turno:', err);
                setShiftState(prev => prev === 'checking' ? 'must_open' : prev);
            }
        };

        // PASO 1 — Revisión instantánea de localStorage (sin red)
        const alreadyOpen = checkLocalShift();

        // PASO 2 — Safety fallback: si en 8s no resolvió y no hay localStorage
        const safetyId = setTimeout(() => {
            if (isEffectActive) setShiftState(prev => prev === 'checking' ? 'must_open' : prev);
        }, 5000); // Reducido a 5s para mejor UX

        // PASO 3 — Verificación con Supabase en background
        if (!alreadyOpen) {
            evaluateShift().catch(() => {}).finally(() => clearTimeout(safetyId));
        } else {
            clearTimeout(safetyId);
            evaluateShift().catch(() => {}); // background — errores silenciosos
        }

        const interval = setInterval(evaluateShift, 30000);
        return () => {
            isEffectActive = false;
            clearInterval(interval);
            clearTimeout(safetyId);
        };
    }, []);

    const handleOpenShift = async (info: { fondo: number, notas: string }) => {
        setShiftState('checking'); // Show loading while processing
        try {
            // Guardar en la base de datos (Supabase) con timeout silencioso
            const result = await Promise.race([
                (async () => {
                    try {
                        const res = await supabase
                            .from('cashier_sessions')
                            .insert([{
                                cashier_name: cashierName,
                                initial_fund: info.fondo,
                                notes: info.notas,
                                status: 'open',
                                opened_at: new Date().toISOString()
                            }])
                            .select();
                        return { type: 'success' as const, ...res };
                    } catch (err) {
                        return { type: 'error' as const, error: err };
                    }
                })(),
                new Promise<{ type: 'timeout' }>(res => setTimeout(() => res({ type: 'timeout' }), 10000))
            ]);

            if (result.type === 'timeout' || result.type === 'error') {
                 console.warn('[Shift] ⚠️ No se pudo registrar apertura en DB, usando modo local.', result);
                 // No lanzamos error, permitimos que el flujo siga con el fallback de localStorage
            }

            const error = result.type === 'success' ? result.error : null;
            const sessionData = result.type === 'success' ? result.data : null;

            if (error) {
                console.error('❌ [Shift] Error en apertura (DB):', error);
            }
            
            const sessionId = sessionData?.[0]?.id;
            const dateStr = new Date().toLocaleDateString('sv-SE');
            
            // Guardar en LocalStorage para redundancia y persistencia rápida
            localStorage.setItem(`caja_casalena_${dateStr}`, JSON.stringify({
                sessionId: sessionId,
                openedAt: new Date().toISOString(),
                fondo: info.fondo,
                notas: info.notas,
                closedAt: null
            }));
            
            setShiftState('open');
            console.log('✅ [Shift] Apertura de caja registrada en el servidor:', sessionId);
        } catch (err) {
            console.error('❌ [Shift] Error al registrar apertura en la base de datos:', err);
            // Fallback: al menos permitir que el cajero trabaje aunque falle la escritura (modo offline)
            const dateStr = new Date().toLocaleDateString('sv-SE');
            localStorage.setItem(`caja_casalena_${dateStr}`, JSON.stringify({
                openedAt: new Date().toISOString(),
                fondo: info.fondo,
                notas: info.notas,
                closedAt: null
            }));
            setShiftState('open');
        }
    };
    
    const handleCloseShiftSuccess = () => {
         const dateStr = new Date().toLocaleDateString('sv-SE');
         const saved = localStorage.getItem(`caja_casalena_${dateStr}`);
         if (saved) {
             const shift = JSON.parse(saved);
             shift.closedAt = new Date().toISOString();
             localStorage.setItem(`caja_casalena_${dateStr}`, JSON.stringify(shift));
             setShiftState('closed');
         }
    };

    useEffect(() => {
        fetchClientsForDropdown();
    }, []);

    // BROWSER NOTIFICATIONS SYSTEM
    const handleAcceptOrder = async (orderId: number | string) => {
        try {
            console.log(`✅ [Shift] Aceptando pedido #${orderId}...`);
            const { error } = await supabase
                .from('orders')
                .update({ status: 'preparando' })
                .eq('id', orderId);

            if (error) throw error;
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

        // Initial check for pending orders from platform/virtual
        const checkInitialPendingOrders = async () => {
            try {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*, order_items(*)')
                    .eq('status', 'pendiente')
                    .in('order_type', ['delivery', 'takeout'])
                    .order('created_at', { ascending: true });

                if (error) throw error;

                if (data && data.length > 0 && isEffectActive) {
                    console.log('🔔 [Notifications] Encontrados pedidos pendientes iniciales:', data.length);
                    setAllPendingVirtualOrders(data);
                    setPendingNewOrder(data[0]);
                    startAlarm();
                }
            } catch (err: any) {
                // Ignore AbortError which happens on rapid re-renders or unmounts
                if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
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
                if (newOrder.status === 'pendiente' && (newOrder.order_type === 'delivery' || newOrder.order_type === 'takeout')) {
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

                    // Start Continuous Alarm
                    startAlarm();

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

    // EFECTO PARA BUSCAR SI LA MESA YA TIENE UNA COMANDA ABIERTA
    useEffect(() => {
        if (orderType === 'dine-in' && tableNumber.trim()) {
            const tableNum = tableNumber.trim();
            const fetchOpenTableOrder = async () => {
                console.log(`🔍 [Cashier] Buscando comanda abierta para Mesa: ${tableNum}...`);
                try {
                    const { data, error } = await supabase
                        .from('orders')
                        .select('*, order_items(*)')
                        .eq('table_number', tableNum)
                        .in('status', ['pendiente', 'preparando', 'listo'])
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (error) throw error;

                    if (data && data.length > 0) {
                        const order = data[0];
                        console.log(`✅ [Cashier] Encontrada comanda #${order.id} abierta para mesa ${tableNum}`);
                        
                        // Solo cargar si el carrito está vacío para permitir agregar más items localmente
                        if (cart.length === 0) {
                            setActiveOrderId(order.id);
                            setPaymentMethod(order.payment_method || 'efectivo');

                            // Mapear items al carrito
                            const loadedCart = order.order_items.map((item: any) => ({
                                id: item.product_id,
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
                                cartItemId: Math.random().toString(36).substr(2, 9)
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
            console.log('🔄 [Cashier] Cargando solo usuarios con ROL=CLIENTE...');

            // 1. Definir fetchers independientes con filtro de rol 'cliente'
            const fetchCustomers = supabase.from('customers').select('*').limit(100).order('full_name');
            const fetchProfiles = supabase.from('profiles').select('*').eq('role', 'cliente').limit(100);
            const fetchUsuarios = supabase.from('usuarios').select('*').eq('role', 'cliente').limit(100);

            // 2. Ejecutar en paralelo
            const [customersRes, profilesRes, usuariosRes] = await Promise.allSettled([
                fetchCustomers,
                fetchProfiles,
                fetchUsuarios
            ]);

            let customersData: any[] = [];
            let profilesData: any[] = [];
            const usuariosData: any[] = [];

            // 3. Procesar resultados de forma segura
            if (customersRes.status === 'fulfilled' && !customersRes.value.error) {
                customersData = customersRes.value.data || [];
            }
            if (profilesRes.status === 'fulfilled' && !profilesRes.value.error) {
                profilesData = profilesRes.value.data || [];
            }
            if (usuariosRes.status === 'fulfilled' && !usuariosRes.value.error) {
                // Merge logic for legacy tables
                const rawUsuarios = usuariosRes.value.data || [];
                rawUsuarios.forEach(u => {
                    const existingProfileIndex = profilesData.findIndex(p => p.id === u.id);
                    if (existingProfileIndex >= 0) {
                        const p = profilesData[existingProfileIndex];
                        const legacyPhone = u.phone || u.phone_number || u.telefono || '';
                        const legacyAddress = u.address || u.direccion || '';
                        if (!p.phone_number && legacyPhone) profilesData[existingProfileIndex].phone_merged = legacyPhone;
                        if (!p.address && legacyAddress) profilesData[existingProfileIndex].address_merged = legacyAddress;
                    } else {
                        usuariosData.push(u);
                    }
                });
            }

            console.log(`📊 [Cashier] Clientes encontrados (rol: cliente): ${customersData.length} ocasionales, ${profilesData.length} perfiles, ${usuariosData.length} legados.`);

            // 4. Mapeo y Unificación
            const combined = [
                ...customersData.map(c => ({
                    id: c.id,
                    name: c.full_name,
                    phone: c.phone,
                    address: c.address,
                    origin: 'customer'
                })),
                ...profilesData.map(p => ({
                    id: p.id,
                    name: p.full_name || p.nombre || 'Usuario App',
                    phone: p.phone_merged || p.phone || p.phone_number || p.phoneNumber || p.telefono || p.celular || '',
                    address: p.address_merged || p.address || p.direccion || p.location || '',
                    origin: 'profile'
                })),
                ...usuariosData.map(u => ({
                    id: u.id,
                    name: u.full_name || u.email || 'Usuario Legado',
                    phone: u.phone || u.phone_number || u.telefono || '',
                    address: u.address || u.direccion || '',
                    origin: 'legacy'
                }))
            ].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            setAvailableClients(combined);
        } catch (err) {
            console.error('❌ Error crítico en fetchClientsForDropdown:', err);
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
        if (!term || term.length < 2) {
            setFoundCustomers([]);
            return;
        }
        try {
            const res = await fetch(`/api/cashier/customers/search?term=${encodeURIComponent(term)}`);
            if (!res.ok) throw new Error('Error en búsqueda de clientes');
            
            const data = await res.json();
            console.log(`📊 [Cashier] Búsqueda de lista: ${data.customers?.length || 0} resultados para "${term}"`);
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


    useEffect(() => {
        const timer = setTimeout(() => searchCustomersList(searchTerm), 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const searchCustomerByTerm = useCallback(async (manualTerm?: string) => {
        const queryTerm = manualTerm || customerInfo.phone.trim();
        console.log(`🔍 [Cashier] Iniciando búsqueda con: "${queryTerm}" (manual: ${!!manualTerm})`);
        if (queryTerm.length >= 3) {
            setIsSearchingCustomer(true);
            try {
                const res = await fetch(`/api/cashier/customers/search?term=${encodeURIComponent(queryTerm)}`);
                const data = await res.json();
                
                // If searching by phone, try to find exact match first. If by name, take the first result.
                let customerData = null;
                if (!manualTerm) {
                    customerData = data.customers?.find((c: any) => c.phone === queryTerm) || data.customers?.[0];
                } else {
                    customerData = data.customers?.[0];
                }

                if (customerData) {
                    console.log(`👤 [Cashier] Cliente encontrado: ${customerData.full_name || customerData.name}`);
                    const parts = (customerData.address || '').split(',').map((p: string) => p.trim());
                    
                    setCustomerInfo({
                        phone: customerData.phone || queryTerm,
                        name: customerData.full_name || customerData.name || '',
                        address: customerData.address || '',
                        street: parts[0] || '',
                        neighborhood: parts[1] || '',
                        reference: parts.slice(2).join(', ') || ''
                    });

                    const { data: orderHistory, error: hError } = await supabase
                        .from('orders')
                        .select(`
                            created_at, 
                            total_amount, 
                            order_items(product_name)
                        `)
                        .eq('phone_number', customerData.phone || queryTerm)
                        .order('created_at', { ascending: false });

                    if (!hError && orderHistory && orderHistory.length > 0) {
                        const totalOrders = orderHistory.length;
                        const totalSpent = orderHistory.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
                        const lastOrderDate = orderHistory[0].created_at;
                        const lastOrderAmount = orderHistory[0].total_amount;
                        const firstOrderDate = orderHistory[orderHistory.length - 1].created_at;

                        const productCounts: Record<string, number> = {};
                        orderHistory.forEach(o => {
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
                    console.warn(`⚠️ [Cashier] No se encontró ningún cliente con: "${queryTerm}"`);
                    alert(`❌ No se encontró ningún cliente con: "${queryTerm}"`);
                    setCustomerInsights(null);
                }
            } catch (err) {
                console.error('Error fetching customer insights:', err);
            } finally {
                setIsSearchingCustomer(false);
            }
        } else {
            setCustomerInsights(null);
        }
    }, [customerInfo.phone]);

    useEffect(() => {
        const timer = setTimeout(searchCustomerByTerm, 600);
        return () => clearTimeout(timer);
    }, [searchCustomerByTerm]);


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
        { id: 'extra_ingredient', name: 'Ingrediente extra', price: 20 },
        { id: 'extra_cheese', name: 'Extra queso', price: 35 },
        { id: 'extra_sauce', name: 'Aderezo extra', price: 10 },
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
        // Safety timeout for loading state
        const loadTimeout = setTimeout(() => setLoading(false), 8000); 
        fetchMenu().finally(() => clearTimeout(loadTimeout));
    }, []);

    async function fetchMenu() {
        setLoading(true);
        console.log('🍕 [Caja] Cargando menú completo desde API...');
        try {
            const res = await fetch('/api/cashier/products');
            if (!res.ok) throw new Error('Error al conectar con la API de productos');
            
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            if (data.categories) {
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

                const sortedCategories = [...data.categories].sort((a, b) => {
                    const orderA = categorySortOrder[a.name.toUpperCase()] || 999;
                    const orderB = categorySortOrder[b.name.toUpperCase()] || 999;
                    return orderA - orderB;
                });

                setCategories(sortedCategories);
                localStorage.setItem('cached_categories', JSON.stringify(sortedCategories));
            }

            if (data.products) {
                console.log(`✅ [Caja] ${data.products.length} productos recibidos.`);
                setProducts(data.products);
                localStorage.setItem('cached_products', JSON.stringify(data.products));
            }

        } catch (err: any) {
            console.warn('⚠️ [Cashier] Error en API de productos, usando caché:', err.message);
            
            const cachedCats = localStorage.getItem('cached_categories');
            if (cachedCats) setCategories(JSON.parse(cachedCats));

            const cachedProds = localStorage.getItem('cached_products');
            if (cachedProds) setProducts(JSON.parse(cachedProds));
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
                is_pre_ticket: orderData.is_pre_ticket || false,
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
            console.warn('⚠️ [Cashier] Ya hay un proceso de pedido en curso. Ignorando clic duplicado.');
            return;
        }

        if (orderType === 'dine-in' && !tableNumber.trim()) {
            alert('⚠️ POR FAVOR INGRESA EL NÚMERO DE MESA.');
            return;
        }

            setLoading(true);
            isProcessingOrder.current = true;

            try {
                const userId = await getUserIdSafe();

                // ── NÚMERO DE TICKET DIARIO ──────────────────────────────────────────
                let dailySequence = 1;
                if (!activeOrderId) {
                    try {
                        const today = new Date().toLocaleDateString('en-CA');
                        const { data: ticketData } = await supabase
                            .from('orders')
                            .select('ticket_number')
                            .gte('created_at', today + 'T00:00:00')
                            .lte('created_at', today + 'T23:59:59')
                            .order('ticket_number', { ascending: false })
                            .limit(1)
                            .single();
                        
                        if (ticketData?.ticket_number) {
                            dailySequence = Number(ticketData.ticket_number) + 1;
                        }
                    } catch (ticketErr) {
                        console.warn('[Cashier] Fallback en número de ticket:', ticketErr);
                    }
                }

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
                    total_amount: cartTotals.total,
                    tax_amount: cartTotals.tax,
                    order_type: orderType,
                    payment_method: (overridePaymentMethod || paymentMethod).toLowerCase().trim(),
                    customer_name: orderType === 'dine-in' ? null : customerInfo.name,
                    phone_number: orderType === 'dine-in' ? null : customerInfo.phone,
                    delivery_address: orderType === 'delivery' ? customerInfo.address : null,
                    table_number: orderType === 'dine-in' ? tableNumber : null,
                    updated_at: new Date().toISOString(),
                    cashier_name: cashierName,
                    ticket_number: dailySequence
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

                    return {
                        product_id: item.id,
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
                
                const response = await fetch('/api/cashier/save-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        order: { ...orderPayload, id: activeOrderId },
                        items: orderItemsPayload
                    })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Error al guardar en la base de datos');
                }

                const result = await response.json();
                const createdOrder = result.order;
                console.log(`✅ [Cashier] ORDEN GUARDADA (ID: ${createdOrder?.id})`);

                // UI SUCCESS FLOW
                if (createdOrder) {
                setLastOrderId(createdOrder.id);
                // Si es PRE-TICKET no mostramos el Confetti/Success grande, solo el Ticket (y un mini alert/toast visual de exito)
                if (isFinalPayment) {
                    setShowSuccessModal(true);
                    successModalRef.current = true;
                } else {
                    // Feedback visual sutil de que se guardó
                    const toast = document.createElement('div');
                    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-[9999] font-black uppercase text-xs animate-in slide-in-from-top-10 fade-in';
                    toast.innerHTML = '<span class="material-icons-round align-middle mr-2">save</span> Cuenta Abierta Guardada';
                    document.body.appendChild(toast);
                    setTimeout(() => { toast.classList.add('animate-out', 'fade-out', 'slide-out-to-top-10'); setTimeout(() => toast.remove(), 300); }, 3000);
                }

                // Generar Ticket (Pre-cuenta o Final)
                if (!skipPrinting) {
                    try {
                        console.log('📄 [Cashier] Generando ticket para impresión...');
                        handleOpenTicketModal({ ...createdOrder, is_pre_ticket: !isFinalPayment }, cart);
                    } catch (printErr) {
                        console.error('⚠️ [Cashier] Error abriendo modal de ticket:', printErr);
                        alert('El pedido se guardó pero hubo un error al generar el ticket visual.');
                    }
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

            setLoading(false);
            isProcessingOrder.current = false;

        } catch (error: any) {
            console.error('🛑 [Cashier] ERROR EN PROCESO:', error);
            alert(error.message || 'Error al procesar la orden');
            setLoading(false);
            isProcessingOrder.current = false;
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

    useEffect(() => {
        let isEffectActive = true;
        let timeoutId: NodeJS.Timeout;

        // PERSISTENT BACKGROUND NOTIFICATION LISTENER
        const ordersChannel = supabase
            .channel('global_cashier_notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
                if (!isEffectActive) return;
                if (payload.new.order_source === 'web' || payload.new.order_type === 'delivery') {
                    playNotificationSound();
                    setUnreadNotifications(prev => prev + 1);
                }
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cashier_notifications' }, (payload) => {
                if (!isEffectActive) return;
                playNotificationSound();
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
                    if (err.name !== 'AbortError') {
                        console.error('Sync Error:', err);
                    }
                }
            }

            if (isEffectActive) {
                timeoutId = setTimeout(runSync, 7000); // Poll every 7 seconds (safer)
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
            await supabase.auth.signOut();
        } catch (error) {
            console.error('Error al cerrar sesión:', error);
        } finally {
            window.location.href = '/tienda';
        }
    };

    const fetchRecentOrders = async (showLoading = true) => {
        // Verificación de sesión no bloqueante: si no hay sesión, saltamos silenciosamente.
        // El autoRefreshToken del cliente Supabase se encargará de renovarla en background.
        // NO hacemos refreshSession() aquí para evitar cuelgues por red lenta.
        try {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                console.log('[Cashier] ℹ️ Sin sesión activa, saltando fetch de órdenes (se renovará sola).');
                return;
            }
        } catch {
            // Error de red — simplemente ignorar, el siguiente ciclo de polling lo reintentará.
            return;
        }

        if (showLoading) setRecentOrdersLoading(true);
        try {
            // Query 1: open accounts (DINE-IN ONLY)
            const { data: openData, error: openErr } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        product_name,
                        product_id,
                        quantity,
                        unit_price,
                        selected_size,
                        extras,
                        notes
                    )
                `)
                .in('status', ['pendiente', 'preparando', 'listo'])
                .eq('order_type', 'dine-in')
                .order('created_at', { ascending: false });

            if (openErr) {
                console.error('❌ [Cashier] Error fetching open orders:', openErr.message || JSON.stringify(openErr));
                return;
            }

            // Query 2: All other orders (Delivery, Takeout, or Finished Dine-in)
            // This ensures Delivery/Takeout show up in "History" even if pending, as they are paid on receipt
            const { data: recentData, error: recentErr } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        product_name,
                        product_id,
                        quantity,
                        unit_price,
                        selected_size,
                        extras,
                        notes
                    )
                `)
                .or('order_type.neq.dine-in,status.in.(entregado,cancelado,confirmado)')
                .order('created_at', { ascending: false })
                .limit(50);

            if (recentErr) {
                console.error('❌ [Cashier] Error fetching recent orders:', recentErr.message || JSON.stringify(recentErr));
                return;
            }

            // Merge: Active Mesa orders first, then the rest
            // Avoid duplicates just in case
            const openIds = new Set((openData || []).map(o => o.id));
            const filteredRecent = (recentData || []).filter(o => !openIds.has(o.id));
            
            const combined = [...(openData || []), ...filteredRecent];
            
            // Only update state if we have results to avoid flickering/clearing
            if (combined.length > 0) {
                setRecentOrders(combined);
            }
        } catch (err) {
            console.error('❌ [Cashier] Error crítico en fetchRecentOrders:', err);
        } finally {
            if (showLoading) setRecentOrdersLoading(false);
        }
    };

    // Removed the restricted useEffect for fetching - replaced by global listener

    const handleSaveCustomer = async (info: any) => {
        try {
            const phoneClean = info.phone.trim();
            
            // Check if exists first to warn
            const { data: existing } = await supabase
                .from('customers')
                .select('id, full_name')
                .eq('phone', phoneClean)
                .maybeSingle();

            if (existing) {
                // If it exists, we still update it but we notify
                console.log('ℹ️ [Cashier] El cliente ya existe. Actualizando datos...');
            }

            const { error } = await supabase
                .from('customers')
                .upsert({
                    phone: phoneClean,
                    full_name: info.name,
                    address: info.address || [info.street, info.neighborhood, info.reference].filter(Boolean).join(', ') || '',
                }, { onConflict: 'phone' });

            if (error) throw error;
            
            console.log(`✅ [Cashier] Cliente guardado exitosamente: ${info.name} (${phoneClean})`);
            alert('✅ Cliente guardado correctamente');
            
            // Feedback visual
            const toast = document.createElement('div');
            toast.className = `fixed top-4 right-4 ${existing ? 'bg-amber-500' : 'bg-blue-600'} text-white px-6 py-3 rounded-2xl shadow-2xl z-[9999] font-black uppercase text-xs animate-in slide-in-from-top-10 fade-in`;
            toast.innerHTML = `<span class="material-icons-round align-middle mr-2">${existing ? 'sync' : 'person_add'}</span> ${existing ? 'Datos de Cliente Actualizados' : 'Cliente Guardado Exitosamente'}`;
            document.body.appendChild(toast);
            setTimeout(() => { 
                toast.classList.add('animate-out', 'fade-out', 'slide-out-to-top-10'); 
                setTimeout(() => toast.remove(), 300); 
            }, 3000);
            
        } catch (err: any) {
            console.error('Error saving customer:', err);
            alert('Error al guardar cliente: ' + err.message);
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
                                    {recentOrders
                                        .filter(o => {
                                            // Search Filter Logic
                                            if (searchQuery.trim()) {
                                                const query = searchQuery.toLowerCase().replace('#', '');
                                                const matchesSearch = 
                                                    String(o.id).includes(query) || 
                                                    (o.customer_name && o.customer_name.toLowerCase().includes(query)) ||
                                                    (o.ticket_number && String(o.ticket_number).includes(query)) ||
                                                    (o.table_number && String(o.table_number).includes(query));
                                                
                                                if (!matchesSearch) return false;
                                            }

                                            // Status Filter Logic
                                            if (recentOrdersFilter === 'Todos') return true;
                                            if (recentOrdersFilter === 'Abiertas') return ['pendiente', 'preparando', 'listo'].includes(o.status) && o.order_type === 'dine-in';
                                            if (recentOrdersFilter === 'Pendiente') return o.status === 'confirmado';
                                            if (recentOrdersFilter === 'Preparando') return o.status === 'preparando' || o.status === 'listo';
                                            if (recentOrdersFilter === 'Entregado') return o.status === 'entregado';
                                            return true;
                                        })
                                        .map((order) => (
                                        <div key={order.id} className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-xl transition-all group overflow-hidden relative">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500 opacity-50"></div>
                                            
                                            <div className="relative z-10">
                                                <div className="flex justify-between items-start mb-6">
                                                    <div>
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
                                                        <p className="text-xl font-black text-[#181511] tracking-tight">
                                                            {order.customer_name || (order.table_number ? `Mesa #${order.table_number}` : `Ticket #${order.ticket_number || order.id.toString().slice(-5)}`)}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                                            {new Date(order.created_at).toLocaleTimeString()} • {order.order_type === 'delivery' ? 'Domicilio' : 'Local'}
                                                        </p>
                                                    </div>
                                                    <p className="text-2xl font-black text-[#181511] tracking-tighter">${order.total_amount.toFixed(2)}</p>
                                                </div>

                                                <div className="space-y-2 mb-6">
                                                    {order.order_items?.map((item: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center text-xs">
                                                            <span className="text-[#8c785f] font-medium"><span className="font-black text-[#181511]">{item.quantity}x</span> {item.product_name}</span>
                                                            <span className="font-bold text-[#181511]">${(item.unit_price * item.quantity).toFixed(2)}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="flex gap-2">
                                                    {['pendiente', 'preparando', 'listo'].includes(order.status) && (
                                                        <>
                                                            <button 
                                                                onClick={() => {
                                                                    setShowOrdersView(false);
                                                                    setOrderType(order.order_type || 'dine-in');
                                                                    setTableNumber(order.table_number || '');
                                                                    setActiveOrderId(order.id);
                                                                    setPaymentMethod(order.payment_method || 'efectivo');
                                                                    const loadedCart = (order.order_items || []).map((item: any) => ({
                                                                        id: item.product_id || 0,
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
                                                                        cartItemId: Math.random().toString(36).substr(2, 9)
                                                                    }));
                                                                    setCart(loadedCart);
                                                                }}
                                                                className="flex-1 bg-purple-50 text-purple-600 border-2 border-purple-200 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-colors shadow-sm active:scale-95"
                                                            >
                                                                Abrir Comanda
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    setShowOrdersView(false);
                                                                    setOrderType(order.order_type || 'dine-in');
                                                                    setTableNumber(order.table_number || '');
                                                                    setActiveOrderId(order.id);
                                                                    setPaymentMethod(order.payment_method || 'efectivo');
                                                                    const loadedCart = (order.order_items || []).map((item: any) => ({
                                                                        id: item.product_id || 0,
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
                                                                        cartItemId: Math.random().toString(36).substr(2, 9)
                                                                    }));
                                                                    setCart(loadedCart);
                                                                    setTimeout(() => setShowPaymentModal(true), 150);
                                                                }}
                                                                className="flex-1 bg-[#181511] text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors shadow-sm active:scale-95 flex items-center justify-center gap-1"
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
                                                        className="size-12 shrink-0 bg-green-500 text-white rounded-2xl flex items-center justify-center hover:bg-green-600 transition-colors shadow-lg active:scale-95"
                                                        title="WhatsApp"
                                                    >
                                                        <span className="material-icons-round">whatsapp</span>
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
                                                        className="flex-1 bg-[#181511] text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#181511]/80 transition-colors shadow-lg active:scale-95"
                                                    >
                                                        Ticket
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {recentOrders.length === 0 && (
                                        <div className="col-span-full h-96 flex flex-col items-center justify-center opacity-30">
                                            <span className="material-icons-round text-8xl mb-4">receipt_long</span>
                                            <p className="text-xl font-black uppercase tracking-tighter">No hay pedidos registrados</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    ) : (
                        /* Products Section - No Horizontal Scroll */
                        <section className="flex-1 p-3 lg:p-4 overflow-hidden flex flex-col">
                            {/* Categories Selection - Full Width Grid at the top to avoid scroll */}
                            <div className="mb-3 shrink-0">
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

            {/* RIGHT SIDEBAR - Responsive: Drawer on mobile, Sidebar on desktop */}
            <aside className={`fixed lg:static inset-y-0 right-0 z-[80] lg:z-auto transition-transform duration-300 ease-out lg:translate-x-0 ${isCartDrawerOpen ? 'translate-x-0' : 'translate-x-full'} w-[340px] sm:w-[380px] xl:w-[400px] bg-white border-l border-[#e8e5e1] flex flex-col h-screen shrink-0 shadow-2xl lg:shadow-none overflow-hidden`}>
                <div className="p-6 border-b border-[#e8e5e1] relative">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                            <h2 className="text-[#181511] text-2xl font-black tracking-tight leading-none">Comanda Actual</h2>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mt-1.5">{cart.length} ITEMS SELECCIONADOS</p>
                        </div>

                        {/* Mobile Close Button for Drawer */}
                        <button 
                            onClick={() => setIsCartDrawerOpen(false)}
                            className="lg:hidden size-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 active:bg-red-50 active:text-red-500 transition-colors"
                        >
                            <span className="material-icons-round">close</span>
                        </button>

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
                                {type === 'dine-in' ? 'Mesa' : type === 'takeout' ? 'Pick up' : 'Domicilio'}
                            </button>
                        ))}
                    </div>

                    {/* MESAS / CUENTAS ABIERTAS QUICK ACCESS (SOLO MESA) */}
                    {recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status) && o.order_type === 'dine-in').length > 0 && (
                        <div className="mb-4 animate-in fade-in slide-in-from-top-2">
                            <span className="text-[10px] font-black text-purple-500 uppercase tracking-widest block mb-2 flex items-center gap-1">
                                <span className="material-icons-round text-[12px]">table_restaurant</span> Cuentas Abiertas (Mesa)
                            </span>
                            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                                {recentOrders.filter(o => ['pendiente', 'preparando', 'listo', 'confirmado'].includes(o.status) && o.order_type === 'dine-in').map(order => {
                                    const isSelected = activeOrderId === order.id || (order.table_number && tableNumber === order.table_number);
                                    return (
                                        <button 
                                            key={order.id}
                                            onClick={() => {
                                                setOrderType(order.order_type || 'dine-in');
                                                if (order.table_number) {
                                                    setTableNumber(order.table_number);
                                                } else {
                                                    setTableNumber('');
                                                }
                                                
                                                // SIEMPRE CARGAR EL CARRITO AL SELECCIONAR EXPLÍCITAMENTE
                                                setActiveOrderId(order.id);
                                                setPaymentMethod(order.payment_method || 'efectivo');
                                                const loadedCart = (order.order_items || []).map((item: any) => ({
                                                    id: item.product_id || 0,
                                                    name: item.product_name,
                                                    price: item.unit_price,
                                                    quantity: item.quantity,
                                                    selectedSize: item.selected_size,
                                                    extras: item.extras || [],
                                                    cartItemId: Math.random().toString(36).substr(2, 9)
                                                }));
                                                setCart(loadedCart);
                                            }}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-black shrink-0 transition-all flex items-center gap-1.5 ${
                                                isSelected
                                                ? 'bg-purple-600 text-white border-purple-600 shadow-md scale-[1.03]'
                                                : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'
                                            }`}
                                        >
                                            <span className="material-icons-round text-[14px]">
                                                {order.order_type === 'takeout' ? 'shopping_bag' : 'table_restaurant'}
                                            </span>
                                            {order.table_number ? `Mesa ${order.table_number}` : (order.customer_name || `LLEVAR #${order.ticket_number}`)}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

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

                    {(orderType === 'takeout' || orderType === 'delivery') && (
                        <div className="bg-white/50 rounded-xl p-2.5 border border-gray-100 animate-in fade-in slide-in-from-top-2 mb-2">
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-[9px] font-black text-[#8c785f] uppercase tracking-widest">{orderType === 'delivery' ? 'Datos de Entrega' : 'Información Pickup'}</span>
                                {(!customerInsights && customerInfo.phone.length >= 7 && customerInfo.name) && (
                                    <button 
                                        onClick={() => handleSaveCustomer(customerInfo)}
                                        className="flex items-center gap-1 bg-green-500 text-white px-1.5 py-0.5 rounded-lg hover:bg-green-600 transition-all active:scale-95"
                                    >
                                        <span className="material-icons-round text-[10px]">person_add</span>
                                        <span className="text-[7px] font-black uppercase">Guardar</span>
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 border border-gray-100">
                                    <span className="material-icons-round text-xs text-gray-300">person</span>
                                    <input
                                        type="text"
                                        placeholder="Nombre del cliente"
                                        value={customerInfo.name || ''}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                                        onKeyDown={(e) => e.key === 'Enter' && searchCustomerByTerm(customerInfo.name)}
                                        className="w-full text-[10px] font-black text-[#181511] outline-none placeholder:text-gray-200"
                                    />
                                    <button 
                                        onClick={() => searchCustomerByTerm(customerInfo.name)}
                                        className="p-1 hover:bg-gray-100 rounded text-[#f7941d] active:scale-90 transition-all"
                                        title="Buscar cliente por nombre"
                                    >
                                        <span className="material-icons-round text-xs">download</span>
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 border border-gray-100">
                                    <span className="material-icons-round text-xs text-gray-300">phone</span>
                                    <input
                                        type="tel"
                                        placeholder="Teléfono"
                                        value={customerInfo.phone || ''}
                                        onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                                        onKeyDown={(e) => e.key === 'Enter' && searchCustomerByTerm()}
                                        className="w-full text-[10px] font-black text-[#181511] outline-none placeholder:text-gray-200"
                                    />
                                    <button 
                                        onClick={() => searchCustomerByTerm()}
                                        className="p-1 hover:bg-gray-100 rounded text-[#f7941d] active:scale-90 transition-all"
                                    >
                                        <span className="material-icons-round text-xs">download</span>
                                    </button>
                                </div>
                                {orderType === 'delivery' && (
                                    <div className="flex items-start gap-2 bg-white rounded-lg px-2 py-1 border border-gray-100">
                                        <span className="material-icons-round text-xs text-gray-300 mt-0.5">location_on</span>
                                        <textarea
                                            placeholder="Dirección Completa"
                                            value={customerInfo.address || ''}
                                            onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                                            rows={1}
                                            className="w-full text-[10px] font-black text-[#181511] outline-none placeholder:text-gray-200 resize-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-20">
                            <span className="material-icons-round text-6xl mb-2">shopping_basket</span>
                            <p className="font-bold">Orden vacía</p>
                        </div>
                    ) : (
                        cart.map((item) => (
                            <div key={item.cartItemId} className="flex gap-2 animate-in slide-in-from-right-2 duration-200">
                                <div className="size-8 bg-orange-50 text-[#f7951d] rounded-lg flex items-center justify-center font-black shrink-0 text-xs">{item.quantity}x</div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[11px] truncate leading-tight">{item.name}</p>
                                    <p className="text-[9px] text-[#8c785f] font-bold uppercase tracking-tighter">
                                        {item.selectedSize} {item.extras && item.extras.length > 0 ? `+ ${item.extras.length} extras` : ''}
                                    </p>
                                    {item.note && (
                                        <p className="text-[9px] text-amber-600 font-bold italic mt-0.5 truncate leading-tight" title={item.note}>
                                            📝 {item.note}
                                        </p>
                                    )}
                                    <div className="flex gap-2 mt-0.5">
                                        <button onClick={() => updateQuantity(item.cartItemId, -1)} className="text-[9px] font-black text-red-500 hover:underline">QUITAR</button>
                                        <button onClick={() => updateQuantity(item.cartItemId, 1)} className="text-[9px] font-black text-green-600 hover:underline">AÑADIR</button>
                                        <button
                                            onClick={() => {
                                                const group = groupedProducts.find(g => g.name === item.name || item.name.includes(g.name));
                                                if (group) openProductCustomizer(group, item);
                                            }}
                                            className="text-[9px] font-black text-blue-500 hover:underline"
                                        >
                                            EDITAR
                                        </button>
                                    </div>
                                </div>
                                <p className="font-bold text-[11px] shrink-0">${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-3 bg-[#f8f7f5] border-t border-[#e8e5e1] space-y-2">
                    {/* Open Tabs button - always visible */}
                    <button
                        onClick={() => setShowOpenTabsModal(true)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 active:scale-95 transition-all"
                    >
                        <div className="flex items-center gap-2">
                            <span className="material-icons-round text-base">receipt_long</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Cuentas Abiertas</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status)).length > 0 && (
                                <span className="bg-purple-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                    {recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status)).length}
                                </span>
                            )}
                            <span className="material-icons-round text-sm">chevron_right</span>
                        </div>
                    </button>

                    <div className="flex justify-between items-end">
                        <span className="text-[#8c785f] font-bold text-xs uppercase tracking-tighter">Total a Pagar</span>
                        <span className="text-2xl font-black text-[#f7951d] tracking-tighter">${cartTotals.total.toFixed(2)}</span>
                    </div>

                    {orderType === 'dine-in' ? (
                        <div className="flex gap-2">
                            <button onClick={clearCart} className="w-1/4 flex-none bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-500 font-black py-4 rounded-xl shadow-sm transition-all text-xs flex items-center justify-center" title="Nueva Orden (Limpiar)">
                                <span className="material-icons-round">delete_sweep</span>
                            </button>
                            <button onClick={() => setShowPaymentModal(true)} disabled={cart.length === 0} className="flex-1 bg-[#181511] text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all disabled:opacity-50">PROCESAR PAGO</button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2">
                                <button onClick={clearCart} className="w-1/4 flex-none bg-white border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-500 font-black py-3 rounded-xl shadow-sm transition-all text-xs flex items-center justify-center" title="Nueva Orden (Limpiar)">
                                    <span className="material-icons-round">delete_sweep</span>
                                </button>
                                <button 
                                    onClick={() => handlePlaceOrder(false, 'efectivo')} 
                                    disabled={cart.length === 0 || loading || (orderType === 'delivery' && !customerInfo.name)} 
                                    className="flex-1 bg-[#181511] text-white font-black py-3 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 text-[10px] uppercase flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-round text-sm">print</span>
                                    {loading ? 'Procesando...' : 'Imprimir Ticket'}
                                </button>
                            </div>
                            <button 
                                onClick={() => handlePlaceOrder(true, 'transferencia')} 
                                disabled={cart.length === 0 || loading || (orderType === 'delivery' && !customerInfo.name)} 
                                className="w-full bg-blue-600 text-white font-black py-3 rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-50 text-[10px] uppercase flex items-center justify-center gap-2"
                            >
                                <span className="material-icons-round text-sm">account_balance</span>
                                {loading ? 'Procesando...' : 'Pago con Transferencia'}
                            </button>
                        </div>
                    )}
                </div>
            </aside>

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
                                    {recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status)).length} cuenta(s) pendiente(s) de cobro
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
                            {recentOrders.filter(o => ['pendiente', 'preparando', 'listo', 'confirmado'].includes(o.status)).length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full opacity-20 gap-4">
                                    <span className="material-icons-round text-6xl">receipt_long</span>
                                    <p className="font-black text-sm uppercase tracking-widest">Sin cuentas abiertas</p>
                                </div>
                            ) : (
                                recentOrders.filter(o => ['pendiente', 'preparando', 'listo'].includes(o.status)).map(order => (
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
                                                    if (order.table_number) {
                                                        setTableNumber(order.table_number);
                                                    } else {
                                                        setTableNumber('');
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
                                                            id: item.product_id || 0,
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
                                                            cartItemId: Math.random().toString(36).substr(2, 9)
                                                        }));
                                                        setCart(loadedCart);
                                                    }
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
                                                        id: item.product_id || 0,
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
                                                        cartItemId: Math.random().toString(36).substr(2, 9)
                                                    }));
                                                    setCart(loadedCart);
                                                    
                                                    setShowOpenTabsModal(false);
                                                    setTimeout(() => setShowPaymentModal(true), 150);
                                                }}
                                                className="flex-1 flex items-center justify-center gap-2 bg-[#181511] text-white py-3 rounded-xl text-xs font-black hover:bg-black transition-all active:scale-95 shadow-lg"
                                            >
                                                <span className="material-icons-round text-base">payments</span>
                                                Cobrar
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
                                            onClick={() => handlePlaceOrder(false)}
                                            disabled={loading || !tableNumber.trim() || cart.length === 0}
                                            className="w-full bg-white border-2 border-[#181511] text-[#181511] font-black py-4 rounded-2xl shadow-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-icons-round">print</span>
                                            SOLO IMPRIMIR (CUENTA ABIERTA)
                                        </button>
                                    )}

                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={() => handlePlaceOrder(true)}
                                            disabled={
                                                loading ||
                                                (paymentMethod === 'efectivo' && orderType !== 'delivery' && !isSufficientPayment) ||
                                                (orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address)) ||
                                                (orderType === 'dine-in' && !tableNumber.trim()) ||
                                                cart.length === 0
                                            }
                                            className="w-full bg-[#f7951d] text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <span className="material-icons-round">{orderType === 'dine-in' ? 'check_circle' : 'receipt_long'}</span>
                                            {loading ? 'PROCESANDO...' :
                                                (orderType === 'delivery' && (!customerInfo.name || !customerInfo.phone || !customerInfo.address)) ? 'FALTA DATOS CLIENTE' :
                                                    (orderType === 'dine-in' && !tableNumber.trim()) ? 'FALTA MESA' :
                                                        (orderType === 'dine-in' ? 'COBRAR MESA Y FINALIZAR' : 'FINALIZAR E IMPRIMIR')}
                                        </button>

                                        {(orderType === 'takeout' || orderType === 'delivery') && activeOrderId && (
                                            <button
                                                onClick={() => handlePlaceOrder(true, undefined, true)}
                                                disabled={loading || (paymentMethod === 'efectivo' && !isSufficientPayment)}
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
                onSearchChange={setSearchTerm}
                onSearchByPhone={searchCustomerByTerm}
                availableClients={foundCustomers}
                loadingClients={false}
                isSearchingCustomer={isSearchingCustomer}
                handleClientSelect={handleClientSelect}
                onClose={() => {
                    setShowCustomerModal(false);
                    setSearchTerm('');
                    setFoundCustomers([]);
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
