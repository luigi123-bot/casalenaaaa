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
    const [showQuickPay, setShowQuickPay] = useState<any | null>(null);
    const [quickPayAmount, setQuickPayAmount] = useState('');
    const [quickPayMethod, setQuickPayMethod] = useState('efectivo');
    const [isProcessing, setIsProcessing] = useState(false);
    
    const [showChat, setShowChat] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'all'>('today');
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel('cashier_orders_realtime_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                console.log('Realtime change detected:', payload.eventType);
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
            const userId = (await supabase.auth.getUser()).data.user?.id;
            const res = await fetch(`/api/orders?timeFilter=${timeFilter}${userId ? `&userId=${userId}` : ''}`);
            if (!res.ok) throw new Error('Failed to fetch orders');
            const data = await res.json();
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickPay = async (order: any) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const res = await fetch('/api/cashier/orders/process-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    amountPaid: quickPayAmount,
                    totalAmount: order.total_amount,
                    paymentMethod: quickPayMethod
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to process payment');
            }
            
            setShowQuickPay(null);
            setQuickPayAmount('');
            fetchOrders();
        } catch (error: any) {
            console.error('Error in quick pay:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const filterOrders = () => {
        let result = [...orders];

        if (statusFilter !== 'Todos') {
            if (statusFilter === 'PickUp') {
                result = result.filter(o => o.order_type === 'takeout' && o.status !== 'cancelado');
            } else if (statusFilter === 'Domicilio') {
                result = result.filter(o => o.order_type === 'delivery' && o.status !== 'cancelado');
            } else {
                const statusMap: { [key: string]: string[] } = {
                    'Finalizado': ['entregado', 'completado'],
                    'Preparando': ['confirmado', 'preparando'],
                    'Abiertas': ['pendiente', 'preparando', 'listo'],
                    'Listos': ['listo'],
                    'cancelado': ['cancelado'],
                    'Pendiente': ['pendiente']
                };
                const possibleStatuses = statusMap[statusFilter];
                if (possibleStatuses) {
                    result = result.filter(o => possibleStatuses.includes(o.status));
                }
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
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-green-100 text-green-700 border border-green-200">Finalizado</span>;
            case 'listo':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-purple-100 text-purple-700 border border-purple-200 animate-pulse">Listos</span>;
            case 'preparando':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-orange-100 text-orange-700 border border-orange-200">Preparando</span>;
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
                    { label: 'Abiertas', icon: 'restaurant_menu' },
                    { label: 'Preparando', icon: 'restaurant' },
                    { label: 'Listos', icon: 'task_alt' },
                    { label: 'PickUp', icon: 'shopping_bag' },
                    { label: 'Domicilio', icon: 'delivery_dining' },
                    { label: 'Finalizado', icon: 'check_circle' },
                    { label: 'cancelado', icon: 'cancel' },
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

                            {/* Action Buttons */}
                            <div className="grid grid-cols-2 gap-2 mt-4">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickPayAmount(order.total_amount.toString());
                                        setQuickPayMethod(order.payment_method || 'efectivo');
                                        setShowQuickPay(order);
                                    }}
                                    className="bg-green-600 text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-100 active:scale-95"
                                >
                                    <span className="material-icons-round text-sm">payments</span>
                                    COBRAR YA
                                </button>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedOrder({...order, _printOnly: true});
                                    }}
                                    className="bg-[#181511] text-white py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <span className="material-icons-round text-sm">print</span>
                                    PRE-VENTA
                                </button>
                            </div>
                            
                            <button 
                                onClick={() => setSelectedOrder(order)}
                                className="w-full mt-2 text-[#8c785f] py-1.5 font-bold text-[10px] uppercase tracking-widest hover:text-[#181511] transition-colors"
                            >
                                Ver Detalle Completo
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

            {/* Quick Pay Modal */}
            {showQuickPay && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-[#181511]/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center border-b border-gray-50">
                            <h3 className="text-xl font-black text-[#181511] uppercase tracking-tight">Cobro Rápido</h3>
                            <p className="text-xs text-[#8c785f] font-bold mt-1">Orden #{showQuickPay.id.toString().slice(-4)}</p>
                        </div>
                        
                        <div className="p-8">
                            <div className="text-center mb-8">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total a Pagar</p>
                                <p className="text-5xl font-black text-[#181511] tracking-tighter">${showQuickPay.total_amount.toFixed(2)}</p>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 rounded-2xl mb-2">
                                    {['efectivo', 'tarjeta', 'transferencia'].map((m) => (
                                        <button 
                                            key={m} 
                                            onClick={() => setQuickPayMethod(m)} 
                                            className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase transition-all ${quickPayMethod === m ? 'bg-white shadow-sm text-[#F7941D]' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>

                                <div className="bg-[#f8f7f5] rounded-2xl p-4 border-2 border-gray-100 focus-within:border-[#F7941D] transition-all">
                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-1">
                                        {quickPayMethod === 'efectivo' ? 'Efectivo Recibido' : 'Confirmar Monto'}
                                    </p>
                                    <div className="flex items-center text-3xl font-black text-[#181511]">
                                        <span className="mr-2 text-gray-300">$</span>
                                        <input 
                                            type="number"
                                            value={quickPayAmount}
                                            onChange={(e) => setQuickPayAmount(e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            autoFocus
                                            className="w-full bg-transparent outline-none placeholder-gray-200"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-2">
                                    <button onClick={() => setQuickPayAmount(showQuickPay.total_amount.toString())} className="py-2 bg-green-50 text-green-700 rounded-xl text-[10px] font-black border border-green-100 hover:bg-green-100">EXACTO</button>
                                    {[100, 200, 500].map(v => (
                                        <button key={v} onClick={() => setQuickPayAmount(v.toString())} className="py-2 bg-gray-50 text-gray-600 rounded-xl text-[10px] font-black border border-gray-100 hover:bg-gray-100">${v}</button>
                                    ))}
                                </div>

                                {parseFloat(quickPayAmount) > showQuickPay.total_amount && (
                                    <div className="p-4 bg-green-50 rounded-2xl flex justify-between items-center border border-green-100">
                                        <span className="text-[10px] font-black text-green-600 uppercase">Cambio</span>
                                        <span className="text-2xl font-black text-green-700">${(parseFloat(quickPayAmount) - showQuickPay.total_amount).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-gray-50 flex gap-3">
                            <button 
                                onClick={() => setShowQuickPay(null)}
                                className="flex-1 py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => handleQuickPay(showQuickPay)}
                                disabled={isProcessing || (parseFloat(quickPayAmount) < showQuickPay.total_amount && quickPayAmount !== '')}
                                className="flex-[2] bg-[#F7941D] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95 disabled:opacity-50"
                            >
                                {isProcessing ? 'CERRANDO...' : 'CONFIRMAR Y CERRAR'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
