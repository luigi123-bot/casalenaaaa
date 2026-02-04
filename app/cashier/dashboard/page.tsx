'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import Link from 'next/link';
import NotificationPanel from '@/components/NotificationPanel';
import CashierSupportChat from '@/components/CashierSupportChat';

interface QuickStats {
    todayOrders: number;
    todayRevenue: number;
    pendingOrders: number;
    readyOrders: number;
}

export default function CashierDashboard() {
    const [stats, setStats] = useState<QuickStats>({
        todayOrders: 0,
        todayRevenue: 0,
        pendingOrders: 0,
        readyOrders: 0
    });
    const [recentOrders, setRecentOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [unreadNotifications, setUnreadNotifications] = useState(0);

    useEffect(() => {
        fetchDashboardData();

        // Real-time subscription
        const channel = supabase
            .channel('cashier_dashboard')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'orders'
            }, () => {
                fetchDashboardData();
                setUnreadNotifications(prev => prev + 1);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch today's orders
        const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .gte('created_at', today.toISOString());

        if (orders) {
            const todayRevenue = orders
                .filter(o => o.status !== 'cancelado')
                .reduce((sum, o) => sum + o.total_amount, 0);

            setStats({
                todayOrders: orders.length,
                todayRevenue,
                pendingOrders: orders.filter(o =>
                    ['pendiente', 'confirmado', 'preparando'].includes(o.status)
                ).length,
                readyOrders: orders.filter(o => o.status === 'listo').length
            });
        }

        // Fetch recent orders
        const { data: recent } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recent) {
            setRecentOrders(recent);
        }

        setLoading(false);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'entregado':
                return <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-green-100 text-green-700">ENTREGADO</span>;
            case 'listo':
                return <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-purple-100 text-purple-700 animate-pulse">LISTO</span>;
            case 'preparando':
                return <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-orange-100 text-orange-700">COCINANDO</span>;
            case 'confirmado':
                return <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-blue-100 text-blue-700">CONFIRMADO</span>;
            case 'cancelado':
                return <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-red-100 text-red-700">CANCELADO</span>;
            default:
                return <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-yellow-100 text-yellow-700">PENDIENTE</span>;
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

        if (diffMinutes < 1) return 'Ahora';
        if (diffMinutes < 60) return `Hace ${diffMinutes}m`;
        return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="flex-1 overflow-y-auto bg-[#f8f7f5] p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-[#181511] mb-1">Panel de Caja</h1>
                    <p className="text-sm text-[#8c785f]">Gestiona tus ventas y operaciones del día</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowNotifications(true)}
                        className="relative size-11 bg-white rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <span className="material-icons-round text-[#181511]">notifications</span>
                        {unreadNotifications > 0 && (
                            <span className="absolute -top-1 -right-1 size-5 bg-[#F7941D] text-white text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                                {unreadNotifications > 9 ? '9+' : unreadNotifications}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setShowChat(true)}
                        className="size-11 bg-white rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <span className="material-icons-round text-[#181511]">support_agent</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
                    <div className="flex items-start justify-between mb-3">
                        <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="material-icons-round text-xl">receipt_long</span>
                        </div>
                        {loading && <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                    <p className="text-3xl font-black mb-1">{stats.todayOrders}</p>
                    <p className="text-xs font-bold uppercase tracking-wide opacity-90">Órdenes Hoy</p>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
                    <div className="flex items-start justify-between mb-3">
                        <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="material-icons-round text-xl">payments</span>
                        </div>
                        {loading && <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                    <p className="text-3xl font-black mb-1">${stats.todayRevenue.toFixed(0)}</p>
                    <p className="text-xs font-bold uppercase tracking-wide opacity-90">Ingresos Hoy</p>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
                    <div className="flex items-start justify-between mb-3">
                        <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <span className="material-icons-round text-xl">hourglass_empty</span>
                        </div>
                        {loading && <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                    <p className="text-3xl font-black mb-1">{stats.pendingOrders}</p>
                    <p className="text-xs font-bold uppercase tracking-wide opacity-90">En Proceso</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
                    <div className="flex items-start justify-between mb-3">
                        <div className="size-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                            <span className="material-icons-round text-xl">delivery_dining</span>
                        </div>
                        {loading && <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    </div>
                    <p className="text-3xl font-black mb-1">{stats.readyOrders}</p>
                    <p className="text-xs font-bold uppercase tracking-wide opacity-90">Listos</p>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <Link
                    href="/cashier"
                    className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#F7941D] hover:shadow-md transition-all group"
                >
                    <div className="size-12 bg-orange-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-[#F7941D] transition-colors">
                        <span className="material-icons-round text-2xl text-[#F7941D] group-hover:text-white">point_of_sale</span>
                    </div>
                    <h3 className="font-black text-sm text-[#181511] mb-1">Terminal de Caja</h3>
                    <p className="text-[10px] text-[#8c785f]">Nueva venta</p>
                </Link>

                <Link
                    href="/cashier/orders"
                    className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#F7941D] hover:shadow-md transition-all group"
                >
                    <div className="size-12 bg-blue-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-blue-500 transition-colors">
                        <span className="material-icons-round text-2xl text-blue-500 group-hover:text-white">receipt_long</span>
                    </div>
                    <h3 className="font-black text-sm text-[#181511] mb-1">Ver Órdenes</h3>
                    <p className="text-[10px] text-[#8c785f]">Seguimiento</p>
                </Link>

                <button
                    onClick={() => setShowChat(true)}
                    className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#F7941D] hover:shadow-md transition-all group text-left"
                >
                    <div className="size-12 bg-purple-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-purple-500 transition-colors">
                        <span className="material-icons-round text-2xl text-purple-500 group-hover:text-white">support_agent</span>
                    </div>
                    <h3 className="font-black text-sm text-[#181511] mb-1">Chat Soporte</h3>
                    <p className="text-[10px] text-[#8c785f]">Ayuda rápida</p>
                </button>

                <Link
                    href="/cashier/inventory"
                    className="bg-white rounded-xl p-4 border border-gray-200 hover:border-[#F7941D] hover:shadow-md transition-all group"
                >
                    <div className="size-12 bg-green-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-500 transition-colors">
                        <span className="material-icons-round text-2xl text-green-500 group-hover:text-white">inventory_2</span>
                    </div>
                    <h3 className="font-black text-sm text-[#181511] mb-1">Inventario</h3>
                    <p className="text-[10px] text-[#8c785f]">Stock</p>
                </Link>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-black text-lg text-[#181511]">Órdenes Recientes</h2>
                    <Link
                        href="/cashier/orders"
                        className="text-xs font-bold text-[#F7941D] hover:underline underline-offset-2"
                    >
                        Ver todas →
                    </Link>
                </div>

                <div className="divide-y divide-gray-100">
                    {loading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="p-5 animate-pulse">
                                <div className="h-12 bg-gray-100 rounded-lg"></div>
                            </div>
                        ))
                    ) : recentOrders.length === 0 ? (
                        <div className="p-12 text-center">
                            <span className="material-icons-round text-4xl text-gray-200 mb-2">receipt_long</span>
                            <p className="text-sm text-[#8c785f] font-bold">No hay órdenes recientes</p>
                        </div>
                    ) : (
                        recentOrders.map((order) => (
                            <Link
                                key={order.id}
                                href="/cashier/orders"
                                className="p-5 hover:bg-orange-50/30 transition-colors flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="size-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-[#F7941D] transition-colors">
                                        <span className="material-icons-round text-[#F7941D] group-hover:text-white">
                                            {order.order_type === 'delivery' ? 'delivery_dining' : 'restaurant'}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-black text-sm text-[#181511]">
                                                Orden #{order.id.toString().slice(-4)}
                                            </p>
                                            {getStatusBadge(order.status)}
                                        </div>
                                        <p className="text-xs text-[#8c785f]">
                                            {order.customer_name || 'Cliente Casual'}
                                            {order.table_number && ` • Mesa ${order.table_number}`}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right ml-4">
                                    <p className="font-black text-lg text-[#181511]">${order.total_amount.toFixed(2)}</p>
                                    <p className="text-[10px] text-gray-400 font-bold">{formatTime(order.created_at)}</p>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>

            {/* Modals */}
            {showNotifications && (
                <NotificationPanel onClose={() => {
                    setShowNotifications(false);
                    setUnreadNotifications(0);
                }} />
            )}

            {showChat && <CashierSupportChat onClose={() => setShowChat(false)} />}
        </div>
    );
}
