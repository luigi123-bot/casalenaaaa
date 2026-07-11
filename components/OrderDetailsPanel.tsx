'use client';

import { useRef, useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import TicketPrintModal from './TicketPrintModal';
import { TicketData } from './Ticket58mm';
import DeliveryMap from './DeliveryMap';

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
    user_id?: string;
}

interface OrderDetailsPanelProps {
    order: Order | null;
    onClose: () => void;
    onStatusChange?: () => void;
}

export default function OrderDetailsPanel({ order, onClose, onStatusChange }: OrderDetailsPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [showTicketModal, setShowTicketModal] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [ticketData, setTicketData] = useState<TicketData | null>(null);
    const [repartidores, setRepartidores] = useState<any[]>([]);
    const [selectedRepartidor, setSelectedRepartidor] = useState<string>('');
    const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
    const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
    const ORIGIN: [number, number] = [16.6853, -98.4116]; 

    useEffect(() => {
        console.log('[OrderDetailsPanel] 🔄 useEffect de order/printOnly ejecutado. order_id:', order?.id, ' | _printOnly:', order ? (order as any)._printOnly : 'no-order');
        if (order && (order as any)._printOnly) {
            console.log('[OrderDetailsPanel] ➡️ Detectado _printOnly en la orden, imprimiendo...');
            handlePrintTicket();
        }
    }, [order]);

    useEffect(() => {
        if (!order || !selectedRepartidor || order.order_type !== 'delivery') {
            setDriverLocation(null);
            return;
        }
        const channel = supabase.channel(`admin_tracking_${selectedRepartidor}`);
        const fetchInitialLoc = async () => {
            const res = await fetch(`/api/cashier/drivers?id=${selectedRepartidor}`);
            if (res.ok) {
                const data = await res.json();
                if (data?.current_lat && data?.current_lng) {
                    setDriverLocation([data.current_lat, data.current_lng]);
                }
            }
        };
        fetchInitialLoc();
        channel.on('broadcast', { event: 'location_update' }, (payload) => {
            if (payload.payload.lat && payload.payload.lng) {
                setDriverLocation([payload.payload.lat, payload.payload.lng]);
            }
        }).subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedRepartidor, order]);

    useEffect(() => {
        if (!order?.delivery_address || order.order_type !== 'delivery') {
            setDestinationCoords(null);
            return;
        }
        fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(order.delivery_address)}`)
            .then(r => r.json())
            .then(data => {
                if (data && data.length > 0) {
                    setDestinationCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
                }
            }).catch(e => console.error(e));
    }, [order?.delivery_address, order?.order_type]);

    const handlePrintTicket = () => {
        console.log('[OrderDetailsPanel] 🖨️ handlePrintTicket() invocado para la orden:', order?.id);
        if (!order) {
            console.warn('[OrderDetailsPanel] ⚠️ handlePrintTicket() cancelado: no hay orden.');
            return;
        }
        console.log('[OrderDetailsPanel] 📋 Datos de la orden para imprimir:', order);
        const data: TicketData = {
            atendido_por: (order as any).cashier_name || (typeof window !== 'undefined' ? localStorage.getItem('cached_cashier_name') || 'CAJERO' : 'CAJERO'),
            comercio: { nombre: "Casalena Pizza & Grill", telefono: "741-101-1595", direccion: "Blvd. Juan N Alvarez, CP 41706" },
            pedido: {
                id: order.id.toString(),
                tipo: order.order_type || 'Comedor',
                mesa: order.table_number || '',
                subtotal: order.total_amount,
                total: order.total_amount,
                metodo_pago: order.payment_method || 'Efectivo',
                pago_con: order.total_amount,
                cambio: 0,
                // ✅ FIX: pasar ticket_number para mostrar el número diario, no el ID global
                ticket_number: (order as any).ticket_number ?? undefined,
            },
            productos: order.order_items.map(it => ({
                cantidad: it.quantity,
                nombre: (it as any).product_name || it.products?.name || 'Producto',
                precio: it.unit_price,
                detalle: it.selected_size || '',
                extras: Array.isArray(it.extras) ? it.extras.map((ex: any) => typeof ex === 'string' ? ex : (ex?.name || ex?.id || '')).filter(Boolean) : undefined
            })),
            cliente: order.order_type === 'delivery' ? {
                nombre: order.customer_name || 'Cliente',
                telefono: order.phone_number || '',
                direccion: order.delivery_address || ''
            } : undefined
        };
        console.log('[OrderDetailsPanel] 📄 TicketData generado:', data);
        setTicketData(data);
        setShowTicketModal(true);
        console.log('[OrderDetailsPanel] 🚀 showTicketModal establecido en true y ticketData guardado');
    };

    useEffect(() => {
        const fetchRepartidores = async () => {
            const res = await fetch('/api/cashier/drivers');
            if (res.ok) {
                const data = await res.json();
                setRepartidores(data || []);
            }
        };
        fetchRepartidores();
        if (order && (order as any).driver_id) {
            setSelectedRepartidor((order as any).driver_id);
        } else {
            setSelectedRepartidor('');
        }
    }, [order]);

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

    if ((order as any)._printOnly) {
        return (
            <TicketPrintModal
                isOpen={showTicketModal}
                onClose={() => {
                    setShowTicketModal(false);
                    onClose();
                }}
                data={ticketData}
            />
        );
    }

    const handleUpdateStatus = async (newStatus: string) => {
        if (updating) return;
        setUpdating(true);
        try {
            const updateData: any = { status: newStatus };
            if (newStatus === 'entregado') {
                updateData.payment_status = 'paid';
            }
            const res = await fetch('/api/cashier/orders/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: order.id,
                    ...updateData
                })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status}`);
            }
            if (onStatusChange) onStatusChange();
            onClose();
        } catch (error: any) {
            alert(`Error: ${error.message}`);
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteOrder = async () => {
        if (!confirm('¿CONFIRMAR CANCELACIÓN?')) return;
        setUpdating(true);
        try {
            await fetch('/api/orders/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId: order.id }) });
            onClose();
            if (onStatusChange) onStatusChange();
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const StatusConfig: Record<string, { label: string, color: string, icon: string, nextStatus?: string, nextLabel?: string, nextColor?: string, nextIcon?: string }> = {
        'pendiente': { label: 'Pendiente', color: 'bg-yellow-50 text-yellow-800', icon: 'hourglass_empty', nextStatus: 'confirmado', nextLabel: 'Confirmar Pedido', nextColor: 'bg-[#0c4e36]', nextIcon: 'check_circle' },
        'confirmado': { label: 'Confirmado', color: 'bg-blue-50 text-blue-800', icon: 'thumb_up', nextStatus: 'preparando', nextLabel: 'Empezar a Preparar', nextColor: 'bg-[#F27405]', nextIcon: 'cooking' },
        'preparando': { label: 'Preparando', color: 'bg-orange-50 text-orange-800', icon: 'cooking', nextStatus: 'listo', nextLabel: 'Pedido Listo', nextColor: 'bg-indigo-600', nextIcon: 'restaurant' },
        'listo': { label: 'Listo', color: 'bg-purple-50 text-purple-800', icon: 'room_service', nextStatus: 'entregado', nextLabel: 'Marcar como Entregado', nextColor: 'bg-gray-900', nextIcon: 'task_alt' },
        'entregado': { label: 'Entregado', color: 'bg-green-50 text-green-800', icon: 'check_circle' },
        'cancelado': { label: 'Cancelado', color: 'bg-red-50 text-red-800', icon: 'cancel' }
    };
    const currentStatus = StatusConfig[order.status] || { label: order.status, color: 'bg-gray-50', icon: 'info' };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
            <iframe ref={iframeRef} className="absolute w-0 h-0 border-none" title="Receipt" />
            <div ref={panelRef} className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
                <div className="p-6 border-b border-[#e6e1db] flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-[#181511]">Orden #{order.id}</h2>
                        <p className="text-sm font-bold text-[#F27405] mt-1">{order.customer_name || 'Cliente'}</p>
                    </div>
                    <button onClick={onClose} className="size-8 flex items-center justify-center rounded-full hover:bg-gray-100"><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-[#fcfbf9]">
                    <div className={`rounded-2xl p-4 border flex items-center justify-between ${currentStatus.color}`}>
                        <div className="flex items-center gap-3 font-black uppercase text-xs">
                            <span className="material-symbols-outlined">{currentStatus.icon}</span>
                            Estado: {currentStatus.label}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h3 className="text-xs font-bold text-[#8c785f] uppercase tracking-wider border-b pb-2">Contenido</h3>
                        {order.order_items?.map((item) => (
                            <div key={item.id} className="flex justify-between items-start text-sm font-bold">
                                <span>{item.quantity}x {(item as any).product_name || item.products?.name}</span>
                                <span>${(item.unit_price ?? 0).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="bg-white rounded-2xl p-4 border border-[#e6e1db] space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-[11px] border-b pb-3">
                            <div><p className="text-gray-400 font-bold uppercase">Tipo</p><p className="font-bold">{order.order_type === 'delivery' ? 'Domicilio' : 'Comedor'}</p></div>
                            <div><p className="text-gray-400 font-bold uppercase">Pago</p><p className="font-bold">{order.payment_method}</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-[11px]">
                            <div><p className="text-gray-400 font-bold uppercase">Tomado por</p><p className="font-bold text-primary">{(order as any).cashier_name || 'Web'}</p></div>
                            {order.order_type === 'delivery' && (
                                <div>
                                    <p className="text-gray-400 font-bold uppercase">Repartidor</p>
                                    <select value={selectedRepartidor} onChange={(e) => setSelectedRepartidor(e.target.value)} className="w-full bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 outline-none text-[10px]">
                                        <option value="">Sin asignar</option>
                                        {repartidores.map(r => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
                        {order.order_type === 'delivery' && (
                            <div className="space-y-3 pt-4 border-t">
                                <h3 className="text-xs font-bold text-[#8c785f] uppercase">Rastreo en Vivo</h3>
                                <div className="h-[200px] w-full rounded-2xl overflow-hidden relative z-0 border">
                                    <DeliveryMap origin={ORIGIN} destination={destinationCoords} driverLocation={driverLocation} driverName="Moto" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="p-6 bg-white border-t border-[#e6e1db] space-y-4 shadow-lg">
                    <div className="flex justify-between items-end">
                        <span className="text-xl font-black">Total</span>
                        <span className="text-3xl font-black text-primary">${(order.total_amount ?? 0).toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                        {currentStatus.nextStatus && (
                            <button onClick={() => handleUpdateStatus(currentStatus.nextStatus!)} disabled={updating} className={`w-full ${currentStatus.nextColor} text-white font-black py-5 rounded-2xl shadow-lg`}>
                                {currentStatus.nextLabel}
                            </button>
                        )}
                        <button onClick={handlePrintTicket} className="w-full bg-[#181511] text-white font-black py-4 rounded-2xl">Imprimir Ticket</button>
                        <button onClick={handleDeleteOrder} className="w-full text-red-500 font-bold py-2 text-xs">Eliminar Orden</button>
                    </div>
                </div>
                <TicketPrintModal isOpen={showTicketModal} onClose={() => setShowTicketModal(false)} data={ticketData} />
            </div>
        </div>
    );
}
