'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import DeliveryMap from '@/components/DeliveryMap';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';

// New Components
import DriverLayout from '@/components/repartidor/DriverLayout';
import DriverBottomSheet from '@/components/repartidor/DriverBottomSheet';
import IncomingOrder from '@/components/repartidor/IncomingOrder';

export default function RepartidorApp() {
    const router = useRouter();
    const ORIGIN: [number, number] = [16.6853, -98.4116];
    
    // Auth & Driver State
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [selectedDriver, setSelectedDriver] = useState<any>(null);
    
    // Order State
    const [assignedOrder, setAssignedOrder] = useState<any>(null);
    const [isOrderAccepted, setIsOrderAccepted] = useState(false);
    
    // Tracking State
    const [isTracking, setIsTracking] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
    
    // UI State
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);

    const watchId = useRef<number | null>(null);
    const channelRef = useRef<any>(null);
    const lastPosRef = useRef<[number, number] | null>(null);
    const lastUpdateRef = useRef<number>(0);

    // Initial Auth & Data Fetching
    useEffect(() => {
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            let role = profile?.role?.toLowerCase() || 'cliente';
            if (session.user.user_metadata?.role?.toLowerCase() === 'repartidor') role = 'repartidor';
            
            if (role !== 'repartidor') { 
                alert('No tienes permisos de repartidor.'); 
                router.push('/tienda'); 
                return; 
            }
            
            let { data: driver } = await supabase.from('delivery_drivers').select('*').eq('id', session.user.id).maybeSingle();
            if (!driver) {
                const fullName = profile?.full_name || session.user.email?.split('@')[0] || 'Repartidor';
                const { data: newDriver } = await supabase.from('delivery_drivers').insert({ 
                    id: session.user.id, 
                    full_name: fullName, 
                    vehicle_type: 'moto', 
                    is_active: true 
                }).select().single();
                if (newDriver) driver = newDriver;
            }
            
            if (driver) {
                setSelectedDriver(driver);
                setIsTracking(driver.is_active || false);
            }
            
            const { data: allDrivers } = await supabase.from('delivery_drivers').select('*').eq('is_active', true);
            if (allDrivers) setDrivers(allDrivers);
            setLoadingAuth(false);
        };
        initAuth();
    }, [router]);

    // Real-time Order Monitoring
    useEffect(() => {
        if (!selectedDriver) return;
        
        const checkOrder = async (isUpdate = false) => {
            const { data } = await supabase.from('orders')
                .select('*, order_items(*)')
                .eq('driver_id', selectedDriver.id)
                .in('delivery_status', ['assigned', 'picked_up', 'en_camino'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
                
            if (data) {
                if (isUpdate && (!assignedOrder || assignedOrder.id !== data.id)) {
                    // Reset acceptance state for new orders
                    setIsOrderAccepted(false);
                    if ('vibrate' in navigator) navigator.vibrate([300, 100, 300]);
                } else if (!isUpdate) {
                    // If it's the initial load and there's an order, assume it's already accepted
                    setIsOrderAccepted(true);
                }
                setAssignedOrder(data);
                
                // If it has destination coords already (from a previous session)
                if (data.delivery_address) {
                    handleGeocoding(data.delivery_address);
                }
            } else {
                setAssignedOrder(null);
                setIsOrderAccepted(false);
                setDestinationCoords(null);
            }
        };

        checkOrder();
        
        const sub = supabase.channel('driver-updates-' + selectedDriver.id)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'orders', 
                filter: `driver_id=eq.${selectedDriver.id}` 
            }, () => checkOrder(true))
            .subscribe();
            
        return () => { supabase.removeChannel(sub); };
    }, [selectedDriver, assignedOrder?.id]);

    // Tracking Logic
    useEffect(() => {
        if (!selectedDriver || !isTracking) {
            if (watchId.current) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
            if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
            return;
        }

        const channel = supabase.channel(`tracking_driver_${selectedDriver.id}`, { config: { broadcast: { ack: false } } });
        channel.subscribe();
        channelRef.current = channel;

        if ('geolocation' in navigator) {
            watchId.current = navigator.geolocation.watchPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    const now = Date.now();
                    const coords: [number, number] = [latitude, longitude];
                    
                    channel.send({ 
                        type: 'broadcast', 
                        event: 'location_update', 
                        payload: { lat: latitude, lng: longitude, timestamp: new Date().toISOString() } 
                    });
                    
                    setCurrentLocation(coords);
                    
                    let shouldUpdateDB = !lastPosRef.current;
                    if (lastPosRef.current) {
                        const dist = Math.sqrt(Math.pow(latitude - lastPosRef.current[0], 2) + Math.pow(longitude - lastPosRef.current[1], 2));
                        if (dist > 0.0001) shouldUpdateDB = true;
                    }
                    
                    if (shouldUpdateDB && (now - lastUpdateRef.current) > 20000) {
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

    const handleGeocoding = async (address: string) => {
        if (!address) return;
        try {
            let cleanAddress = address.split('(')[0].split(',')[0].trim();
            const fetchGeo = async (query: string) => {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                return data?.length > 0 ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] as [number, number] : null;
            };
            let coords = await fetchGeo(address);
            if (!coords) coords = await fetchGeo(cleanAddress);
            if (coords) setDestinationCoords(coords);
        } catch (e) { console.error(e); }
    };

    const markDelivered = async () => {
        if (!assignedOrder || !selectedDriver) return;
        if (!confirm('¿Confirmar entrega exitosa?')) return;
        try {
            await supabase.from('orders').update({ delivery_status: 'delivered', status: 'entregado' }).eq('id', assignedOrder.id);
            await supabase.from('delivery_drivers').update({ status: 'disponible' }).eq('id', selectedDriver.id);
            setAssignedOrder(null);
            setIsOrderAccepted(false);
            setDestinationCoords(null);
        } catch { alert('Error al registrar entrega'); }
    };

    const handleLogout = async () => {
        if (assignedOrder) { alert('No puedes cerrar sesión con un pedido activo.'); return; }
        await supabase.auth.signOut();
        router.push('/login');
    };

    const toggleOnline = async () => {
        const nextState = !isTracking;
        setIsTracking(nextState);
        if (selectedDriver) {
            await supabase.from('delivery_drivers').update({ is_active: nextState }).eq('id', selectedDriver.id);
        }
    };

    const openNavigation = () => {
        if (!assignedOrder) return;
        const url = destinationCoords
            ? `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords[0]},${destinationCoords[1]}&travelmode=driving`
            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignedOrder.delivery_address)}&travelmode=driving`;
        window.open(url, '_blank');
    };

    // Prevent elastic scroll for native feel
    useEffect(() => {
        document.body.classList.add('driver-app');
        return () => document.body.classList.remove('driver-app');
    }, []);

    if (loadingAuth || !selectedDriver) {
        return (
            <div className="h-screen bg-[#0B0B0C] flex flex-col items-center justify-center gap-6">
                <div className="w-16 h-16 rounded-full border-4 border-[#F7951D] border-t-transparent animate-spin" />
                <div className="text-center">
                    <p className="text-white font-black text-xl uppercase tracking-widest">Casalena</p>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-1">Cargando sistema...</p>
                </div>
            </div>
        );
    }

    return (
        <DriverLayout
            driverName={selectedDriver.full_name}
            isOnline={isTracking}
            onToggleOnline={toggleOnline}
            onLogout={handleLogout}
            statusText={isTracking ? 'En Línea' : 'Desconectado'}
        >
            {/* Map Background */}
            <div className="absolute inset-0 z-0">
                <DeliveryMap
                    origin={ORIGIN}
                    destination={destinationCoords}
                    driverLocation={currentLocation}
                    driverName={selectedDriver.full_name}
                />
            </div>

            {/* UI Layers */}
            <AnimatePresence mode="wait">
                {/* Incoming Order Alert */}
                {assignedOrder && !isOrderAccepted && (
                    <IncomingOrder 
                        key="incoming-order"
                        order={assignedOrder}
                        onAccept={() => setIsOrderAccepted(true)}
                        onReject={() => setAssignedOrder(null)} 
                    />
                )}

                {/* Main Interaction Panel */}
                <DriverBottomSheet 
                    key="driver-bottom-sheet"
                    order={isOrderAccepted ? assignedOrder : null}
                    isOnline={isTracking}
                    onMarkDelivered={markDelivered}
                    onOpenNavigation={openNavigation}
                    onCallCustomer={() => window.open(`tel:${assignedOrder?.phone_number}`)}
                    onWhatsAppCustomer={() => window.open(`https://wa.me/${(assignedOrder?.phone_number || '').replace(/\D/g, '')}`)}
                    onShowTransfer={() => setShowTransferModal(true)}
                />
            </AnimatePresence>

            {/* Transfer Modal (Legacy but styled) */}
            {showTransferModal && (
                <div
                    className="fixed inset-0 z-[110] flex items-end justify-center bg-black/80 backdrop-blur-md"
                    onClick={() => setShowTransferModal(false)}
                >
                    <div
                        className="w-full max-w-lg bg-[#161618] rounded-t-[3rem] p-8 pb-12 border-t border-white/10"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
                        <h3 className="text-2xl font-black text-white uppercase mb-2">Transferir Pedido</h3>
                        <p className="text-white/40 font-bold mb-8">Elige un compañero disponible para este viaje.</p>
                        
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                            {drivers.filter(d => d.id !== selectedDriver.id && d.is_active).map(d => (
                                <button
                                    key={d.id}
                                    onClick={async () => {
                                        await supabase.from('orders').update({ driver_id: d.id }).eq('id', assignedOrder.id);
                                        setAssignedOrder(null);
                                        setShowTransferModal(false);
                                    }}
                                    className="w-full p-5 rounded-3xl bg-white/5 border border-white/5 flex items-center justify-between active:scale-95 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-[#F7951D]/10 flex items-center justify-center text-[#F7951D]">
                                            <span className="font-black text-xl">{d.full_name[0]}</span>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-white uppercase">{d.full_name}</p>
                                            <p className="text-[10px] text-white/30 font-black uppercase tracking-widest">{d.vehicle_type || 'Moto'}</p>
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </DriverLayout>
    );
}
