'use client';
import { useEffect, useState, Suspense } from 'react';
import { supabase } from '@/utils/supabase/client';
import DeliveryMap from '@/components/DeliveryMap';
import { useSearchParams } from 'next/navigation';

function TrackingContent() {
    const searchParams = useSearchParams();
    const orderId = searchParams.get('id');

    const [order, setOrder] = useState<any>(null);
    const [driver, setDriver] = useState<any>(null);
    const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [etaSeconds, setEtaSeconds] = useState<number | null>(null);

    // Hardcoded restaurant origin for Casalena
    const ORIGIN: [number, number] = [16.6853, -98.4116]; 
    // Realistic fallback customer location (near the origin) if geocoding is missing
    const [destination, setDestination] = useState<[number, number]>([16.6800, -98.4100]); 

    useEffect(() => {
        const fetchOrder = async () => {
            if (!orderId) return;

            const { data: orderData, error: orderErr } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('id', orderId)
                .single();

            if (orderErr || !orderData) {
                setError('Pedido no encontrado');
                setLoading(false);
                return;
            }

            setOrder(orderData);

            if (orderData.driver_id) {
                const { data: driverData } = await supabase
                    .from('delivery_drivers')
                    .select('*')
                    .eq('id', orderData.driver_id)
                    .single();
                
                if (driverData) setDriver(driverData);

                // Subscribe to Driver Location updates via Channels
                const channel = supabase.channel(`tracking_driver_${orderData.driver_id}`);
                
                channel.on('broadcast', { event: 'location_update' }, (payload) => {
                    const { lat, lng } = payload.payload;
                    setDriverLocation([lat, lng]);
                    
                    // Simple ETA: calculate straight-line distance, assume 30km/h
                    // 1 deg is roughly 111km.
                    const distDeg = Math.sqrt(Math.pow(lat - destination[0], 2) + Math.pow(lng - destination[1], 2));
                    const distKm = distDeg * 111;
                    const speedKmph = 30; // 30 km/h avg in city
                    const timeHours = distKm / speedKmph;
                    setEtaSeconds(Math.max(60, Math.floor(timeHours * 3600))); // Min 1 minute
                }).subscribe();

                return () => {
                    supabase.removeChannel(channel);
                }
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
    if (error) return <div className="h-screen w-full flex items-center justify-center font-black text-red-500">{error}</div>;

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
