'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import DeliveryMap from '@/components/DeliveryMap';
import { useRouter } from 'next/navigation';

export default function RepartidorApp() {
    const router = useRouter();
    // Hardcoded restaurant origin for Casalena
    const ORIGIN: [number, number] = [16.6853, -98.4116]; 
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
            
            if (session.user.user_metadata?.role?.toLowerCase() === 'repartidor') {
                role = 'repartidor';
            }
            
            if (role !== 'repartidor') {
                alert('No tienes permisos de repartidor. Rol detectado: ' + role);
                router.push('/tienda');
                return;
            }

            let { data: driver } = await supabase.from('delivery_drivers').select('*').eq('id', session.user.id).maybeSingle();
            
            if (!driver) {
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

            if (driver) setSelectedDriver(driver);

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
            const { data, error } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('driver_id', selectedDriver.id)
                .in('delivery_status', ['assigned', 'picked_up', 'en_camino'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (data) setAssignedOrder(data);
            else setAssignedOrder(null);
        };

        checkOrder();
        
        const sub = supabase.channel('driver-updates-' + selectedDriver.id)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'orders',
                filter: `driver_id=eq.${selectedDriver.id}`
            }, () => {
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

        const channel = supabase.channel(`tracking_driver_${selectedDriver.id}`, {
            config: { broadcast: { ack: false } },
        });

        channel.subscribe();
        channelRef.current = channel;

        if ("geolocation" in navigator) {
            watchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
                    setCurrentLocation(coords);

                    channel.send({
                        type: 'broadcast',
                        event: 'location_update',
                        payload: { lat: coords[0], lng: coords[1], timestamp: new Date().toISOString() },
                    });

                    // Throttled DB update for Admin (every 20s)
                    supabase.from('delivery_drivers').update({
                        current_lat: coords[0],
                        current_lng: coords[1],
                        last_location_update: new Date().toISOString()
                    }).eq('id', selectedDriver.id).then();
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

    const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);

    const handleInternalNavigation = async () => {
        if (!assignedOrder?.delivery_address) return;
        setIsGeocoding(true);
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(assignedOrder.delivery_address)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                setDestinationCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
            } else {
                alert('No se pudo encontrar la dirección exacta en el mapa.');
            }
        } catch(e) {
            console.error(e);
        } finally {
            setIsGeocoding(false);
        }
    };

    const markDelivered = async () => {
        if (!assignedOrder || !selectedDriver) return;
        
        if (!confirm('¿Confirmar entrega exitosa?')) return;

        try {
            await supabase.from('orders').update({
                delivery_status: 'delivered',
                status: 'entregado'
            }).eq('id', assignedOrder.id);

            await supabase.from('delivery_drivers').update({ status: 'disponible' }).eq('id', selectedDriver.id);
            setAssignedOrder(null);
            setDestinationCoords(null);
            alert('¡Entrega registrada!');
        } catch(e) {
            alert('Error al registrar entrega');
        }
    }

    const transferOrder = async (newDriverId: string) => {
        if (!assignedOrder || !selectedDriver) return;
        try {
            await supabase.from('orders').update({ driver_id: newDriverId }).eq('id', assignedOrder.id);
            await supabase.from('delivery_drivers').update({ status: 'disponible' }).eq('id', selectedDriver.id);
            await supabase.from('delivery_drivers').update({ status: 'ocupado' }).eq('id', newDriverId);
            setAssignedOrder(null);
            setShowTransferModal(false);
            alert('✅ Pedido transferido.');
        } catch(e) {
            alert('❌ Error al transferir');
        }
    }

    const handleLogout = async () => {
        if (assignedOrder) {
            alert('⚠️ No puedes cerrar sesión con un pedido activo.');
            return;
        }
        await supabase.auth.signOut();
        router.push('/login');
    };

    if (loadingAuth || !selectedDriver) {
        return <div className="h-screen bg-[#181511] flex items-center justify-center text-white">Cargando aplicación...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-[#fcfbf9]">
            {/* Header */}
            <header className="bg-[#181511] text-white p-4 flex items-center justify-between shadow-md z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <button onClick={handleLogout} className="size-10 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center">
                        <span className="material-icons-round text-[18px]">logout</span>
                    </button>
                    <div>
                        <h1 className="font-black truncate max-w-[150px]">{selectedDriver.full_name}</h1>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                            {isTracking ? '📡 TRANSMITIENDO' : '🔴 OFFLINE'}
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsTracking(!isTracking)}
                    className={`px-4 py-2 rounded-full font-black text-[10px] uppercase shadow-lg transition-colors flex items-center gap-2 ${
                        isTracking ? 'bg-red-500' : 'bg-green-500'
                    }`}
                >
                    <span className="material-icons-round text-sm">{isTracking ? 'stop' : 'play_arrow'}</span>
                    {isTracking ? 'Detener' : 'Iniciar'}
                </button>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto w-full p-4 flex flex-col gap-4 max-w-md mx-auto">
                
                {!isTracking && (
                    <div className="bg-red-50 border-2 border-red-100 p-4 rounded-2xl flex items-start gap-3">
                        <span className="material-icons-round text-red-600">location_off</span>
                        <p className="text-xs text-red-800 font-bold">GPS Desactivado. Presiona INICIAR para recibir pedidos.</p>
                    </div>
                )}

                {/* Persistent Live Map */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 h-[350px] relative shrink-0">
                    <div className="absolute top-4 left-4 z-[10]">
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase text-white backdrop-blur-md flex items-center gap-2 ${isTracking ? 'bg-green-500/80' : 'bg-red-500/80'}`}>
                            <div className={`size-1.5 rounded-full ${isTracking ? 'bg-white animate-ping' : 'bg-white'}`} />
                            {isTracking ? 'Mapa Activo' : 'Mapa Desconectado'}
                        </div>
                    </div>
                    <DeliveryMap 
                        origin={ORIGIN}
                        destination={destinationCoords}
                        driverLocation={currentLocation}
                        driverName={selectedDriver.full_name}
                    />
                </div>

                {/* Order Status Section */}
                {assignedOrder ? (
                    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden flex flex-col">
                        <div className="bg-gradient-to-r from-[#181511] to-[#2a251e] text-white p-5">
                            <div className="flex justify-between items-center mb-1">
                                <span className="bg-[#F7941D] text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Activo</span>
                                <span className="text-gray-400 font-bold text-[10px]">ORDEN #{assignedOrder.id}</span>
                            </div>
                            <h2 className="text-xl font-black">{assignedOrder.customer_name}</h2>
                        </div>
                        
                        <div className="p-5 flex flex-col gap-4">
                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Entregar en:</p>
                                <p className="font-black text-gray-800 leading-snug">{assignedOrder.delivery_address}</p>
                                
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button onClick={handleInternalNavigation} disabled={isGeocoding} className="bg-blue-600 text-white font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
                                        <span className="material-icons-round text-lg">navigation</span>
                                        {isGeocoding ? '...' : 'Trazar Ruta'}
                                    </button>
                                    <a href={`https://maps.google.com/?q=${encodeURIComponent(assignedOrder.delivery_address)}`} target="_blank" rel="noreferrer" className="bg-white border-2 border-blue-50 text-blue-600 font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm">
                                        <span className="material-icons-round text-lg">map</span>
                                        G. Maps
                                    </a>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <a href={`tel:${assignedOrder.phone_number}`} className="flex items-center justify-center gap-2 bg-gray-100 p-3 rounded-xl text-gray-600 font-black text-xs">
                                    <span className="material-icons-round text-lg">call</span> Llamar
                                </a>
                                <a href={`https://wa.me/${(assignedOrder.phone_number || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-green-50 p-3 rounded-xl text-green-600 font-black text-xs">
                                    <span className="material-icons-round text-lg">chat</span> WhatsApp
                                </a>
                            </div>

                            <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-black text-orange-800 uppercase">Productos</span>
                                    <span className="text-lg font-black text-orange-950">${assignedOrder.total_amount.toFixed(2)}</span>
                                </div>
                                <ul className="text-xs font-bold text-orange-800/70 space-y-1">
                                    {(assignedOrder.order_items || []).map((it:any, i:number) => (
                                        <li key={i}>{it.quantity}x {it.product_name || it.products?.name}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="pt-2 flex flex-col gap-2">
                                <button onClick={markDelivered} className="w-full bg-[#181511] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <span className="material-icons-round">task_alt</span> Marcar Entregado
                                </button>
                                <button onClick={() => setShowTransferModal(true)} className="w-full text-gray-400 font-bold text-[10px] uppercase py-2">Transferir Pedido</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-[2rem] border-2 border-dashed border-gray-200">
                        <span className="material-icons-round text-4xl text-gray-200 mb-2">hourglass_empty</span>
                        <p className="font-black text-gray-400 uppercase text-xs">Esperando Pedidos</p>
                    </div>
                )}
            </div>

            {showTransferModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4">
                    <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] w-full max-w-sm p-6 animate-in slide-in-from-bottom duration-300">
                         <div className="flex justify-between items-center mb-6">
                             <h3 className="font-black text-xl">Transferir Pedido</h3>
                             <button onClick={() => setShowTransferModal(false)} className="size-8 bg-gray-100 rounded-full flex items-center justify-center"><span className="material-icons-round">close</span></button>
                         </div>
                         <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {drivers.filter(d => d.id !== selectedDriver.id).map(d => (
                                <button key={d.id} onClick={() => transferOrder(d.id)} className="w-full p-4 rounded-2xl border border-gray-100 hover:bg-blue-50 text-left flex items-center justify-between">
                                    <span className="font-black text-sm">{d.full_name}</span>
                                    <span className="text-[10px] font-bold text-blue-500 uppercase">{d.status}</span>
                                </button>
                            ))}
                         </div>
                    </div>
                </div>
            )}
        </div>
    );
}
