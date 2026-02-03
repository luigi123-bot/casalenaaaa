'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeCashier } from '@/contexts/CashierContext';
import { supabase } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useStoreStatus } from '@/hooks/useStoreStatus';

interface HeaderProps {
    role: 'admin' | 'cashier';
    searchTerm?: string;
    setSearchTerm?: (term: string) => void;
    activeCategory?: string;
    setActiveCategory?: (category: string) => void;
}

interface AppNotification {
    id: string;
    type: 'order' | 'message';
    title: string;
    description: string;
    time: Date;
    link: string;
    read: boolean;
}

export default function Header(props: HeaderProps) {
    const { role } = props;
    const { user, signOut } = useAuth();
    const router = useRouter();
    const cashierContext = useSafeCashier();
    const { isOpen: isStoreOpen, isLoading: isStatusLoading } = useStoreStatus();

    const searchTerm = cashierContext?.searchTerm ?? props.searchTerm;
    const setSearchTerm = cashierContext?.setSearchTerm ?? props.setSearchTerm;
    const activeCategory = cashierContext?.activeCategory ?? props.activeCategory;
    const setActiveCategory = cashierContext?.setActiveCategory ?? props.setActiveCategory;

    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');

    // Notification State
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);

    // Derived count of unread notifications
    const unreadCount = useMemo(() =>
        notifications.filter(n => !n.read).length
        , [notifications]);

    const hasUnread = unreadCount > 0;
    const notificationAudioRef = useRef<HTMLAudioElement | null>(null);

    // Initial Data Fetch & Realtime Subscription
    useEffect(() => {
        notificationAudioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2346/2346-preview.mp3');

        const fetchInitialState = async () => {
            try {
                // Unread Messages (only from clients)
                const { count: msgCount } = await supabase
                    .from('chat_messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('is_read', false)
                    .eq('sender', 'client');

                // Pending Orders
                const { count: orderCount } = await supabase
                    .from('orders')
                    .select('*', { count: 'exact', head: true })
                    .eq('status', 'pendiente');

                if ((msgCount || 0) > 0 || (orderCount || 0) > 0) {
                    const initialNotifs: AppNotification[] = [];
                    if ((orderCount || 0) > 0) {
                        initialNotifs.push({
                            id: 'init-orders',
                            type: 'order',
                            title: 'Pedidos Pendientes',
                            description: `Hay ${orderCount} pedidos esperando atención.`,
                            time: new Date(),
                            link: role === 'admin' ? '/admin/orders' : '/cashier',
                            read: false
                        });
                    }
                    if ((msgCount || 0) > 0) {
                        initialNotifs.push({
                            id: 'init-msgs',
                            type: 'message',
                            title: 'Mensajes Nuevos',
                            description: `Hay ${msgCount} mensajes sin leer.`,
                            time: new Date(),
                            link: '/admin/users',
                            read: false
                        });
                    }
                    setNotifications(initialNotifs);
                }
            } catch (error) {
                console.error('Error checking notifications:', error);
            }
        };

        fetchInitialState();

        const channel = supabase
            .channel('header_notifications')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
                const newOrder = payload.new;
                handleNewNotification({
                    id: `order-${newOrder.id}`,
                    type: 'order',
                    title: '¡Nuevo Pedido!',
                    description: `Pedido #${newOrder.id.toString().slice(0, 8)} de ${newOrder.customer_name || 'Cliente'}`,
                    time: new Date(),
                    link: role === 'admin' ? '/admin/orders' : '/cashier',
                    read: false
                });
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
                const newMsg = payload.new as any;
                if (newMsg.sender === 'client') {
                    handleNewNotification({
                        id: `msg-${newMsg.id}`,
                        type: 'message',
                        title: 'Nuevo Mensaje',
                        description: `${newMsg.customer_name || 'Cliente'}: ${newMsg.message.substring(0, 30)}...`,
                        time: new Date(),
                        link: '/admin/users',
                        read: false
                    });
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [role]);

    const handleNewNotification = (notif: AppNotification) => {
        setNotifications(prev => [notif, ...prev]);
        if (notificationAudioRef.current) {
            notificationAudioRef.current.currentTime = 0;
            notificationAudioRef.current.play().catch(() => { });
        }
    };

    const handleNotificationClick = (notif: AppNotification) => {
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
        setShowNotifications(false);

        if (notif.type === 'message') {
            window.dispatchEvent(new CustomEvent('open-admin-chat', { detail: { userId: 'latest' } }));
        } else {
            router.push(notif.link);
        }
    };

    const clearNotifications = () => {
        setNotifications([]);
        setShowNotifications(false);
    };

    useEffect(() => {
        const updateDateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true }));
            const dateString = role === 'admin'
                ? now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                : now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
            setCurrentDate(dateString);
        };
        updateDateTime();
        const interval = setInterval(updateDateTime, 1000);
        return () => clearInterval(interval);
    }, [role]);

    const getRoleName = (userRole: string) => {
        switch (userRole) {
            case 'administrador': return 'Administrador';
            case 'cajero': return 'Cajero';
            case 'cocina': return 'Cocina';
            default: return 'Usuario';
        }
    };

    const UserProfile = () => (
        <div className="flex items-center gap-2 sm:gap-3 pl-3 sm:pl-6 border-l border-[#e6e1db]">
            <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-[#181511]">{user?.full_name || 'Usuario'}</p>
                <p className="text-xs text-[#8c785f]">{user ? getRoleName(user.role) : ''}</p>
            </div>
            <button onClick={() => signOut()} className="rounded-full size-8 sm:size-10 border-2 border-[#e6e1db] hover:border-primary transition-colors flex items-center justify-center overflow-hidden">
                {user?.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : <span className="material-symbols-outlined text-[#8c785f] text-xl sm:text-2xl">person</span>}
            </button>
        </div>
    );

    const NotificationDropdown = () => (
        showNotifications && (
            <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute top-14 sm:top-16 right-4 sm:right-20 w-[calc(100vw-2rem)] sm:w-80 max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-3 sm:p-4 border-b flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-sm sm:text-base text-[#181511]">Notificaciones</h3>
                        {notifications.length > 0 && <button onClick={clearNotifications} className="text-xs text-primary font-bold hover:underline">Limpiar todo</button>}
                    </div>
                    <div className="max-h-[300px] sm:max-h-[400px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-6 sm:p-8 text-center text-gray-400"><p className="text-xs font-medium">No hay notificaciones</p></div>
                        ) : (
                            notifications.map(notif => (
                                <div key={notif.id} onClick={() => handleNotificationClick(notif)} className={`p-3 sm:p-4 border-b hover:bg-gray-50 cursor-pointer flex gap-2 sm:gap-3 ${!notif.read ? 'bg-orange-50/30' : ''}`}>
                                    <div className={`mt-1 size-7 sm:size-8 rounded-full flex items-center justify-center shrink-0 ${notif.type === 'order' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                        <span className="material-symbols-outlined text-base sm:text-lg">{notif.type === 'order' ? 'receipt_long' : 'chat'}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className={`text-xs sm:text-sm ${!notif.read ? 'font-bold' : 'font-medium text-gray-600'}`}>{notif.title}</h4>
                                        <p className="text-[10px] sm:text-xs text-gray-500 line-clamp-2 my-0.5">{notif.description}</p>
                                    </div>
                                    {!notif.read && <div className="shrink-0 mt-2 size-2 rounded-full bg-primary" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </>
        )
    );

    return (
        <header className="flex items-center justify-between border-b border-[#e6e1db] bg-white px-4 sm:px-6 lg:px-8 py-3 sm:py-4 shrink-0 h-[60px] sm:h-[72px] relative">
            {role === 'admin' ? (
                <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0 lg:pl-12">
                    <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full border transition-colors ${isStoreOpen
                        ? 'bg-green-50 text-green-700 border-green-100'
                        : 'bg-red-50 text-red-700 border-red-100'
                        }`}>
                        <div className={`size-1.5 sm:size-2 rounded-full animate-pulse ${isStoreOpen ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                        <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-wide">
                            {isStatusLoading ? '...' : (isStoreOpen ? 'Abierto' : 'Cerrado')}
                        </h2>
                    </div>
                    <p className="text-xs sm:text-sm text-[#8c785f] hidden sm:block truncate">{currentDate} • {currentTime}</p>
                    <p className="text-xs text-[#8c785f] sm:hidden truncate">{currentTime}</p>
                </div>
            ) : (
                <div className="flex-1 relative max-w-md lg:pl-12">
                    <span className="material-symbols-outlined absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-[#8c785f] text-xl sm:text-2xl">search</span>
                    <input value={searchTerm || ''} onChange={(e) => setSearchTerm?.(e.target.value)} className="w-full bg-[#f8f7f5] rounded-xl pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none" placeholder="Buscar..." type="text" />
                </div>
            )}

            <div className="flex items-center gap-3 sm:gap-6">
                <button onClick={() => setShowNotifications(!showNotifications)} className="relative text-[#8c785f] hover:text-primary transition-colors">
                    <span className="material-symbols-outlined text-2xl sm:text-[28px]">notifications</span>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[16px] sm:min-w-[18px] h-[16px] sm:h-[18px] bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 sm:px-1 border-2 border-white animate-bounce-slow">
                            {unreadCount}
                        </span>
                    )}
                </button>
                <NotificationDropdown />
                <UserProfile />
            </div>
        </header>
    );
}
