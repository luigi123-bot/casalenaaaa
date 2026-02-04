'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import Link from 'next/link';

export default function MisPedidosPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

    useEffect(() => {
        fetchMyOrders();

        const channel = supabase
            .channel('my_orders_realtime')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
                const updatedOrder = payload.new as any;
                setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
                fetchMyOrders();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchMyOrders = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        products (name)
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

    const handleCancelOrder = async (orderId: number) => {
        if (!confirm('¿Estás seguro de que deseas cancelar este pedido? Se eliminará permanentemente.')) return;

        try {
            // 1. Call API to delete permanently
            const response = await fetch('/api/orders/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Error al cancelar');
            }

            alert('Pedido eliminado correctamente.');

            // 2. Notify Restaurant via WhatsApp
            const message = `Hola, he cancelado mi pedido #${orderId}. Por favor no lo preparen.`;
            const whatsappUrl = `https://wa.me/527411075056?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');

            fetchMyOrders(); // Refresh list immediately

        } catch (e: any) {
            console.error(e);
            alert(`No se pudo cancelar el pedido: ${e.message}`);
        }
    };

    const getWhatsAppLink = (order: any) => {
        const message = `Hola Casa Leña, tengo una duda con mi pedido #${order.id}.`;
        return `https://wa.me/527411075056?text=${encodeURIComponent(message)}`;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'entregado':
            case 'completado':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-green-100 text-green-700">Entregado</span>;
            case 'listo':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-purple-100 text-purple-700">Listo</span>;
            case 'preparando':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-orange-100 text-orange-700 animate-pulse border border-orange-200">En Cocina</span>;
            case 'confirmado':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-blue-100 text-blue-700">Confirmado</span>;
            case 'cancelado':
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-red-100 text-red-700">Cancelado</span>;
            default:
                return <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-yellow-100 text-yellow-700">Pendiente</span>;
        }
    };

    const activeOrders = orders.filter(o => ['pendiente', 'confirmado', 'preparando', 'listo'].includes(o.status));
    const historyOrders = orders.filter(o => ['entregado', 'completado', 'cancelado'].includes(o.status));
    const displayedOrders = activeTab === 'active' ? activeOrders : historyOrders;

    return (
        <div className="h-screen bg-[#f8f7f5] flex flex-col overflow-hidden">
            <header className="bg-white/80 backdrop-blur-md z-20 border-b border-[#e6e1db] shrink-0">
                <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/tienda" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#181511]">
                            <span className="material-symbols-outlined font-bold">arrow_back</span>
                        </Link>
                        <h1 className="text-xl font-black text-[#181511]">Seguimiento</h1>
                    </div>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('active')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'active' ? 'bg-white text-[#F27405] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Activos ({activeOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-[#181511] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Pasados
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 scroll-smooth">
                <div className="max-w-3xl mx-auto space-y-4 pb-20">
                    {loading ? (
                        [...Array(2)].map((_, i) => (
                            <div key={i} className="bg-white rounded-3xl p-8 border border-[#e6e1db] animate-pulse h-48"></div>
                        ))
                    ) : displayedOrders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <span className="material-symbols-outlined text-6xl text-gray-200 mb-4">receipt_long</span>
                            <h2 className="text-xl font-black text-[#181511]">No hay pedidos aquí</h2>
                            <p className="text-sm text-[#8c785f] mt-2">Toda la actividad de tus pedidos aparecerá en tiempo real.</p>
                        </div>
                    ) : (
                        displayedOrders.map((order) => {
                            const steps = ['pendiente', 'confirmado', 'preparando', 'listo'];
                            const currentStepIndex = steps.indexOf(order.status);
                            const isCancelled = order.status === 'cancelado';
                            const isDelivered = ['entregado', 'completado'].includes(order.status);

                            let progressPercent = 5;
                            if (isDelivered) progressPercent = 100;
                            else if (!isCancelled && currentStepIndex !== -1) {
                                progressPercent = Math.max(5, ((currentStepIndex + 1) / steps.length) * 100);
                            }

                            return (
                                <div key={order.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#e6e1db] relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="font-black text-lg text-[#181511]">Pedido #{order.id.toString().slice(-6)}</h3>
                                            <p className="text-xs text-[#8c785f] font-medium">Recibido {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                        {getStatusBadge(order.status)}
                                    </div>

                                    {activeTab === 'active' && !isCancelled && (
                                        <div className="mb-6">
                                            <div className="flex justify-between text-[8px] font-black text-[#8c785f] uppercase tracking-widest mb-2 px-1">
                                                <span className={currentStepIndex >= 0 ? 'text-[#F27405]' : 'opacity-40'}>Confirmado</span>
                                                <span className={currentStepIndex >= 1 ? 'text-[#F27405]' : 'opacity-40'}>En Cocina</span>
                                                <span className={currentStepIndex >= 2 ? 'text-[#F27405]' : 'opacity-40'}>En camino</span>
                                                <span className={currentStepIndex >= 3 ? 'text-green-600' : 'opacity-40'}>Listo</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-[#F27405] to-[#FF8C1A] transition-all duration-700 ease-out"
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                            <p className="text-xs text-center mt-3 font-bold text-[#181511]">
                                                {order.status === 'pendiente' && "⏳ Recibido, esperando confirmación..."}
                                                {order.status === 'confirmado' && "🔥 ¡Aceptado! Tu orden está en fila."}
                                                {order.status === 'preparando' && "🍳 Tu pedido está en el horno."}
                                                {order.status === 'listo' && "🛵 ¡Listo para entrega o salida!"}
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-2 mb-6 border-t border-b border-gray-50 py-3">
                                        {order.order_items.map((item: any) => (
                                            <div key={item.id} className="flex justify-between text-xs font-bold text-[#181511]">
                                                <span>{item.quantity}x {item.products?.name}</span>
                                                <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-[#8c785f] uppercase tracking-widest">Pago Total</span>
                                            <span className="text-lg font-black text-[#181511]">${order.total_amount.toFixed(2)}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {order.status === 'pendiente' && (
                                                <button
                                                    onClick={() => handleCancelOrder(order.id)}
                                                    className="px-4 py-2 rounded-xl bg-red-50 text-red-500 font-bold text-[10px] uppercase tracking-widest hover:bg-red-100 transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            )}
                                            <a
                                                href={getWhatsAppLink(order)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-4 py-2 rounded-xl bg-[#25D366] text-white font-black text-[10px] uppercase tracking-widest hover:bg-[#128C7E] transition-colors shadow-sm"
                                            >
                                                Soporte
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </main>
        </div>
    );
}
