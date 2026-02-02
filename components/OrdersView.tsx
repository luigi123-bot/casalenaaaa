'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import OrderDetailsPanel from './OrderDetailsPanel';
import AdminChatPanel from './AdminChatPanel';

export default function OrdersView() {
    const [orders, setOrders] = useState<any[]>([]);
    const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('Todos');
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('realtime_orders_view')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        filterOrders();
    }, [orders, searchTerm, statusFilter]);

    const fetchOrders = async () => {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        id,
                        quantity,
                        unit_price,
                        products (
                            name,
                            description
                        )
                    )
                `)
                .order('created_at', { ascending: false });

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
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-purple-100 text-purple-700 border border-purple-200">Listo</span>;
            case 'preparando':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-orange-100 text-orange-700 border border-orange-200 animate-pulse">Cocinando</span>;
            case 'confirmado':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-blue-100 text-blue-700 border border-blue-200">Confirmado</span>;
            case 'cancelado':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-red-100 text-red-700 border border-red-200">Cancelado</span>;
            default:
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-yellow-100 text-yellow-700 border border-yellow-200">Pendiente</span>;
        }
    };

    return (
        <div className="flex-1 overflow-y-auto w-full p-6 lg:p-8 bg-[#f8f7f5] relative">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h2 className="text-3xl font-black text-[#181511] mb-1">Órdenes y Pedidos</h2>
                    <p className="text-[#8c785f]">Seguimiento en tiempo real de toda la operación.</p>
                </div>
                <button
                    onClick={() => setShowChat(true)}
                    className="flex items-center gap-2 bg-[#181511] text-white px-5 py-3 rounded-xl font-bold hover:bg-[#F27405] transition-all shadow-lg active:scale-95"
                >
                    <span className="material-symbols-outlined">chat</span>
                    Atención al Cliente
                </button>
            </div>

            <div className="bg-white rounded-2xl p-2 mb-6 flex items-center shadow-sm border border-[#e6e1db]">
                <span className="material-symbols-outlined text-[#8c785f] ml-3">search</span>
                <input
                    type="text"
                    placeholder="Buscar por ID, Cliente o Mesa..."
                    className="bg-transparent w-full p-3 outline-none text-[#181511] font-medium placeholder-[#8c785f]"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
                {[
                    { label: 'Todos' },
                    { label: 'Pendiente' },
                    { label: 'Preparando' },
                    { label: 'Listo' },
                    { label: 'Finalizado' },
                    { label: 'Cancelado' },
                ].map((filter) => {
                    const isActive = statusFilter === filter.label;
                    return (
                        <button
                            key={filter.label}
                            onClick={() => setStatusFilter(filter.label)}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest border transition-all whitespace-nowrap ${isActive
                                ? 'bg-[#F27405] text-white border-[#F27405] shadow-md transform -translate-y-0.5'
                                : 'bg-white border-[#e6e1db] text-[#8c785f] hover:bg-gray-50'
                                }`}
                        >
                            {filter.label}
                        </button>
                    )
                })}
            </div>

            <div className="bg-white rounded-[2.5rem] border border-[#e6e1db] overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead className="bg-[#fcfbf9] border-b border-[#e6e1db]">
                        <tr>
                            <th className="px-6 py-5 font-bold text-[#8c785f] text-[10px] uppercase tracking-widest">ID Orden</th>
                            <th className="px-6 py-5 font-bold text-[#8c785f] text-[10px] uppercase tracking-widest">Horario</th>
                            <th className="px-6 py-5 font-bold text-[#8c785f] text-[10px] uppercase tracking-widest">Cliente / Mesa</th>
                            <th className="px-6 py-5 font-bold text-[#8c785f] text-[10px] uppercase tracking-widest text-center">Tipo</th>
                            <th className="px-6 py-5 font-bold text-[#8c785f] text-[10px] uppercase tracking-widest text-center">Estado</th>
                            <th className="px-6 py-5 font-bold text-[#8c785f] text-[10px] uppercase tracking-widest text-right">Monto</th>
                            <th className="px-6 py-5 font-bold text-[#8c785f] text-[10px] uppercase tracking-widest text-right">Caja</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e6e1db]">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <tr key={i} className="animate-pulse">
                                    <td colSpan={7} className="px-6 py-8"><div className="h-6 bg-gray-100 rounded-lg w-full"></div></td>
                                </tr>
                            ))
                        ) : filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <span className="material-symbols-outlined text-4xl text-gray-200">receipt_long</span>
                                        <p className="text-[#8c785f] font-bold">Sin resultados para esta búsqueda</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((order) => (
                                <tr
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className="hover:bg-orange-50/30 transition-colors cursor-pointer group"
                                >
                                    <td className="px-6 py-5 text-sm font-black text-[#181511]">#{order.id.toString().slice(-4)}</td>
                                    <td className="px-6 py-5 text-xs text-[#8c785f] font-medium">{formatDate(order.created_at)}</td>
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-[#181511]">{order.customer_name || 'Cliente Casual'}</span>
                                            {order.table_number && <span className="text-[10px] text-primary font-bold">Mesa {order.table_number}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className={`material-symbols-outlined text-gray-400 text-lg`}>
                                            {order.order_type === 'delivery' ? 'delivery_dining' : 'restaurant'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        {getStatusBadge(order.status)}
                                    </td>
                                    <td className="px-6 py-5 text-right font-black text-[#181511]">${order.total_amount.toFixed(2)}</td>
                                    <td className="px-6 py-5 text-right">
                                        <button className="p-2 rounded-full group-hover:bg-primary/20 text-primary transition-colors">
                                            <span className="material-symbols-outlined text-xl">open_in_new</span>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

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

            {showChat && <AdminChatPanel onClose={() => setShowChat(false)} />}
        </div>
    );
}
