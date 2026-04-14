'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';

interface Notification {
    id: string;
    type: 'order' | 'payment' | 'alert' | 'info';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    orderId?: number;
}

export default function NotificationPanel({ 
    onClose, 
    onAction 
}: { 
    onClose: () => void;
    onAction?: (notification: Notification) => void;
}) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const unreadCount = notifications.filter(n => !n.read).length;

    const addNotification = useCallback((notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);

        // Play notification sound
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => { });
    }, []);

    const loadExistingNotifications = useCallback(async () => {
        try {
            const { data } = await supabase
                .from('cashier_notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                const mappedNotifications = data.map(n => ({
                    id: n.id,
                    type: n.type as any,
                    title: n.title,
                    message: n.message,
                    timestamp: new Date(n.created_at),
                    read: n.read,
                    orderId: n.order_id // Map correctly if exists
                }));
                setNotifications(mappedNotifications);
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }, []);

    useEffect(() => {
        // Load existing notifications from database
        loadExistingNotifications();

        // Subscribe to real-time order updates
        const ordersChannel = supabase
            .channel('cashier_notifications_orders')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'orders'
            }, (payload) => {
                addNotification({
                    id: crypto.randomUUID(),
                    type: 'order',
                    title: '🔔 Nueva Orden',
                    message: `Orden #${payload.new.id} - ${payload.new.order_type || 'Pedido'}`,
                    timestamp: new Date(),
                    read: false,
                    orderId: payload.new.id
                });
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders'
            }, (payload) => {
                if (payload.new.status === 'listo') {
                    addNotification({
                        id: crypto.randomUUID(),
                        type: 'alert',
                        title: '✅ Orden Lista',
                        message: `Orden #${payload.new.id} lista para entrega`,
                        timestamp: new Date(),
                        read: false,
                        orderId: payload.new.id
                    });
                }
            })
            .subscribe();

        // Subscribe to WhatsApp notifications from cashier_notifications table
        const whatsappChannel = supabase
            .channel('cashier_notifications_whatsapp')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'cashier_notifications'
            }, (payload) => {
                addNotification({
                    id: payload.new.id,
                    type: payload.new.type as any,
                    title: payload.new.title || 'Mensaje de WhatsApp',
                    message: payload.new.message,
                    timestamp: new Date(payload.new.created_at),
                    read: payload.new.read,
                    orderId: payload.new.order_id
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(whatsappChannel);
        };
    }, [loadExistingNotifications, addNotification]);

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);
        if (onAction) {
            onAction(notification);
        }
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'order': return 'receipt_long';
            case 'payment': return 'payments';
            case 'alert': return 'campaign';
            case 'info': return 'info';
        }
    };

    const getNotificationColor = (type: Notification['type']) => {
        switch (type) {
            case 'order': return 'bg-blue-50 border-blue-200 text-blue-700';
            case 'payment': return 'bg-green-50 border-green-200 text-green-700';
            case 'alert': return 'bg-orange-50 border-orange-200 text-orange-700';
            case 'info': return 'bg-gray-50 border-gray-200 text-gray-700';
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-end p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-[#f8f7f5] w-full max-w-sm h-full max-h-[90vh] lg:max-h-none rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-500">
                {/* Header */}
                <div className="p-6 pb-4 bg-white">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="size-10 bg-gradient-to-br from-[#181511] to-[#2d2520] rounded-xl flex items-center justify-center shadow-lg">
                                <span className="material-icons-round text-[#F7941D]">notifications</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-[#181511] tracking-tight">Centro de Avisos</h3>
                                {unreadCount > 0 && (
                                    <p className="text-[10px] font-black text-[#F7941D] uppercase tracking-widest">
                                        {unreadCount} Sin Leer
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-10 flex items-center justify-center rounded-xl bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-90"
                        >
                            <span className="material-icons-round text-xl">close</span>
                        </button>
                    </div>
                </div>

                {/* Actions Bar */}
                {notifications.length > 0 && (
                    <div className="px-6 py-2 bg-white flex gap-2">
                        <button
                            onClick={markAllAsRead}
                            className="flex-1 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#8c785f] bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            Leer Todo
                        </button>
                        <button
                            onClick={clearAll}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-red-400 bg-red-50/50 rounded-lg hover:bg-red-50 transition-colors"
                        >
                            Limpiar
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-40">
                            <span className="material-icons-round text-7xl mb-4">notifications_none</span>
                            <p className="font-black uppercase tracking-widest text-xs">Sin avisos nuevos</p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`group p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${!notification.read
                                    ? 'bg-white border-[#F7941D]/30 shadow-md ring-1 ring-[#F7941D]/10'
                                    : 'bg-white/50 border-gray-100 grayscale-[0.5] opacity-80'
                                    }`}
                            >
                                {!notification.read && (
                                    <div className="absolute top-0 left-0 w-1 h-full bg-[#F7941D]"></div>
                                )}
                                
                                <div className="flex gap-4">
                                    <div className={`size-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${getNotificationColor(notification.type)}`}>
                                        <span className="material-icons-round text-xl">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className={`font-black text-[13px] tracking-tight leading-tight ${!notification.read ? 'text-[#181511]' : 'text-[#8c785f]'}`}>
                                                {notification.title}
                                            </h4>
                                            <span className="text-[9px] text-gray-400 font-bold uppercase shrink-0">
                                                {notification.timestamp.toLocaleTimeString('es-ES', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[#8c785f] font-medium mb-3 line-clamp-2">
                                            {notification.message}
                                        </p>
                                        
                                        {notification.orderId && (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-[10px] font-black text-[#181511] uppercase group-hover:bg-[#181511] group-hover:text-white transition-all">
                                                    <span className="material-icons-round text-sm">visibility</span>
                                                    Ver Pedido
                                                </div>
                                                {!notification.read && <span className="size-2 bg-[#F7941D] rounded-full animate-ping"></span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                
                <div className="p-6 bg-white border-t border-gray-100">
                   <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest text-center">Casaleña Notification System v2.0</p>
                </div>
            </div>
        </div>
    );
}
