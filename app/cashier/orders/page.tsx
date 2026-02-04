'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import OrderDetailsPanel from '@/components/OrderDetailsPanel';
import CashierSupportChat from '@/components/CashierSupportChat';
import NotificationPanel from '@/components/NotificationPanel';

export default function CashierOrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [showChat, setShowChat] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'all'>('today');

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('cashier_orders_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [timeFilter]);

    useEffect(() => {
        filterOrders();
    }, [orders, searchTerm, statusFilter]);

    const fetchOrders = async () => {
        try {
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        id,
                        quantity,
                        unit_price,
                        product_name,
                        selected_size,
                        extras
                    )
                `)
                .order('created_at', { ascending: false });

            // Apply time filter
            if (timeFilter === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                query = query.gte('created_at', today.toISOString());
            } else if (timeFilter === 'week') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                query = query.gte('created_at', weekAgo.toISOString());
            }

            const { data, error } = await query;

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterOrders = () => {
        let result = [...orders];

        if (statusFilter !== 'Todos') {
            const statusMap: { [key: string]: string[] } = {
                'Finalizado': ['entregado', 'completado'],
                'Preparando': ['confirmado', 'preparando'],
                'Listo': ['listo'],
                'Cancelado': ['cancelado'],
                'Pendiente': ['pendiente']
            };
            const possibleStatuses = statusMap[statusFilter];
            if (possibleStatuses) {
                result = result.filter(o => possibleStatuses.includes(o.status));
            }
        }

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(o =>
                o.id.toString().includes(lowerTerm) ||
                (o.customer_name && o.customer_name.toLowerCase().includes(lowerTerm)) ||
                (o.table_number && o.table_number.toString().includes(lowerTerm)) ||
                o.total_amount.toString().includes(lowerTerm)
            );
        }

        setFilteredOrders(result);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const isToday = date.toDateString() === today.toDateString();
        const time = date.toLocaleString('es-ES', { timeStyle: 'short' });
        return isToday ? `Hoy, ${time}` : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'entregado':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-green-100 text-green-700 border border-green-200">Entregado</span>;
            case 'listo':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-purple-100 text-purple-700 border border-purple-200 animate-pulse">Listo</span>;
            case 'preparando':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-orange-100 text-orange-700 border border-orange-200">Cocinando</span>;
            case 'confirmado':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-blue-100 text-blue-700 border border-blue-200">Confirmado</span>;
            case 'cancelado':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-red-100 text-red-700 border border-red-200">Cancelado</span>;
            default:
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-yellow-100 text-yellow-700 border border-yellow-200">Pendiente</span>;
        }
    };

    const getOrderTypeIcon = (type: string) => {
        switch (type) {
            case 'delivery':
                return 'delivery_dining';
            case 'takeout':
                return 'shopping_bag';
            default:
                return 'restaurant';
        }
    };

    const calculateStats = () => {
        const activeOrders = filteredOrders.filter(o =>
            ['pendiente', 'confirmado', 'preparando', 'listo'].includes(o.status)
        ).length;

        const totalRevenue = filteredOrders
            .filter(o => o.status !== 'cancelado')
            .reduce((sum, o) => sum + o.total_amount, 0);

        return { activeOrders, totalRevenue };
    };

    const stats = calculateStats();

    return (
        <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8 bg-[#f8f7f5] relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-[#181511] mb-1">Rastreo de Pedidos</h2>
                    <p className="text-sm text-[#8c785f]">
                        {stats.activeOrders} activos • ${stats.totalRevenue.toFixed(2)} total
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowNotifications(true)}
                        className="size-11 bg-white rounded-xl border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <span className="material-icons-round text-[#181511]">notifications</span>
                    </button>

                    <button
                        onClick={() => setShowChat(true)}
                        className="flex items-center gap-2 bg-[#181511] text-white px-4 py-2.5 rounded-xl font-bold hover:bg-[#F7941D] transition-all shadow-md active:scale-95"
                    >
                        <span className="material-icons-round text-lg">support_agent</span>
                        <span className="hidden sm:inline">Soporte</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Search */}
                <div className="bg-white rounded-xl p-2 flex items-center shadow-sm border border-gray-200">
                    <span className="material-icons-round text-[#8c785f] ml-2">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por ID, Cliente, Mesa..."
                        className="bg-transparent w-full p-2 outline-none text-sm text-[#181511] font-medium placeholder-[#8c785f]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="mr-2 text-gray-400 hover:text-red-500"
                        >
                            <span className="material-icons-round text-lg">close</span>
                        </button>
                    )}
                </div>

                {/* Time Filter */}
                <div className="flex gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-200">
                    {[
                        { value: 'today' as const, label: 'Hoy' },
                        { value: 'week' as const, label: 'Semana' },
                        { value: 'all' as const, label: 'Todo' }
                    ].map(filter => (
                        <button
                            key={filter.value}
                            onClick={() => setTimeFilter(filter.value)}
                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black uppercase transition-all ${timeFilter === filter.value
                                    ? 'bg-[#F7941D] text-white shadow-sm'
                                    : 'text-[#8c785f] hover:bg-gray-50'
                                }`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {[
                    { label: 'Todos', icon: 'apps' },
                    { label: 'Pendiente', icon: 'schedule' },
                    { label: 'Preparando', icon: 'restaurant' },
                    { label: 'Listo', icon: 'task_alt' },
                    { label: 'Finalizado', icon: 'check_circle' },
                    { label: 'Cancelado', icon: 'cancel' },
                ].map((filter) => {
                    const isActive = statusFilter === filter.label;
                    return (
                        <button
                            key={filter.label}
                            onClick={() => setStatusFilter(filter.label)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap ${isActive
                                    ? 'bg-[#F7941D] text-white border-[#F7941D] shadow-md'
                                    : 'bg-white border-gray-200 text-[#8c785f] hover:bg-gray-50'
                                }`}
                        >
                            <span className="material-icons-round text-sm">{filter.icon}</span>
                            {filter.label}
                        </button>
                    );
                })}
            </div>

            {/* Orders Grid/List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {loading ? (
                    [...Array(6)].map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 animate-pulse">
                            <div className="h-24 bg-gray-100 rounded-lg"></div>
                        </div>
                    ))
                ) : filteredOrders.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-gray-200">
                        <span className="material-icons-round text-6xl text-gray-200 mb-3">receipt_long</span>
                        <p className="text-[#8c785f] font-bold">No hay órdenes para mostrar</p>
                        <p className="text-xs text-gray-400 mt-1">Intenta cambiar los filtros</p>
                    </div>
                ) : (
                    filteredOrders.map((order) => (
                        <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="bg-white rounded-2xl border-2 border-gray-100 hover:border-[#F7941D] p-5 transition-all cursor-pointer group hover:shadow-lg"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-12 bg-orange-50 rounded-xl flex items-center justify-center group-hover:bg-[#F7941D] transition-colors">
                                        <span className="material-icons-round text-[#F7941D] group-hover:text-white">
                                            {getOrderTypeIcon(order.order_type)}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-black text-lg text-[#181511]">
                                            #{order.id.toString().slice(-4)}
                                        </p>
                                        <p className="text-[10px] text-gray-400 font-bold">
                                            {formatDate(order.created_at)}
                                        </p>
                                    </div>
                                </div>
                                {getStatusBadge(order.status)}
                            </div>

                            {/* Customer Info */}
                            <div className="mb-4 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-icons-round text-sm text-gray-400">person</span>
                                    <p className="text-sm font-bold text-[#181511]">
                                        {order.customer_name || 'Cliente Casual'}
                                    </p>
                                </div>
                                {order.table_number && (
                                    <div className="flex items-center gap-2">
                                        <span className="material-icons-round text-sm text-gray-400">table_restaurant</span>
                                        <p className="text-xs text-[#8c785f] font-bold">Mesa {order.table_number}</p>
                                    </div>
                                )}
                                {order.delivery_address && (
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="material-icons-round text-sm text-gray-400">location_on</span>
                                        <p className="text-xs text-[#8c785f] line-clamp-1">{order.delivery_address}</p>
                                    </div>
                                )}
                            </div>

                            {/* Order Items */}
                            <div className="space-y-2 mb-4">
                                {order.order_items?.slice(0, 2).map((item: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center">
                                        <p className="text-xs text-[#8c785f] font-medium">
                                            {item.quantity}x {item.product_name}
                                        </p>
                                        <p className="text-xs font-bold text-[#181511]">
                                            ${(item.unit_price * item.quantity).toFixed(2)}
                                        </p>
                                    </div>
                                ))}
                                {order.order_items?.length > 2 && (
                                    <p className="text-[10px] text-gray-400 font-bold">
                                        +{order.order_items.length - 2} más...
                                    </p>
                                )}
                            </div>

                            {/* Total */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                <p className="text-xs font-black text-[#8c785f] uppercase">Total</p>
                                <p className="text-2xl font-black text-[#181511]">
                                    ${order.total_amount.toFixed(2)}
                                </p>
                            </div>

                            {/* Action Button */}
                            <button className="w-full mt-4 bg-[#181511] text-white py-2.5 rounded-xl font-bold text-sm group-hover:bg-[#F7941D] transition-all flex items-center justify-center gap-2">
                                <span>Ver Detalles</span>
                                <span className="material-icons-round text-sm">arrow_forward</span>
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* Modals */}
            {selectedOrder && (
                <OrderDetailsPanel
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onStatusChange={() => {
                        fetchOrders();
                        setSelectedOrder(null);
                    }}
                />
            )}

            {showChat && <CashierSupportChat onClose={() => setShowChat(false)} />}
            {showNotifications && <NotificationPanel onClose={() => setShowNotifications(false)} />}
        </div>
    );
}
