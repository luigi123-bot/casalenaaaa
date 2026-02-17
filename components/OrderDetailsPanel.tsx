import { useRef, useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import { addPointsForOrder } from '@/utils/gamification';
import TicketPrintModal from './TicketPrintModal';
import { TicketData } from './Ticket58mm';

interface OrderItem {
    id: number;
    quantity: number;
    unit_price: number;
    products: {
        name: string;
        description: string;
    };
    extras?: any;
    selected_size?: string;
}

interface Order {
    id: number;
    created_at: string;
    status: string;
    total_amount: number;
    tax_amount: number;
    payment_method: string;
    order_items: OrderItem[];
    customer_name?: string;
    table_number?: string;
    order_type?: string;
    delivery_address?: string;
    phone_number?: string;
    user_id?: string; // Agregado para gamificación
}

interface OrderDetailsPanelProps {
    order: Order | null;
    onClose: () => void;
    onStatusChange?: () => void;
}

export default function OrderDetailsPanel({ order, onClose, onStatusChange }: OrderDetailsPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [updating, setUpdating] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);

    const handlePrintTicket = () => {
        if (!order) return;

        const data: TicketData = {
            atendido_por: localStorage.getItem('cached_cashier_name') || 'CAJERO',
            comercio: {
                nombre: "Casalena Pizza & Grill",
                telefono: "741-101-1595",
                direccion: "Blvd. Juan N Alvarez, CP 41706"
            },
            pedido: {
                id: order.id.toString(),
                tipo: order.order_type || 'Comedor',
                mesa: order.table_number || '',
                subtotal: order.total_amount,
                total: order.total_amount,
                metodo_pago: order.payment_method || 'Efectivo',
                pago_con: order.total_amount,
                cambio: 0,
            },
            productos: order.order_items.map(it => {
                let extrasNames: string[] = [];
                if (Array.isArray(it.extras)) {
                    extrasNames = it.extras.map((ex: any) => {
                        if (typeof ex === 'string') return ex;
                        if (ex && typeof ex === 'object') return ex.name || ex.id || ex.type || '';
                        return '';
                    }).filter(Boolean);
                }

                return {
                    cantidad: it.quantity,
                    nombre: (it as any).product_name || it.products?.name || 'Producto',
                    precio: it.unit_price,
                    detalle: it.selected_size || '',
                    extras: extrasNames.length > 0 ? extrasNames : undefined
                };
            }),
            cliente: order.order_type === 'delivery' ? {
                nombre: order.customer_name || 'Cliente',
                telefono: order.phone_number || '',
                direccion: order.delivery_address || ''
            } : undefined
        };

        setTicketData(data);
        setShowTicketModal(true);
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        }
        if (order) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [order, onClose]);

    if (!order) return null;

    const handleUpdateStatus = async (newStatus: string) => {
        if (updating) return;
        setUpdating(true);
        console.log(`[OrderAction] Attempting to update order ${order.id} to status: ${newStatus}`);

        try {
            // Use and await the update with a select() to verify it actually happened
            const { data, error } = await supabase
                .from('orders')
                .update({ status: newStatus })
                .eq('id', order.id)
                .select();

            if (error) {
                console.error('[OrderAction] DB Error:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                console.warn('[OrderAction] No rows updated. This usually means a policy (RLS) blocked the action.');
                throw new Error('No tienes permisos suficientes para actualizar esta orden.');
            }

            console.log('[OrderAction] Update successful:', data[0]);

            if (onStatusChange) onStatusChange();
            onClose();

        } catch (error: any) {
            console.error('[OrderAction] Exception:', error);
            alert(`No se pudo actualizar el pedido: ${error.message || 'Error de conexión'}`);
        } finally {
            setUpdating(false);
            console.log('[OrderAction] Process finished');
        }
    };

    const handleDeleteOrder = async () => {
        if (!confirm('¿CONFIRMAR CANCELACIÓN? Se eliminará de la base de datos y se notificará al cliente.')) return;
        setUpdating(true);

        try {
            // 1. Delete via API
            const response = await fetch('/api/orders/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id })
            });

            if (!response.ok) throw new Error('Error al eliminar');

            // 2. Notify Customer via WhatsApp
            if (order.phone_number) {
                const cleanPhone = order.phone_number.replace(/\D/g, '');
                const message = `Hola ${order.customer_name || 'Cliente'}, lamentamos informarle que su pedido #${order.id} ha sido cancelado.`;
                const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
                window.open(whatsappUrl, '_blank');
            }

            onClose();
            if (onStatusChange) onStatusChange();

        } catch (error: any) {
            console.error(error);
            alert('Error al cancelar pedido: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const StatusConfig: Record<string, { label: string, color: string, icon: string, nextStatus?: string, nextLabel?: string, nextColor?: string, nextIcon?: string }> = {
        'pendiente': {
            label: 'Pendiente', color: 'bg-yellow-50 border-yellow-200 text-yellow-800', icon: 'hourglass_empty',
            nextStatus: 'confirmado', nextLabel: 'Confirmar Pedido', nextColor: 'bg-[#0c4e36] hover:bg-[#083a27]', nextIcon: 'check_circle'
        },
        'confirmado': {
            label: 'Confirmado', color: 'bg-blue-50 border-blue-200 text-blue-800', icon: 'thumb_up',
            nextStatus: 'preparando', nextLabel: 'Empezar a Preparar', nextColor: 'bg-[#F27405] hover:bg-[#d66503]', nextIcon: 'cooking'
        },
        'preparando': {
            label: 'Preparando', color: 'bg-orange-50 border-orange-200 text-orange-800', icon: 'cooking',
            nextStatus: 'listo', nextLabel: 'Pedido Listo', nextColor: 'bg-indigo-600 hover:bg-indigo-700', nextIcon: 'restaurant'
        },
        'listo': {
            label: 'Listo', color: 'bg-purple-50 border-purple-200 text-purple-800', icon: 'room_service',
            nextStatus: 'entregado', nextLabel: 'Marcar como Entregado', nextColor: 'bg-gray-900 hover:bg-black', nextIcon: 'task_alt'
        },
        'entregado': {
            label: 'Entregado', color: 'bg-green-50 border-green-200 text-green-800', icon: 'check_circle'
        },
        'cancelado': {
            label: 'Cancelado', color: 'bg-red-50 border-red-200 text-red-800', icon: 'cancel'
        }
    };

    const currentStatus = StatusConfig[order.status] || { label: order.status, color: 'bg-gray-50', icon: 'info' };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
            <iframe ref={iframeRef} className="absolute w-0 h-0 border-none" title="Receipt" />


            <div ref={panelRef} className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                <div className="p-6 border-b border-[#e6e1db] flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-[#181511]">Orden #{order.id}</h2>
                        <p className="text-sm font-bold text-[#F27405] mt-1">{order.customer_name || 'Luis Gotopo'}</p>
                    </div>
                    <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full hover:bg-[#f5f2f0] text-[#8c785f]"><span className="material-symbols-outlined">close</span></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#fcfbf9]">
                    <div className={`rounded-2xl p-4 border-2 flex items-center justify-between ${currentStatus.color}`}>
                        <div className="flex items-center gap-3 font-black uppercase tracking-widest text-xs">
                            <span className="material-symbols-outlined text-xl">{currentStatus.icon}</span>
                            Estado: {currentStatus.label}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-[#8c785f] uppercase tracking-wider mb-2 border-b border-[#e6e1db] pb-2">Contenido</h3>
                        {order.order_items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <span className="font-black text-primary">{item.quantity}x</span>
                                    <span className="font-bold text-[#181511] text-sm">{(item as any).product_name || item.products?.name}</span>
                                </div>
                                <span className="font-bold text-[#181511] text-sm">${item.unit_price.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-[#e6e1db]">
                        <div className="grid grid-cols-2 gap-4 text-[11px]">
                            <div><p className="text-gray-400 font-bold uppercase mb-1">Tipo</p><p className="font-bold text-[#181511]">{order.order_type === 'delivery' ? 'Domicilio' : 'Comedor (' + (order.table_number || 'S/N') + ')'}</p></div>
                            <div><p className="text-gray-400 font-bold uppercase mb-1">Pago</p><p className="font-bold text-[#181511]">Efectivo</p></div>
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white border-t border-[#e6e1db] space-y-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
                    <div className="flex justify-between items-end">
                        <span className="text-xl font-black text-[#181511]">Total</span>
                        <span className="text-3xl font-black text-primary">${order.total_amount.toFixed(2)}</span>
                    </div>

                    <div className="flex flex-col gap-3">
                        {currentStatus.nextStatus && (
                            <button
                                onClick={() => handleUpdateStatus(currentStatus.nextStatus!)}
                                disabled={updating}
                                className={`w-full ${currentStatus.nextColor} text-white font-black py-5 rounded-2xl transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50`}
                            >
                                {updating ? <span className="material-symbols-outlined animate-spin">refresh</span> :
                                    <span className="material-symbols-outlined text-2xl">{currentStatus.nextIcon}</span>}
                                {currentStatus.nextLabel}
                            </button>
                        )}

                        <button
                            onClick={handlePrintTicket}
                            disabled={updating}
                            className="w-full bg-[#181511] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:bg-black transition-all disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-2xl">print</span>
                            Imprimir Ticket
                        </button>

                        <button
                            onClick={handleDeleteOrder}
                            disabled={updating}
                            className="w-full text-red-500 font-bold py-2 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center gap-2 text-xs"
                        >
                            <span className="material-symbols-outlined text-sm">delete</span> Eliminar Orden
                        </button>
                    </div>
                </div>

                <TicketPrintModal
                    isOpen={showTicketModal}
                    onClose={() => setShowTicketModal(false)}
                    data={ticketData}
                />
            </div>
        </div>
    );
}
