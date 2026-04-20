'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import DeliveryMap from '@/components/DeliveryMap';

export default function RepartidorApp() {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<any>(null);
    const [assignedOrder, setAssignedOrder] = useState<any>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    
    const watchId = useRef<number | null>(null);
    const channelRef = useRef<any>(null);

    // Initial load: get drivers
    useEffect(() => {
        const fetchDrivers = async () => {
            const { data } = await supabase.from('delivery_drivers').select('*').eq('is_active', true);
            if (data) setDrivers(data);
        };
        fetchDrivers();
    }, []);

    // Load active order for the selected driver
    useEffect(() => {
        if (!selectedDriver) return;

        const checkOrder = async () => {
            console.log(`[Repartidor] Verificando orden activa para driver_id:`, selectedDriver.id);
            const { data, error } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('driver_id', selectedDriver.id)
                .in('delivery_status', ['assigned', 'picked_up'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            console.log(`[Repartidor] Resultado BD:`, { data, error });

            if (error) {
                console.error("Driver checkOrder error:", error);
            }

            if (data) {
                setAssignedOrder(data);
            } else {
                setAssignedOrder(null);
            }
        };

        checkOrder();
        
        // Listen for new assignments
        const sub = supabase.channel('driver-updates-' + selectedDriver.id)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'orders',
                filter: `driver_id=eq.${selectedDriver.id}`
            }, (payload) => {
                checkOrder();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(sub);
        };
    }, [selectedDriver]);

    // Handle Location Tracking
    useEffect(() => {
        if (!selectedDriver || !isTracking) {
            if (watchId.current) {
                navigator.geolocation.clearWatch(watchId.current);
                watchId.current = null;
            }
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
            return;
        }

        // Initialize Supabase Broadcast Channel
        const channel = supabase.channel(`tracking_driver_${selectedDriver.id}`, {
            config: {
                broadcast: { ack: false },
            },
        });

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log('Started broadcasting location');
            }
        });
        
        channelRef.current = channel;

        // Start Geolocation
        if ("geolocation" in navigator) {
            watchId.current = navigator.geolocation.watchPosition(
                (position) => {
                    const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
                    setCurrentLocation(coords);

                    // Broadcast to clients listening to this driver
                    channel.send({
                        type: 'broadcast',
                        event: 'location_update',
                        payload: { 
                            lat: coords[0], 
                            lng: coords[1],
                            timestamp: new Date().toISOString()
                        },
                    });

                    // Option: Update DB every minute or so, but broadcast is instant
                },
                (err) => console.error(err),
                { enableHighAccuracy: true, maximumAge: 0 }
            );
        }

        return () => {
            if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, [selectedDriver, isTracking]);

    const markDelivered = async () => {
        if (!assignedOrder || !selectedDriver) return;
        
        const confirm = window.confirm('¿Confirmar entrega exitosa?');
        if (!confirm) return;

        try {
            await supabase.from('orders').update({
                delivery_status: 'delivered',
                status: 'entregado'
            }).eq('id', assignedOrder.id);

            await supabase.from('delivery_drivers').update({
                status: 'disponible'
            }).eq('id', selectedDriver.id);

            setAssignedOrder(null);
            alert('¡Entrega registrada!');
        } catch(e) {
            alert('Error al registrar entrega');
        }
    }

    const transferOrder = async (newDriverId: string) => {
        if (!assignedOrder || !selectedDriver) return;
        
        try {
            // Update order with new driver
            await supabase.from('orders').update({
                driver_id: newDriverId
            }).eq('id', assignedOrder.id);

            // Free current driver
            await supabase.from('delivery_drivers').update({
                status: 'disponible'
            }).eq('id', selectedDriver.id);

            // Occupy new driver
            await supabase.from('delivery_drivers').update({
                status: 'ocupado'
            }).eq('id', newDriverId);

            setAssignedOrder(null);
            setShowTransferModal(false);
            alert('✅ Pedido transferido exitosamente.');
        } catch(e) {
            alert('❌ Error al transferir pedido');
        }
    }

    if (!selectedDriver) {
        return (
            <div className="min-h-screen bg-gray-100 flex flex-col p-6 items-center justify-center">
                <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl">
                    <img src="/logo-main.jpg" className="w-24 mx-auto rounded-full mb-6" alt="Casalena" />
                    <h1 className="text-2xl font-black text-center mb-8 text-gray-800">Acceso Repartidores</h1>
                    <div className="space-y-3">
                        {drivers.length === 0 && <p className="text-center text-sm text-gray-500">No hay repartidores registrados en la BD.</p>}
                        {drivers.map(d => (
                            <button
                                key={d.id}
                                onClick={() => setSelectedDriver(d)}
                                className="w-full bg-gray-50 border-2 border-gray-200 hover:border-orange-500 hover:bg-orange-50 text-left p-4 rounded-2xl flex items-center gap-4 transition-all"
                            >
                                <div className="bg-orange-100 size-12 rounded-full flex items-center justify-center text-orange-600">
                                    <span className="material-icons-round">sports_motorsports</span>
                                </div>
                                <div>
                                    <p className="font-black text-gray-800">{d.full_name}</p>
                                    <p className="text-xs font-bold text-gray-500 uppercase">{d.vehicle_type}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#fcfbf9]">
            {/* Header */}
            <header className="bg-[#181511] text-white p-4 flex items-center justify-between shadow-md z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedDriver(null)} className="size-10 bg-white/10 rounded-full flex items-center justify-center">
                        <span className="material-icons-round">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="font-black line-clamp-1">{selectedDriver.full_name}</h1>
                        <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase">
                            Estado: {isTracking ? '📡 TRANSMITIENDO' : '🔴 OFFLINE'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsTracking(!isTracking)}
                    className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg transition-colors flex items-center gap-2 ${
                        isTracking ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
                    }`}
                >
                    <span className="material-icons-round text-sm">{isTracking ? 'stop' : 'play_arrow'}</span>
                    {isTracking ? 'Detener' : 'Iniciar'}
                </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                
                {!isTracking && (
                    <div className="bg-orange-100 border border-orange-200 p-4 rounded-2xl flex items-start gap-3">
                        <span className="material-icons-round text-orange-500 mt-0.5">location_off</span>
                        <div>
                            <p className="font-black text-orange-900 text-sm">GPS Desactivado</p>
                            <p className="text-xs text-orange-700 mt-1">Presiona "INICIAR" para que los clientes puedan rastrear su pedido y el restaurante vea tu ubicación.</p>
                        </div>
                    </div>
                )}

                {assignedOrder ? (
                    <div className="bg-white border-2 border-[#f7951d] rounded-2xl shadow-xl overflow-hidden flex flex-col">
                        <div className="bg-[#f7951d] text-white p-4">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-black uppercase tracking-widest text-[10px]">Pedido Activo</span>
                                <span className="bg-black/20 px-2 py-0.5 rounded font-black text-[10px]">#{assignedOrder.id.toString().slice(-4)}</span>
                            </div>
                            <h2 className="text-xl font-black">{assignedOrder.customer_name}</h2>
                        </div>
                        
                        <div className="p-4 flex flex-col gap-4">
                            <a href={`https://maps.google.com/?daddr=${encodeURIComponent(assignedOrder.delivery_address)}`} target="_blank" rel="noreferrer" className="flex items-start gap-3 bg-gray-50 p-3 rounded-xl hover:bg-gray-100 transition-colors">
                                <span className="material-icons-round text-blue-500">directions</span>
                                <div>
                                    <p className="font-bold text-xs text-gray-500 uppercase">Dirección de Entrega</p>
                                    <p className="font-black text-sm text-gray-800">{assignedOrder.delivery_address}</p>
                                </div>
                            </a>

                            <a href={`tel:${assignedOrder.phone_number}`} className="flex items-start gap-3 bg-gray-50 p-3 rounded-xl hover:bg-gray-100 transition-colors">
                                <span className="material-icons-round text-green-500">phone</span>
                                <div>
                                    <p className="font-bold text-xs text-gray-500 uppercase">Teléfono</p>
                                    <p className="font-black text-sm text-gray-800">{assignedOrder.phone_number}</p>
                                </div>
                            </a>

                            <div className="bg-gray-50 p-3 rounded-xl">
                                <p className="font-bold text-xs text-gray-500 uppercase mb-2">Detalle ({assignedOrder.order_items.length} items)</p>
                                <ul className="text-xs font-medium space-y-1">
                                    {assignedOrder.order_items.map((item:any, i:number) => (
                                        <li key={i} className="flex justify-between">
                                            <span>{item.quantity}x {item.product_name}</span>
                                            <span>${(item.unit_price * item.quantity).toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-black text-sm">
                                    <span>TOTAL A COBRAR</span>
                                    <span className="text-[#f7951d]">${assignedOrder.total_amount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-2">
                            <button onClick={markDelivered} className="w-full bg-[#181511] text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                                <span className="material-icons-round">check_circle</span>
                                Marcar Entregado
                            </button>
                            <button onClick={() => setShowTransferModal(true)} className="w-full bg-white text-gray-700 hover:bg-gray-100 border-2 border-gray-200 py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-colors flex items-center justify-center gap-2">
                                <span className="material-icons-round text-sm">swap_horiz</span>
                                Transferir a otro repartidor
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-gray-300 rounded-3xl p-6 bg-white">
                        <div className="size-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                            <span className="material-icons-round text-4xl text-gray-300">hourglass_empty</span>
                        </div>
                        <h3 className="font-black text-lg text-gray-800">Esperando Pedidos</h3>
                        <p className="text-sm text-gray-500 mt-1">Cuando la caja te asigne un pedido a domicilio, aparecerá aquí automáticamente.</p>
                    </div>
                )}
            </div>

            {/* Transfer Modal */}
            {showTransferModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="p-4 bg-[#fcfbf9] border-b border-gray-100 flex justify-between items-center shrink-0">
                            <h3 className="font-black text-gray-800 flex items-center gap-2">
                                <span className="material-icons-round text-blue-500">swap_horiz</span>
                                Transferir Pedido
                            </h3>
                            <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-600 size-8 flex items-center justify-center bg-gray-100 rounded-full">
                                <span className="material-icons-round text-sm">close</span>
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1">
                            <p className="text-xs text-gray-500 mb-4 font-bold">Selecciona al repartidor que se encargará ahora de este pedido:</p>
                            <div className="space-y-2">
                                {drivers.filter(d => d.id !== selectedDriver.id && d.is_active !== false).length === 0 ? (
                                    <p className="text-center py-8 text-sm font-bold text-gray-400">No hay otros repartidores disponibles.</p>
                                ) : (
                                    drivers.filter(d => d.id !== selectedDriver.id && d.is_active !== false).map(driver => (
                                        <button 
                                            key={driver.id}
                                            onClick={() => {
                                                if (confirm(`¿Transferir pedido a ${driver.full_name}?`)) {
                                                    transferOrder(driver.id);
                                                }
                                            }}
                                            className={`w-full p-3 rounded-xl border flex items-center gap-3 transition-colors text-left ${driver.status === 'disponible' ? 'border-gray-200 hover:border-blue-500 hover:bg-blue-50' : 'border-gray-100 bg-gray-50 opacity-60'}`}
                                        >
                                            <div className="size-10 bg-white shadow-sm rounded-full flex items-center justify-center shrink-0 text-gray-400">
                                                <span className="material-icons-round">sports_motorsports</span>
                                            </div>
                                            <div>
                                                <p className="font-black text-gray-800 text-sm">{driver.full_name}</p>
                                                <p className="font-bold text-[10px] text-gray-500 uppercase tracking-widest">{driver.status}</p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
