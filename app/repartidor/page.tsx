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
    const [showOrderItems, setShowOrderItems] = useState(false);

    const watchId = useRef<number | null>(null);
    const channelRef = useRef<any>(null);
    const lastPosRef = useRef<[number, number] | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { router.push('/login'); return; }
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            let role = profile?.role?.toLowerCase() || 'cliente';
            if (session.user.user_metadata?.role?.toLowerCase() === 'repartidor') role = 'repartidor';
            if (role !== 'repartidor') { alert('No tienes permisos de repartidor.'); router.push('/redirect'); return; }
            let { data: driver } = await supabase.from('delivery_drivers').select('*').eq('id', session.user.id).maybeSingle();
            if (!driver) {
                const fullName = profile?.full_name || session.user.email?.split('@')[0] || 'Repartidor';
                const { data: newDriver } = await supabase.from('delivery_drivers').insert({ id: session.user.id, full_name: fullName, vehicle_type: 'moto', is_active: true }).select().single();
                if (newDriver) driver = newDriver;
            }
            if (driver) setSelectedDriver(driver);
            const { data: allDrivers } = await supabase.from('delivery_drivers').select('*').eq('is_active', true);
            if (allDrivers) setDrivers(allDrivers);
            setLoadingAuth(false);
        };
        initAuth();
    }, [router]);

    useEffect(() => {
        if (!selectedDriver) return;
        const checkOrder = async (isUpdate = false) => {
            const { data } = await supabase.from('orders').select('*, order_items(*)').eq('driver_id', selectedDriver.id).in('delivery_status', ['assigned', 'picked_up', 'en_camino']).order('created_at', { ascending: false }).limit(1).maybeSingle();
            if (data) {
                if (isUpdate && (!assignedOrder || assignedOrder.id !== data.id)) {
                    // audioRef.current?.play().catch(() => {}); // Desactivado por solicitud del usuario
                    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                }
                setAssignedOrder(data);
            } else {
                setAssignedOrder(null);
            }
        };
        checkOrder();
        const sub = supabase.channel('driver-updates-' + selectedDriver.id)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `driver_id=eq.${selectedDriver.id}` }, () => checkOrder(true))
            .subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [selectedDriver, assignedOrder?.id]);

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
                    channel.send({ type: 'broadcast', event: 'location_update', payload: { lat: latitude, lng: longitude, timestamp: new Date().toISOString() } });
                    setCurrentLocation(coords);
                    let shouldUpdateDB = !lastPosRef.current;
                    if (lastPosRef.current) {
                        const dist = Math.sqrt(Math.pow(latitude - lastPosRef.current[0], 2) + Math.pow(longitude - lastPosRef.current[1], 2));
                        if (dist > 0.0001) shouldUpdateDB = true;
                    }
                    if (shouldUpdateDB && (now - lastUpdateRef.current) > 20000) {
                        lastPosRef.current = coords;
                        lastUpdateRef.current = now;
                        supabase.from('delivery_drivers').update({ current_lat: latitude, current_lng: longitude, last_location_update: new Date().toISOString() }).eq('id', selectedDriver.id).then();
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
            let cleanAddress = assignedOrder.delivery_address.split('(')[0].split(',')[0].trim();
            const fetchGeo = async (query: string) => {
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`);
                const data = await response.json();
                return data?.length > 0 ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] as [number, number] : null;
            };
            let coords = await fetchGeo(assignedOrder.delivery_address);
            if (!coords) coords = await fetchGeo(cleanAddress);
            if (!coords) coords = await fetchGeo('Ometepec, Guerrero, Mexico');
            if (coords) setDestinationCoords(coords);
            else alert('No se pudo encontrar la ubicación.');
        } catch (e) { console.error(e); }
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
        } catch { alert('Error al registrar entrega'); }
    };

    const transferOrder = async (newDriverId: string) => {
        if (!assignedOrder || !selectedDriver) return;
        try {
            await supabase.from('orders').update({ driver_id: newDriverId }).eq('id', assignedOrder.id);
            await supabase.from('delivery_drivers').update({ status: 'disponible' }).eq('id', selectedDriver.id);
            await supabase.from('delivery_drivers').update({ status: 'ocupado' }).eq('id', newDriverId);
            setAssignedOrder(null);
            setShowTransferModal(false);
        } catch { alert('Error al transferir'); }
    };

    const handleLogout = async () => {
        if (assignedOrder) { alert('No puedes cerrar sesión con un pedido activo.'); return; }
        await supabase.auth.signOut();
        router.push('/login');
    };

    const googleMapsUrl = assignedOrder
        ? destinationCoords
            ? `https://www.google.com/maps/dir/?api=1&destination=${destinationCoords[0]},${destinationCoords[1]}&travelmode=driving`
            : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(assignedOrder.delivery_address)}&travelmode=driving`
        : '#';

    if (loadingAuth || !selectedDriver) {
        return (
            <div className="h-screen bg-[#0D0D0F] flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-full border-4 border-[#F7951D] border-t-transparent animate-spin" />
                <p className="text-white/50 font-bold text-sm uppercase tracking-widest">Cargando...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0D0D0F] overflow-hidden" style={{ fontFamily: "'Outfit', sans-serif" }}>

            {/* ── HEADER ── */}
            <header className="shrink-0 z-30 px-4 pt-4 pb-3 flex items-center justify-between bg-[#0D0D0F]/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleLogout}
                        className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-red-400 active:scale-90 transition-all"
                    >
                        <span className="material-icons-round text-[18px]">logout</span>
                    </button>
                    <div>
                        <p className="text-white font-black text-sm truncate max-w-[140px] uppercase tracking-tight">{selectedDriver.full_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isTracking ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isTracking ? '#34d399' : '#f87171' }}>
                                {isTracking ? 'En línea' : 'Desconectado'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Toggle GPS */}
                <button
                    onClick={() => setIsTracking(t => !t)}
                    className={`relative flex items-center gap-2 px-4 h-11 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 ${isTracking ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-white/5 border border-white/10 text-white/40'}`}
                >
                    <span className={`w-2 h-2 rounded-full ${isTracking ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                    {isTracking ? 'GPS ON' : 'GPS OFF'}
                </button>
            </header>

            {/* ── MAP ── */}
            <div className="relative shrink-0" style={{ height: '42vh' }}>
                <DeliveryMap
                    origin={ORIGIN}
                    destination={destinationCoords}
                    driverLocation={currentLocation}
                    driverName={selectedDriver.full_name}
                />

                {/* GPS overlay badge */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
                    {!isTracking && (
                        <div className="bg-red-500/90 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 shadow-xl">
                            <span className="material-icons-round text-white text-[16px]">location_off</span>
                            <p className="text-[10px] text-white font-black uppercase tracking-wider">GPS apagado</p>
                        </div>
                    )}
                    {isTracking && (
                        <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/40 px-4 py-1.5 rounded-full flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                            <p className="text-[10px] text-emerald-300 font-black uppercase tracking-widest">Transmitiendo ubicación</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── BOTTOM SHEET ── */}
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {assignedOrder ? (
                    <div className="px-4 pt-4 pb-24 space-y-3">

                        {/* Order Badge */}
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ background: 'rgba(247,149,29,0.15)', color: '#F7951D', border: '1px solid rgba(247,149,29,0.3)' }}>
                                🔥 Pedido Activo
                            </span>
                            <span className="text-[10px] text-white/30 font-bold">#{assignedOrder.id?.toString().slice(-6).toUpperCase()}</span>
                        </div>

                        {/* Customer Card */}
                        <div className="rounded-3xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,0.04)' }}>
                            <div className="p-5">
                                <h2 className="text-2xl font-black text-white uppercase tracking-tight truncate">{assignedOrder.customer_name}</h2>
                                <div className="flex items-start gap-2 mt-2">
                                    <span className="material-icons-round text-[16px] mt-0.5 shrink-0" style={{ color: '#F7951D' }}>location_on</span>
                                    <p className="text-sm text-white/60 font-bold leading-snug">{assignedOrder.delivery_address}</p>
                                </div>
                                <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4">
                                    <span className="text-xs text-white/40 font-bold uppercase tracking-wider">Total a cobrar</span>
                                    <span className="text-2xl font-black text-white">${(assignedOrder.total_amount || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleInternalNavigation}
                                disabled={isGeocoding}
                                className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 font-black text-[11px] uppercase tracking-wider active:scale-95 transition-all disabled:opacity-50"
                                style={{ background: 'rgba(247,149,29,0.15)', border: '1px solid rgba(247,149,29,0.35)', color: '#F7951D' }}
                            >
                                <span className="material-icons-round text-2xl">{isGeocoding ? 'hourglass_empty' : 'navigation'}</span>
                                {isGeocoding ? 'Cargando...' : 'Ver en Mapa'}
                            </button>
                            <a
                                href={googleMapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="h-16 rounded-2xl flex flex-col items-center justify-center gap-1 font-black text-[11px] uppercase tracking-wider active:scale-95 transition-all"
                                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                            >
                                <span className="material-icons-round text-2xl text-red-400">directions_car</span>
                                Google Maps
                            </a>
                        </div>

                        {/* Contact Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <a
                                href={`tel:${assignedOrder.phone_number}`}
                                className="h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-sm active:scale-95 transition-all"
                                style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}
                            >
                                <span className="material-icons-round text-xl">call</span>
                                Llamar
                            </a>
                            <a
                                href={`https://wa.me/${(assignedOrder.phone_number || '').replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="h-14 rounded-2xl flex items-center justify-center gap-2 font-black text-sm active:scale-95 transition-all"
                                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#4ade80' }}
                            >
                                <span className="material-icons-round text-xl">chat</span>
                                WhatsApp
                            </a>
                        </div>

                        {/* Order Items Collapsible */}
                        <div className="rounded-2xl overflow-hidden border border-white/8" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <button
                                onClick={() => setShowOrderItems(v => !v)}
                                className="w-full flex items-center justify-between px-5 py-4"
                            >
                                <span className="text-[11px] font-black text-white/40 uppercase tracking-widest">Productos ({(assignedOrder.order_items || []).length})</span>
                                <span className="material-icons-round text-white/30 text-lg">{showOrderItems ? 'expand_less' : 'expand_more'}</span>
                            </button>
                            {showOrderItems && (
                                <div className="px-5 pb-4 space-y-3 border-t border-white/6">
                                    {(assignedOrder.order_items || []).map((it: any, i: number) => (
                                        <div key={i} className="flex items-center gap-3">
                                            <span className="w-7 h-7 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ background: 'rgba(247,149,29,0.2)', color: '#F7951D' }}>
                                                {it.quantity}
                                            </span>
                                            <span className="text-sm font-bold text-white/70 truncate">{it.product_name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Deliver Button */}
                        <button
                            onClick={markDelivered}
                            className="w-full h-20 rounded-3xl font-black text-base uppercase tracking-widest text-white active:scale-95 transition-all shadow-2xl flex items-center justify-center gap-3"
                            style={{ background: 'linear-gradient(135deg, #F7951D 0%, #e07d0a 100%)', boxShadow: '0 8px 32px rgba(247,149,29,0.4)' }}
                        >
                            <span className="material-icons-round text-2xl">check_circle</span>
                            Registrar Entrega
                        </button>

                        <button
                            onClick={() => setShowTransferModal(true)}
                            className="w-full py-3 text-white/25 font-black text-[11px] uppercase tracking-widest hover:text-red-400 transition-colors text-center"
                        >
                            ¿Problema? Transferir pedido →
                        </button>
                    </div>
                ) : (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center h-full px-6 py-16 text-center">
                        <div className="relative mb-6">
                            <div className="w-28 h-28 rounded-full flex items-center justify-center" style={{ background: 'rgba(247,149,29,0.08)', border: '1px solid rgba(247,149,29,0.15)' }}>
                                <span className="material-icons-round text-6xl" style={{ color: 'rgba(247,149,29,0.4)' }}>moped</span>
                            </div>
                            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#F7951D] border-4 border-[#0D0D0F] animate-bounce" />
                        </div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight">Sin pedidos</h3>
                        <p className="text-sm text-white/30 font-bold mt-2 max-w-xs leading-relaxed">
                            Mantente cerca del restaurante. Te avisaremos cuando haya un domicilio.
                        </p>
                        {!isTracking && (
                            <button
                                onClick={() => setIsTracking(true)}
                                className="mt-8 px-8 h-12 rounded-2xl font-black text-[11px] uppercase tracking-widest text-white active:scale-95 transition-all"
                                style={{ background: 'linear-gradient(135deg, #F7951D, #e07d0a)' }}
                            >
                                Activar GPS
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── TRANSFER MODAL ── */}
            {showTransferModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-end justify-center"
                    style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
                    onClick={() => setShowTransferModal(false)}
                >
                    <div
                        className="w-full max-w-lg rounded-t-[2.5rem] pt-4 pb-12 px-5"
                        style={{ background: '#161618', border: '1px solid rgba(255,255,255,0.08)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-6" />
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-black text-white">Transferir Pedido</h3>
                                <p className="text-xs text-white/40 font-bold mt-0.5">Elige un compañero disponible</p>
                            </div>
                            <button
                                onClick={() => setShowTransferModal(false)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-90 transition-all"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                <span className="material-icons-round text-white/50">close</span>
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[45vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                            {drivers.filter(d => d.id !== selectedDriver.id && d.is_active).map(d => (
                                <button
                                    key={d.id}
                                    onClick={() => transferOrder(d.id)}
                                    className="w-full p-4 rounded-2xl flex items-center justify-between active:scale-95 transition-all"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(247,149,29,0.12)' }}>
                                            <span className="material-icons-round text-2xl" style={{ color: '#F7951D' }}>account_circle</span>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-white text-sm">{d.full_name}</p>
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{d.vehicle_type || 'Moto'}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full tracking-widest ${d.status === 'disponible' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'}`}>
                                        {d.status}
                                    </span>
                                </button>
                            ))}
                            {drivers.filter(d => d.id !== selectedDriver.id).length === 0 && (
                                <div className="text-center py-10">
                                    <span className="material-icons-round text-4xl text-white/10">group_off</span>
                                    <p className="text-xs font-bold text-white/30 mt-2">No hay otros repartidores activos.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
