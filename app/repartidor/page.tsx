'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import DeliveryMap from '@/components/DeliveryMap';
import { useRouter } from 'next/navigation';

export default function RepartidorApp() {
    const router = useRouter();
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<any>(null);
    const [assignedOrder, setAssignedOrder] = useState<any>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    
    const watchId = useRef<number | null>(null);
    const channelRef = useRef<any>(null);

    // Initial load: authenticate driver and get peers
    useEffect(() => {
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            // Verify role matching login fallback logic
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            let role = profile?.role?.toLowerCase() || 'cliente';
            
            // Override because profiles table might incorrectly save it as 'cliente' due to DB enum limitation
            if (session.user.user_metadata?.role?.toLowerCase() === 'repartidor') {
                role = 'repartidor';
            }
            
            if (role !== 'repartidor') {
                alert('No tienes permisos de repartidor. Rol detectado: ' + role);
                router.push('/tienda');
                return;
            }

            // Check if driver record exists
            let { data: driver } = await supabase.from('delivery_drivers').select('*').eq('id', session.user.id).maybeSingle();
            
            if (!driver) {
                // Auto-create driver record using their auth ID
                const fullName = profile?.full_name || session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Nuevo Repartidor';
                const { data: newDriver, error } = await supabase.from('delivery_drivers').insert({
                    id: session.user.id,
                    full_name: fullName,
                    vehicle_type: 'moto',
                    is_active: true
                }).select().single();
                
                if (error) console.error('Error creating driver record:', error);
                if (newDriver) driver = newDriver;
            }

            if (driver) {
                setSelectedDriver(driver);
            }

            // Fetch other active drivers for transfer feature
            const { data: allDrivers } = await supabase.from('delivery_drivers').select('*').eq('is_active', true);
            if (allDrivers) setDrivers(allDrivers);

            setLoadingAuth(false);
        };
        
        initAuth();
    }, [router]);

    // Load active order for the selected driver
    useEffect(() => {
        if (!selectedDriver) return;

        const checkOrder = async () => {
            console.log(`[Repartidor] Verificando orden activa para driver_id:`, selectedDriver.id);
            const { data, error } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('driver_id', selectedDriver.id)
                .in('delivery_status', ['assigned', 'picked_up', 'en_camino'])
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

    if (loadingAuth || !selectedDriver) {
        return (
            <div className="min-h-screen bg-[#181511] flex flex-col items-center justify-center relative overflow-hidden">
                <style dangerouslySetInnerHTML={{__html: `
                    @keyframes pulse-slow { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.2; } }
                    @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
                    .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
                    .animate-float { animation: float 4s ease-in-out infinite; }
                `}} />
                {/* Background effects */}
                <div className="absolute inset-0 bg-gradient-to-tr from-[#181511] via-[#2a251e] to-[#181511]"></div>
                <div className="absolute inset-0 bg-[#F7941D] blur-[120px] rounded-full scale-150 animate-pulse-slow object-center" style={{ width: '100%', height: '100%' }}></div>
                
                <div className="z-10 flex flex-col items-center p-8 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl">
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-[#F7941D] blur-xl opacity-30 rounded-full animate-pulse-slow"></div>
                        <img src="/logo-main.jpg" className="relative w-28 h-28 rounded-3xl shadow-2xl animate-float ring-4 ring-white/10" alt="Casalena" />
                    </div>
                    <h1 className="text-2xl font-black text-white text-center mb-1">App de Reparto</h1>
                    <p className="text-xs tracking-widest uppercase text-[#F7941D] font-bold mb-8">Casalena POS</p>
                    
                    <div className="flex items-center gap-3 bg-black/30 px-6 py-3 rounded-full border border-white/5">
                        <div className="w-5 h-5 border-2 border-[#F7941D] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm font-bold text-gray-300">Validando credenciales...</span>
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
            <div className="flex-1 overflow-y-auto w-full bg-[#fcfbf9]">
                <div className="max-w-md mx-auto w-full p-4 flex flex-col gap-4">
                    
                    {!isTracking && (
                        <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl flex items-start gap-3 shadow-sm">
                            <span className="material-icons-round text-red-600 mt-0.5">location_off</span>
                            <div>
                                <p className="font-black text-red-900 text-sm">GPS Desactivado</p>
                                <p className="text-xs text-red-800 mt-1 font-medium leading-relaxed">Presiona "INICIAR" para que el restaurante vea tu ubicación y te pueda despachar pedidos.</p>
                            </div>
                        </div>
                    )}

                    {assignedOrder ? (
                        <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden flex flex-col border border-gray-100 relative">
                            {/* Card Header */}
                            <div className="bg-gradient-to-r from-[#181511] to-[#2a251e] text-white p-5">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2 bg-[#F7941D]/20 text-[#F7941D] px-2.5 py-1 rounded-full border border-[#F7941D]/30">
                                        <div className="w-1.5 h-1.5 bg-[#F7941D] rounded-full animate-ping"></div>
                                        <span className="font-black uppercase tracking-widest text-[9px]">Pedido Activo</span>
                                    </div>
                                    <span className="text-gray-400 font-bold text-[10px] tracking-widest uppercase">
                                        Orden #{assignedOrder.id.toString().slice(-4)}
                                    </span>
                                </div>
                                <h2 className="text-2xl font-black text-white">{assignedOrder.customer_name}</h2>
                            </div>
                            
                            {/* Card Body */}
                            <div className="p-5 flex flex-col gap-5">
                                {/* Navigation UI */}
                                <div className="bg-[#f8f9fa] rounded-2xl p-1 border border-gray-200 relative">
                                    <div className="flex gap-4 p-3 relative bg-white rounded-xl shadow-[0_2px_10px_rgb(0,0,0,0.02)] mb-1 border border-gray-100">
                                        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                                            <span className="material-icons-round text-blue-600 text-[18px]">location_on</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-[9px] text-gray-400 uppercase tracking-widest mb-1">Entregar en</p>
                                            <p className="font-black text-sm text-gray-900 leading-snug">{assignedOrder.delivery_address}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 mt-2 px-1 pb-1">
                                        <a 
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignedOrder.delivery_address)}&travelmode=driving`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-md transition-transform active:scale-95"
                                        >
                                            <span className="material-icons-round text-lg">navigation</span>
                                            Navegar
                                        </a>
                                        <a 
                                            href={`https://maps.google.com/?q=${encodeURIComponent(assignedOrder.delivery_address)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-white text-blue-600 border-2 border-blue-100 hover:border-blue-200 font-black text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95"
                                        >
                                            <span className="material-icons-round text-lg">map</span>
                                            Ver Mapa
                                        </a>
                                    </div>
                                </div>

                                {/* Contact Actions */}
                                <div className="grid grid-cols-2 gap-3">
                                    <a href={`tel:${assignedOrder.phone_number}`} className="flex items-center gap-3 bg-white p-3 rounded-xl border-2 border-gray-100 hover:border-gray-200 active:bg-gray-50 transition-all">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600">
                                            <span className="material-icons-round text-[18px]">call</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-[9px] text-gray-400 uppercase tracking-widest">Llamar</p>
                                            <p className="font-black text-xs text-gray-800 line-clamp-1">{assignedOrder.phone_number || 'Sin teléfono'}</p>
                                        </div>
                                    </a>
                                    <a 
                                        href={`https://wa.me/${(assignedOrder.phone_number || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${assignedOrder.customer_name}, soy el repartidor de Casalena. Voy en camino con tu pedido.`)}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex items-center gap-3 bg-white p-3 rounded-xl border-2 border-green-100 hover:border-green-200 active:bg-green-50 transition-all"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                                            <span className="material-icons-round text-[18px]">chat</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-[9px] text-green-700 uppercase tracking-widest">WhatsApp</p>
                                            <p className="font-black text-xs text-green-900 line-clamp-1">Enviar Msg</p>
                                        </div>
                                    </a>
                                </div>

                                {/* Order Details */}
                                <div className="bg-[#f8f9fa] p-4 rounded-2xl border border-gray-100">
                                    <p className="font-bold text-[9px] text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                                        <span className="material-icons-round text-[14px]">receipt_long</span>
                                        Detalle del pedido
                                    </p>
                                    <ul className="text-[13px] font-bold space-y-2.5 mb-4">
                                        {(assignedOrder.order_items ?? []).map((item:any, i:number) => (
                                            <li key={i} className="flex justify-between items-start gap-4">
                                                <span className="flex gap-2">
                                                    <span className="text-[#F7941D] bg-orange-50 px-1.5 py-0.5 rounded text-[11px] h-fit">{item.quantity}x</span>
                                                    <span className="text-gray-800">{item.product_name}</span>
                                                </span>
                                                <span className="text-gray-900 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100 shrink-0">
                                                    ${(item.unit_price * item.quantity).toFixed(2)}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="border-t-2 border-dashed border-gray-200 pt-3 flex justify-between items-end">
                                        <span className="font-black text-[10px] uppercase text-gray-500 tracking-widest leading-none">A Cobrar</span>
                                        <span className="font-black text-2xl text-[#181511] leading-none">${assignedOrder.total_amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-2 relative z-10">
                                <button onClick={markDelivered} className="w-full bg-[#181511] hover:bg-black text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-[0_8px_20px_rgba(24,21,17,0.2)] hover:shadow-[0_8px_25px_rgba(24,21,17,0.3)] transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <span className="material-icons-round">task_alt</span>
                                    Marcar Entregado
                                </button>
                                <button onClick={() => setShowTransferModal(true)} className="w-full bg-white text-gray-600 hover:text-gray-900 border-2 border-gray-200 hover:border-gray-300 py-3 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <span className="material-icons-round text-[14px]">swap_horiz</span>
                                    Transferir orden
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-gray-300 rounded-3xl p-6 bg-white shadow-sm">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                                <span className="material-icons-round text-3xl text-gray-300">hourglass_empty</span>
                            </div>
                            <h3 className="font-black text-lg text-gray-800">Esperando Pedidos</h3>
                            <p className="text-sm text-gray-500 mt-1 max-w-[220px]">Cuando la caja te asigne un pedido, aparecerá aquí automáticamente.</p>
                        </div>
                    )}
                </div>
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
