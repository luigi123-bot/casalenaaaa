import { useRef, useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';

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

    const handleGeneratePDF = async () => {
        if (!order) {
            console.error('❌ [Admin-PDF] No hay orden seleccionada');
            return;
        }
        setUpdating(true);
        console.log('🚀 [Admin-PDF] Iniciando generación para orden:', order.id);

        try {
            const payload = {
                order: order,
                items: order.order_items,
                commerce: {
                    nombre: "Casalena Pizza & Grill",
                    telefono: "741-101-1595",
                    direccion: "Blvd. Juan N Alvarez, CP 41706"
                }
            };
            console.log('📤 [Admin-PDF] Payload enviado:', payload);

            const response = await fetch('/api/print/ticket', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log('📥 [Admin-PDF] Estado de respuesta:', response.status);
            const data = await response.json();

            if (data.url) {
                console.log('✅ [Admin-PDF] URL recibida:', data.url);
                window.open(data.url, '_blank');
            } else {
                console.error('❌ [Admin-PDF] El servidor no devolvió URL:', data);
                alert('No se pudo generar el PDF profesional. Revisa la consola para más detalles.');
            }
        } catch (err) {
            console.error('💥 [Admin-PDF] Error crítico:', err);
            alert('Error al conectar con el servidor de impresión profesional.');
        } finally {
            setUpdating(false);
        }
    };

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
                if (!showSuccessModal) onClose();
            }
        }
        if (order) document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [order, onClose, showSuccessModal]);

    useEffect(() => {
        if (showSuccessModal) {
            const timer = setTimeout(() => {
                handleGeneratePDF();
                setTimeout(() => {
                    setShowSuccessModal(false);
                    if (onStatusChange) onStatusChange();
                }, 3000);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [showSuccessModal]);

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

            if (newStatus === 'confirmado') {
                setShowSuccessModal(true);
            } else {
                if (onStatusChange) onStatusChange();
            }
        } catch (error: any) {
            console.error('[OrderAction] Exception:', error);
            alert(`No se pudo actualizar el pedido: ${error.message || 'Error de conexión'}`);
        } finally {
            setUpdating(false);
            console.log('[OrderAction] Process finished');
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

            {showSuccessModal && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-md">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-sm w-full text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-4xl text-green-600 animate-bounce">print</span>
                        </div>
                        <h3 className="text-2xl font-black text-[#181511] mb-2">¡Pedido Confirmado!</h3>
                        <p className="text-gray-500 mb-6 font-medium">Generando ticket y enviando a impresión...</p>
                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-[#F27405] h-full rounded-full animate-pulse w-full"></div>
                        </div>
                    </div>
                </div>
            )}

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
                                    <span className="font-bold text-[#181511] text-sm">{item.products?.name}</span>
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
                        {order.status === 'pendiente' && (
                            <button onClick={() => handleUpdateStatus('cancelado')} disabled={updating} className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined">cancel</span> Rechazar
                            </button>
                        )}
                        <button onClick={handleGeneratePDF} disabled={updating} className="w-full bg-[#181511] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:bg-black transition-all disabled:opacity-50">
                            <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                            Imprimir Ticket (PDF 58mm)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
