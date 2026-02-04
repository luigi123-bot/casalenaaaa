'use client';

import { useEffect, useState } from 'react';
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

export default function NotificationPanel({ onClose }: { onClose: () => void }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

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
                    message: `Orden #${payload.new.id} - ${payload.new.order_type}`,
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
                    title: payload.new.title,
                    message: payload.new.message,
                    timestamp: new Date(payload.new.created_at),
                    read: payload.new.read
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(whatsappChannel);
        };
    }, []);

    const loadExistingNotifications = async () => {
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
                    read: n.read
                }));
                setNotifications(mappedNotifications);
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    };

    useEffect(() => {
        setUnreadCount(notifications.filter(n => !n.read).length);
    }, [notifications]);

    const addNotification = (notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);

        // Play notification sound
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.3;
        audio.play().catch(() => { });
    };

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    const getNotificationIcon = (type: Notification['type']) => {
        switch (type) {
            case 'order':
                return 'receipt_long';
            case 'payment':
                return 'payments';
            case 'alert':
                return 'campaign';
            case 'info':
                return 'info';
        }
    };

    const getNotificationColor = (type: Notification['type']) => {
        switch (type) {
            case 'order':
                return 'bg-blue-50 border-blue-200 text-blue-700';
            case 'payment':
                return 'bg-green-50 border-green-200 text-green-700';
            case 'alert':
                return 'bg-orange-50 border-orange-200 text-orange-700';
            case 'info':
                return 'bg-gray-50 border-gray-200 text-gray-700';
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-end p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md h-full rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-5 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-[#181511] to-[#2d2520] text-white">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <span className="material-icons-round text-[#F7941D]">notifications_active</span>
                            <h3 className="text-xl font-black">Notificaciones</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="size-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <span className="material-icons-round text-lg">close</span>
                        </button>
                    </div>
                    {unreadCount > 0 && (
                        <p className="text-xs text-white/70">
                            Tienes {unreadCount} notificación{unreadCount !== 1 ? 'es' : ''} sin leer
                        </p>
                    )}
                </div>

                {/* Actions */}
                {notifications.length > 0 && (
                    <div className="p-4 border-b border-gray-100 flex gap-2">
                        <button
                            onClick={markAllAsRead}
                            className="flex-1 px-3 py-2 text-xs font-bold text-[#181511] bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Marcar todas leídas
                        </button>
                        <button
                            onClick={clearAll}
                            className="flex-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                        >
                            Limpiar todo
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {notifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <span className="material-icons-round text-6xl mb-3 opacity-20">notifications_none</span>
                            <p className="font-bold">Sin notificaciones</p>
                            <p className="text-xs">Te notificaremos sobre nuevas órdenes</p>
                        </div>
                    ) : (
                        notifications.map((notification) => (
                            <div
                                key={notification.id}
                                onClick={() => markAsRead(notification.id)}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${!notification.read
                                    ? 'bg-orange-50 border-[#F7941D] shadow-md'
                                    : 'bg-white border-gray-100'
                                    }`}
                            >
                                <div className="flex gap-3">
                                    <div className={`size-10 rounded-full flex items-center justify-center shrink-0 ${getNotificationColor(notification.type)}`}>
                                        <span className="material-icons-round text-lg">
                                            {getNotificationIcon(notification.type)}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <h4 className="font-black text-sm text-[#181511] leading-tight">
                                                {notification.title}
                                            </h4>
                                            {!notification.read && (
                                                <span className="size-2 bg-[#F7941D] rounded-full shrink-0 animate-pulse"></span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#8c785f] font-medium mb-2">
                                            {notification.message}
                                        </p>
                                        <span className="text-[10px] text-gray-400 font-bold">
                                            {notification.timestamp.toLocaleTimeString('es-ES', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
