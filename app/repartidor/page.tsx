'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import DeliveryMap from '@/components/DeliveryMap';
import { useRouter } from 'next/navigation';

export default function RepartidorApp() {
    const router = useRouter();
    const ORIGIN: [number, number] = [16.6853, -98.4116]; 
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<any>(null);
    const [assignedOrder, setAssignedOrder] = useState<any>(null);
    const [isTracking, setIsTracking] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    
    const watchId = useRef<number | null>(null);
    const channelRef = useRef<any>(null);
    const lastPosRef = useRef<[number, number] | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Audio setup for new order notifications
    useEffect(() => {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

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
                const { data: newDriver } = await supabase.from('delivery_drivers').insert({
                    id: session.user.id,
                    full_name: fullName,
                    vehicle_type: 'moto',
                    is_active: true
                }).select().single();
                if (newDriver) driver = newDriver;
            }

            if (driver) setSelectedDriver(driver);
            const { data: allDrivers } = await supabase.from('delivery_drivers').select('*').eq('is_active', true);
            if (allDrivers) setDrivers(allDrivers);
            setLoadingAuth(false);
        };
        initAuth();
    }, [router]);

    // Enhanced order fetching with sound alerts
    useEffect(() => {
        if (!selectedDriver) return;
        
        const checkOrder = async (isUpdate = false) => {
            const { data } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('driver_id', selectedDriver.id)
                .in('delivery_status', ['assigned', 'picked_up', 'en_camino'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                // If it's a real-time update and we didn't have this order before
                if (isUpdate && (!assignedOrder || assignedOrder.id !== data.id)) {
                    audioRef.current?.play().catch(() => console.log('Waiting for interaction'));
                    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
                }
                setAssignedOrder(data);
            } else {
                setAssignedOrder(null);
            }
        };

        checkOrder();
        const sub = supabase.channel('driver-updates-' + selectedDriver.id)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'orders', 
                filter: `driver_id=eq.${selectedDriver.id}` 
            }, () => {
                checkOrder(true);
            })
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [selectedDriver, assignedOrder?.id]);

    // Optimized GPS tracking: moving threshold + temporal throttling
    useEffect(() => {
        if (!selectedDriver || !isTracking) {
            if (watchId.current) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
            if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
            return;
        }

        const channel = supabase.channel(`tracking_driver_${selectedDriver.id}`, { config: { broadcast: { ack: false } } });
        channel.subscribe();
        channelRef.current = channel;

        if ("geolocation" in navigator) {
            watchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const now = Date.now();
                    const coords: [number, number] = [latitude, longitude];

                    // Smooth Broadcast for live maps
                    channel.send({
                        type: 'broadcast',
                        event: 'location_update',
                        payload: { lat: latitude, lng: longitude, timestamp: new Date().toISOString() },
                    });
                    setCurrentLocation(coords);

                    // Efficiency logic for Database updates
                    let shouldUpdateDB = false;
                    if (!lastPosRef.current) {
                        shouldUpdateDB = true;
                    } else {
                        const dist = Math.sqrt(Math.pow(latitude - lastPosRef.current[0], 2) + Math.pow(longitude - lastPosRef.current[1], 2));
                        // ~0.0001 deg is approx 11m
                        if (dist > 0.0001) shouldUpdateDB = true;
                    }

                    const timePassed = now - lastUpdateRef.current;

                    if (shouldUpdateDB && timePassed > 20000) { // Update DB every 20s minimum if moved
                        lastPosRef.current = coords;
                        lastUpdateRef.current = now;
                        supabase.from('delivery_drivers').update({
                            current_lat: latitude,
                            current_lng: longitude,
                            last_location_update: new Date().toISOString()
                        }).eq('id', selectedDriver.id).then();
                    }
                },
                (err) => console.error(err),
                { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
            );
        }
        return () => {
            if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, [selectedDriver, isTracking]);

    const handleInternalNavigation = async () => {
        if (!assignedOrder?.delivery_address) return;
        setIsGeocoding(true);
        try {
            // Clean address: remove common notes like "(casa azul)" or text after commas if it looks like a note
            let cleanAddress = assignedOrder.delivery_address.split('(')[0].split(',')[0].trim();
            
            const fetchGeo = async (query: string) => {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                return data && data.length > 0 ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] as [number, number] : null;
            };

            let coords = await fetchGeo(assignedOrder.delivery_address);
            if (!coords) coords = await fetchGeo(cleanAddress);
            if (!coords) {
                // Fallback to city/region if street fails
                coords = await fetchGeo("Ometepec, Guerrero, Mexico"); 
            }

            if (coords) {
                setDestinationCoords(coords);
            } else {
                alert('No se pudo encontrar la ubicación. Intenta abrir Google Maps manualmente.');
            }
        } catch(e) { console.error(e); }
        finally { setIsGeocoding(false); }
    };

    const markDelivered = async () => {
        if (!assignedOrder || !selectedDriver) return;
        if (!confirm('¿Confirmar entrega exitosa?')) return;
        try {
            await supabase.from('orders').update({ delivery_status: 'delivered', status: 'entregado' }).eq('id', assignedOrder.id);
            await supabase.from('delivery_drivers').update({ status: 'disponible' }).eq('id', selectedDriver.id);
            setAssignedOrder(null);
            setDestinationCoords(null);
            alert('¡Entrega registrada!');
        } catch(e) { alert('Error al registrar entrega'); }
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
        } catch(e) { alert('❌ Error al transferir'); }
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
        return <div className="h-screen bg-[#181511] flex items-center justify-center text-white font-outfit">Cargando aplicación...</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-[#fcfbf9] overflow-hidden font-outfit">
            {/* Header - Native App Style */}
            <header className="bg-[#181511] text-white px-4 py-3 flex items-center justify-between shadow-md z-30 shrink-0">
                <div className="flex items-center gap-2">
                    <button onClick={handleLogout} className="size-9 bg-red-500/10 text-red-400 rounded-xl flex items-center justify-center active:scale-95 transition-all">
                        <span className="material-icons-round text-[20px]">logout</span>
                    </button>
                    <div className="leading-tight">
                        <h1 className="font-black text-sm truncate max-w-[120px]">{selectedDriver.full_name}</h1>
                        <div className="flex items-center gap-1.5">
                            <span className={`size-1.5 rounded-full ${isTracking ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                {isTracking ? 'En línea' : 'Desconectado'}
                            </p>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => setIsTracking(!isTracking)}
                    className={`h-10 px-5 rounded-xl font-black text-[11px] uppercase shadow-lg transition-all active:scale-95 flex items-center gap-2 ${
                        isTracking ? 'bg-red-500' : 'bg-green-500'
                    }`}
                >
                    <span className="material-icons-round text-lg">{isTracking ? 'power_settings_new' : 'sensors'}</span>
                    {isTracking ? 'OFF' : 'ON'}
                </button>
            </header>

            {/* Main Content Area - Responsive Grid */}
            <div className="flex-1 overflow-y-auto w-full flex flex-col lg:flex-row lg:overflow-hidden bg-gray-50/30">
                
                {/* Map Section - Persistently visible */}
                <div className="w-full h-[40vh] lg:h-full lg:w-1/2 relative z-10 shrink-0 shadow-lg border-b lg:border-b-0 lg:border-r border-gray-100 bg-white">
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[20] w-full px-6 pointer-events-none">
                        {!isTracking && (
                            <div className="bg-red-600/90 backdrop-blur-md p-3 rounded-2xl flex items-center justify-center gap-2 shadow-xl border border-red-500/50 animate-in zoom-in-95 duration-300 pointer-events-auto">
                                <span className="material-icons-round text-white text-lg">location_off</span>
                                <p className="text-[10px] text-white font-black uppercase tracking-wider text-center line-clamp-1">GPS APAGADO - TOCA "ON" ARRIBA</p>
                            </div>
                        )}
                        {isTracking && (
                            <div className="bg-green-600/80 backdrop-blur-md py-1.5 px-4 rounded-full flex items-center justify-center gap-2 shadow-lg border border-green-500/50 mx-auto w-fit animate-in slide-in-from-top-4 pointer-events-auto">
                                <div className="size-1.5 bg-white rounded-full animate-ping" />
                                <p className="text-[9px] text-white font-black uppercase tracking-widest">Transmitiendo ubicación</p>
                            </div>
                        )}
                    </div>
                    
                    <DeliveryMap 
                        origin={ORIGIN}
                        destination={destinationCoords}
                        driverLocation={currentLocation}
                        driverName={selectedDriver.full_name}
                    />
                </div>

                {/* Details and Actions Section */}
                <div className="flex-1 overflow-y-auto p-5 pb-24 lg:pb-12 scrollbar-hide">
                    <div className="max-w-2xl mx-auto -mt-10 lg:mt-0 relative z-20">
                        {assignedOrder ? (
                            <div className="bg-white rounded-[2.5rem] lg:rounded-[2rem] shadow-2xl lg:shadow-xl border border-gray-100 overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-500">
                                <div className="bg-[#181511] text-white p-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="bg-[#f7951d] text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest">Pedido Activo</span>
                                        <span className="text-gray-500 font-bold text-[10px] tracking-tighter">ORDEN #{assignedOrder.id.toString().slice(-6)}</span>
                                    </div>
                                    <h2 className="text-2xl font-black truncate">{assignedOrder.customer_name}</h2>
                                    <div className="flex items-center gap-2 mt-2 text-gray-400">
                                        <span className="material-icons-round text-[18px]">location_on</span>
                                        <p className="text-xs font-bold truncate line-clamp-1">{assignedOrder.delivery_address}</p>
                                    </div>
                                </div>
                                
                                <div className="p-6 flex flex-col gap-6">
                                    {/* Large touch-friendly navigation buttons */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <button 
                                            onClick={handleInternalNavigation} 
                                            disabled={isGeocoding} 
                                            className="bg-[#f7951d] text-white font-black text-xs h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all shadow-lg shadow-orange-100"
                                        >
                                            <span className="material-icons-round text-2xl">navigation</span>
                                            {isGeocoding ? 'Cargando...' : 'En App'}
                                        </button>
                                        <a 
                                            href={destinationCoords 
                                                ? `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords[0]},${destinationCoords[1]}&travelmode=driving`
                                                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignedOrder.delivery_address)}&travelmode=driving`
                                            } 
                                            target="_blank" 
                                            rel="noreferrer" 
                                            className="bg-white border-2 border-gray-100 text-[#181511] font-black text-xs h-16 rounded-2xl flex flex-col items-center justify-center gap-0.5 shadow-sm active:scale-95 transition-all"
                                        >
                                            <span className="material-icons-round text-2xl text-red-500">directions_car</span>
                                            Navegar
                                        </a>
                                    </div>

                                    {/* Quick Contact Buttons */}
                                    <div className="flex gap-3">
                                        <a href={`tel:${assignedOrder.phone_number}`} className="flex-1 flex items-center justify-center h-14 gap-2 bg-blue-50 text-blue-600 rounded-2xl font-black text-xs active:scale-95 transition-all">
                                            <span className="material-icons-round text-xl">call</span> Llamar
                                        </a>
                                        <a href={`https://wa.me/${(assignedOrder.phone_number || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex-1 flex items-center justify-center h-14 gap-2 bg-green-50 text-green-600 rounded-2xl font-black text-xs active:scale-95 transition-all">
                                            <span className="material-icons-round text-xl">chat</span> WhatsApp
                                        </a>
                                    </div>

                                    {/* Order Summary box */}
                                    <div className="bg-[#fcfbf9] p-5 rounded-3xl border border-[#eceae7]">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Resumen de Orden</span>
                                            <span className="text-xl font-black text-[#181511]">${(assignedOrder.total_amount || 0).toFixed(2)}</span>
                                        </div>
                                        <ul className="space-y-3">
                                            {(assignedOrder.order_items || []).map((it:any, i:number) => (
                                                <li key={i} className="flex items-center gap-3">
                                                    <span className="size-6 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0">{it.quantity}</span>
                                                    <span className="text-xs font-bold text-[#181511] truncate">{it.product_name || it.products?.name}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Primary Delivery Action */}
                                    <div className="space-y-4 pt-2">
                                        <button 
                                            onClick={markDelivered} 
                                            className="w-full bg-[#181511] text-white h-20 rounded-3xl font-black uppercase tracking-widest shadow-2xl shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                                        >
                                            <div className="size-8 bg-white/20 rounded-full flex items-center justify-center">
                                                <span className="material-icons-round text-lg">check_circle</span>
                                            </div>
                                            Registrar Entrega
                                        </button>
                                        <button 
                                            onClick={() => setShowTransferModal(true)} 
                                            className="w-full py-2 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:text-red-500 transition-colors"
                                        >
                                            ¿Algún problema? Transferir pedido
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-[2.5rem] shadow-xl border-2 border-dashed border-gray-100 p-12 lg:p-20 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500 mt-10 lg:mt-0">
                                 <div className="size-24 lg:size-32 bg-gray-50 rounded-full flex items-center justify-center mb-4 relative">
                                    <span className="material-icons-round text-5xl lg:text-7xl text-gray-200 animate-pulse">moped</span>
                                    <div className="absolute top-0 right-0 size-6 lg:size-8 bg-[#f7951d] rounded-full border-4 border-white animate-bounce" />
                                 </div>
                                 <h3 className="font-black text-[#181511] text-lg lg:text-xl uppercase tracking-tight">Esperando Pedido</h3>
                                 <p className="text-[11px] lg:text-xs font-bold text-gray-400 mt-1 max-w-[200px] lg:max-w-xs">Mantente cerca del restaurante para recibir nuevas órdenes.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Transfer Modal - Bottom Sheet Style */}
            {showTransferModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end justify-center animate-in fade-in duration-200" onClick={() => setShowTransferModal(false)}>
                    <div className="bg-white rounded-t-[3rem] w-full max-w-lg pb-12 pt-6 px-6 animate-in slide-in-from-bottom duration-500" onClick={e => e.stopPropagation()}>
                         <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
                         <div className="flex justify-between items-center mb-8">
                             <div>
                                 <h3 className="font-black text-2xl text-[#181511]">Transferir Pedido</h3>
                                 <p className="text-xs font-bold text-gray-500">Elige un compañero disponible</p>
                             </div>
                             <button onClick={() => setShowTransferModal(false)} className="size-12 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center active:scale-90 transition-all font-black text-gray-400">
                                 <span className="material-icons-round">close</span>
                             </button>
                         </div>
                         <div className="grid grid-cols-1 gap-3 max-h-[50vh] overflow-y-auto px-1 custom-scrollbar pb-6">
                            {drivers.filter(d => d.id !== selectedDriver.id && d.is_active).map(d => (
                                <button 
                                    key={d.id} 
                                    onClick={() => transferOrder(d.id)} 
                                    className="w-full p-6 rounded-3xl border border-gray-100 bg-gray-50 active:bg-orange-50 active:border-orange-200 text-left flex items-center justify-between transition-all shadow-sm"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 bg-white rounded-2xl border border-gray-100 flex items-center justify-center shadow-inner">
                                            <span className="material-icons-round text-[#181511] text-3xl">account_circle</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-black text-base text-[#181511]">{d.full_name}</span>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{d.vehicle_type || 'Moto'}</span>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest border ${
                                        d.status === 'disponible' ? 'bg-green-500 text-white border-green-600' : 'bg-orange-500 text-white border-orange-600'
                                    }`}>
                                        {d.status}
                                    </span>
                                </button>
                            ))}
                            {drivers.length <= 1 && (
                                <div className="text-center py-12 flex flex-col items-center gap-3">
                                    <span className="material-icons-round text-4xl text-gray-100">group_off</span>
                                    <p className="text-xs font-bold text-gray-400">No hay otros repartidores activos ahora.</p>
                                </div>
                            )}
                         </div>
                    </div>
                </div>
            )}
            
            <style jsx global>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
