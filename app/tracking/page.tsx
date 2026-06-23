'use client';
import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/utils/supabase/client';
import DeliveryMap from '@/components/DeliveryMap';
import { useSearchParams } from 'next/navigation';

function TrackingContent() {
    const searchParams = useSearchParams();
    let orderId = searchParams.get('id');

    const [order, setOrder] = useState<any>(null);
    const [driver, setDriver] = useState<any>(null);
    const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

    // Hardcoded restaurant origin for Casalena
    const ORIGIN: [number, number] = [16.6853, -98.4116]; 
    // Realistic fallback customer location (near the origin) if geocoding is missing
    const [destination, setDestination] = useState<[number, number] | null>(null); 

    useEffect(() => {
        const fetchOrder = async () => {
            // Robust parsing for common typos like ?id-270
            if (!orderId) {
                const rawQuery = typeof window !== 'undefined' ? window.location.search : '';
                const match = rawQuery.match(/[?&]id[-=](\d+)+/);
                if (match) orderId = match[1];
            }

            if (!orderId) {
                console.error('[Tracking] ❌ ID de pedido inválido o no proporcionado. URL:', window.location.href);
                setError('ID de pedido inválido o no proporcionado');
                setLoading(false);
                return;
            }

            console.log(`[Tracking] 🔍 Buscando pedido #${orderId}...`);

            const { data: orderData, error: orderErr } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('id', orderId)
                .single();

            if (orderErr || !orderData) {
                console.error('[Tracking] ❌ Pedido no encontrado:', orderErr);
                setError('Pedido no encontrado');
                setLoading(false);
                return;
            }

            console.log(`[Tracking] ✅ Pedido encontrado:`, {
                id: orderData.id,
                status: orderData.status,
                tipo: orderData.order_type,
                driver_id: orderData.driver_id,
                direccion: orderData.delivery_address
            });

            setOrder(orderData);

            // Attempt to silently geocode customer's address for the map destination
            if (orderData.delivery_address) {
                const addressStr = orderData.delivery_address;
                const cleanAddress = addressStr.split('(')[0].split(',')[0].trim();
                console.log(`[Tracking] 📍 Geocodificando dirección: "${addressStr}"`);

                const fetchGeo = async (q: string) => {
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
                        const data = await res.json();
                        return data && data.length > 0 ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] as [number, number] : null;
                    } catch { return null; }
                };

                const startGeo = async () => {
                    let coords = await fetchGeo(addressStr);
                    if (!coords) coords = await fetchGeo(cleanAddress);
                    if (!coords) {
                        console.warn('[Tracking] ⚠️ No se pudo geocodificar la dirección. Usando fallback de ciudad.');
                        coords = [16.6850, -98.4100];
                    } else {
                        console.log(`[Tracking] 📍 Coordenadas resueltas:`, coords);
                    }
                    setDestination(coords);
                };
                startGeo();
            } else {
                 console.log('[Tracking] ℹ️ Sin dirección de entrega. Pedido de mostrador/comedor.');
                 setDestination([16.6850, -98.4100]);
            }

            if (orderData.driver_id) {
                console.log(`[Tracking] 🛵 Buscando repartidor ID: ${orderData.driver_id}`);
                const { data: driverData } = await supabase
                    .from('delivery_drivers')
                    .select('*')
                    .eq('id', orderData.driver_id)
                    .single();
                
                if (driverData) {
                    console.log(`[Tracking] 👤 Repartidor:`, { nombre: driverData.full_name, vehiculo: driverData.vehicle_type });
                    setDriver(driverData);
                }

                // Fetch initial static location directly from table just in case broadcast is asleep
                if (driverData?.current_lat && driverData?.current_lng) {
                    console.log(`[Tracking] 📡 Ubicación inicial del repartidor: [${driverData.current_lat}, ${driverData.current_lng}]`);
                     setDriverLocation([driverData.current_lat, driverData.current_lng]);
                }

                // Subscribe to Driver Location updates via Channels
                const channel = supabase.channel(`tracking_driver_${orderData.driver_id}`);
                
                channel.on('broadcast', { event: 'location_update' }, (payload) => {
                    const { lat, lng } = payload.payload;
                    console.log(`[Tracking] 📡 Actualización de ubicación → lat:${lat}, lng:${lng}`);
                    setDriverLocation([lat, lng]);
                    
                    // Simple ETA: calculate straight-line distance, assume 30km/h
                    if (destination) {
                        const distDeg = Math.sqrt(Math.pow(lat - destination[0], 2) + Math.pow(lng - destination[1], 2));
                        const distKm = distDeg * 111;
                        const speedKmph = 30;
                        const timeHours = distKm / speedKmph;
                        const eta = Math.max(60, Math.floor(timeHours * 3600));
                        console.log(`[Tracking] ⏱️ ETA calculado: ${Math.ceil(eta/60)} minutos (distancia: ${distKm.toFixed(2)}km)`);
                        setEtaSeconds(eta);
                    }
                }).subscribe();

                return () => {
                    supabase.removeChannel(channel);
                }
            } else {
                console.log('[Tracking] ℹ️ Sin repartidor asignado aún.');
            }

            setLoading(false);
        };

        fetchOrder();

        // Listen for order updates (like driver reassignment or status changes)
        const orderChannel = supabase.channel(`tracking_order_${orderId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'orders',
                filter: `id=eq.${orderId}`
            }, (payload) => {
                const updatedOrder = payload.new;
                
                // If driver changed
                if (updatedOrder.driver_id && updatedOrder.driver_id !== order?.driver_id) {
                    alert('🔔 Notificación: Tu pedido ha sido reasignado a un nuevo repartidor para garantizar tu entrega.');
                    fetchOrder(); // Refetch to get new driver info and subscribe to new driver channel
                } else if (updatedOrder.status === 'entregado' || updatedOrder.delivery_status === 'delivered') {
                    fetchOrder(); // Update to delivered state
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(orderChannel);
        };
    }, [orderId, order?.driver_id]); // added order?.driver_id dependency so it correctly compares on update

    // Format ETA
    const formattedETA = etaSeconds ? 
        (etaSeconds > 3600 
            ? `> 1h` 
            : `${Math.ceil(etaSeconds / 60)} min`) 
        : 'Calculando...';

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-[#fcfbf9] text-[#f7951d] font-black"><span className="material-icons-round text-4xl animate-spin">refresh</span></div>;
    if (error) return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-[#fcfbf9] p-6 text-center">
            <div className="size-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <span className="material-icons-round text-4xl">search_off</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Pedido No Encontrado</h2>
            <p className="text-gray-500 max-w-xs mb-8">
                Lo sentimos, no pudimos encontrar el pedido #{orderId || '??'}. 
                Por favor, verifica que el enlace sea correcto o contacta al restaurante.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button 
                    onClick={() => window.location.href = '/tienda'}
                    className="w-full py-4 bg-[#f7951d] text-white font-black rounded-2xl shadow-lg hover:bg-[#e68a1b] transition-all active:scale-95"
                >
                    IR A LA TIENDA
                </button>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-white border-2 border-gray-100 text-gray-600 font-black rounded-2xl hover:bg-gray-50 transition-all"
                >
                    REINTENTAR
                </button>
            </div>
            <p className="mt-12 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Casaleña POS • Rastreo en Tiempo Real</p>
        </div>
    );

    const isDelivered = order?.delivery_status === 'delivered' || order?.status === 'entregado';

    return (
        <div className="h-screen w-full flex flex-col md:flex-row bg-[#fcfbf9]">
            {/* Sidebar Details */}
            <div className="w-full md:w-96 bg-white shadow-2xl z-10 flex flex-col h-[50vh] md:h-full relative overflow-y-auto">
                <div className="p-6 pb-4 border-b border-gray-100 shrink-0">
                    <img src="/logo-main.jpg" alt="Casaleña" className="w-16 h-16 rounded-full mb-4 shadow-sm border border-gray-100" />
                    <h1 className="text-2xl font-black mb-1">Rastreo de Pedido</h1>
                    <div className="flex items-center gap-2">
                        <span className="bg-black text-[10px] text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">#{order?.id.toString().slice(-4)}</span>
                        <span className="text-xs font-bold text-gray-500">
                            {new Date(order?.created_at).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' })}
                        </span>
                    </div>
                </div>

                <div className="p-6 flex-1">
                    {/* Status Steps */}
                    <div className="space-y-6 relative before:absolute before:inset-0 before:ml-[15px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                         <div className="relative flex items-center justify-between md:justify-center">
                             <div className="hidden md:block w-1/2 pr-4 text-right">
                                 <h3 className="font-bold text-sm">Preparación</h3>
                                 <p className="text-xs text-gray-500">Cocinando tu pedido</p>
                             </div>
                             <div className="size-8 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0 shadow-md ring-4 ring-white z-10">
                                 <span className="material-icons-round text-sm">skillet</span>
                             </div>
                             <div className="md:w-1/2 md:pl-4 ml-4 md:ml-0">
                                 <h3 className="font-bold text-sm md:hidden">Preparación</h3>
                             </div>
                         </div>
                         
                         <div className="relative flex items-center justify-between md:justify-center">
                             <div className="hidden md:block w-1/2 pr-4 text-right">
                                 <h3 className={`font-bold text-sm ${driver ? 'text-gray-900' : 'text-gray-400'}`}>En Camino</h3>
                                 <p className="text-xs text-gray-500">Repartidor asignado</p>
                             </div>
                             <div className={`size-8 rounded-full flex items-center justify-center shrink-0 shadow-md ring-4 ring-white z-10 ${driver ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                 <span className="material-icons-round text-sm">sports_motorsports</span>
                             </div>
                             <div className="md:w-1/2 md:pl-4 ml-4 md:ml-0">
                                 <h3 className={`font-bold text-sm md:hidden ${driver ? 'text-gray-900' : 'text-gray-400'}`}>En Camino</h3>
                             </div>
                         </div>

                         <div className="relative flex items-center justify-between md:justify-center">
                             <div className="hidden md:block w-1/2 pr-4 text-right">
                                 <h3 className={`font-bold text-sm ${isDelivered ? 'text-gray-900' : 'text-gray-400'}`}>Entregado</h3>
                             </div>
                             <div className={`size-8 rounded-full flex items-center justify-center shrink-0 shadow-md ring-4 ring-white z-10 ${isDelivered ? 'bg-[#f7951d] text-white' : 'bg-gray-200 text-gray-400'}`}>
                                 <span className="material-icons-round text-sm">check</span>
                             </div>
                             <div className="md:w-1/2 md:pl-4 ml-4 md:ml-0">
                                 <h3 className={`font-bold text-sm md:hidden ${isDelivered ? 'text-gray-900' : 'text-gray-400'}`}>Entregado</h3>
                             </div>
                         </div>
                    </div>

                    {driver && !isDelivered && (
                        <div className="mt-8 bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-4">
                            <div className="size-12 bg-white rounded-full flex items-center justify-center border-2 border-blue-200 text-blue-500 shrink-0">
                                <span className="material-icons-round">face</span>
                            </div>
                            <div>
                                <p className="font-black text-sm">{driver.full_name}</p>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{driver.vehicle_type || 'Moto'}</p>
                            </div>
                            <div className="ml-auto text-right">
                                <p className="text-xs font-bold text-gray-500 uppercase">Llega en</p>
                                <p className="font-black text-blue-600 text-lg">{formattedETA}</p>
                            </div>
                        </div>
                    )}
                    
                    {isDelivered && (
                        <div className="mt-8 bg-orange-50 border border-orange-100 rounded-2xl p-6 text-center">
                            <span className="material-icons-round text-4xl text-[#f7951d] mb-2">celebration</span>
                            <h3 className="font-black text-lg text-orange-900">¡Pedido Entregado!</h3>
                            <p className="text-sm font-medium text-orange-700 mt-1">Gracias por tu preferencia. ¡Buen provecho!</p>
                        </div>
                    )}

                    <div className="mt-6 border-t border-gray-100 pt-6">
                        <h4 className="font-black text-xs uppercase tracking-widest text-gray-400 mb-3">Detalle del Pedido</h4>
                        <ul className="space-y-2 text-sm">
                            {order?.order_items?.map((it:any) => (
                                <li key={it.id} className="flex justify-between font-medium">
                                    <span>{it.quantity}x {it.product_name}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 h-[50vh] md:h-full relative bg-gray-100">
                {!isDelivered ? (
                    <DeliveryMap 
                        origin={ORIGIN} 
                        destination={destination}
                        driverLocation={driverLocation}
                        driverName={driver?.full_name}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100">
                        <span className="material-icons-round text-6xl text-gray-300 mb-4">map</span>
                        <p className="font-black text-gray-500 text-xl">Rastreo finalizado</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TrackingPage() {
    return (
        <Suspense fallback={
            <div className="h-screen w-full flex items-center justify-center bg-[#fcfbf9] text-[#f7951d] font-black">
                <span className="material-icons-round text-4xl animate-spin">refresh</span>
            </div>
        }>
            <TrackingContent />
        </Suspense>
    );
}
