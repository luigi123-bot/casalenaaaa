'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabase/client';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), { ssr: false });

const ORIGIN: [number, number] = [16.6853, -98.4116]; 

function LiveTrackerModal({ order, onClose }: { order: any, onClose: () => void }) {
    const [driverLocation, setDriverLocation] = useState<[number, number] | null>(null);
    const [destination, setDestination] = useState<[number, number] | null>(null);
    const [driver, setDriver] = useState<any>(null);

    useEffect(() => {
        if (!order || !order.driver_id) return;

        const fetchOrderData = async () => {
            const { data: driverData } = await supabase.from('delivery_drivers').select('*').eq('id', order.driver_id).single();
            if (driverData) {
                setDriver(driverData);
                if (driverData.current_lat && driverData.current_lng) {
                    setDriverLocation([driverData.current_lat, driverData.current_lng]);
                }
            }

            if (order.delivery_address) {
                fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&state=Guerrero&country=Mexico&q=${encodeURIComponent(order.delivery_address)}`)
                    .then(res => res.json())
                    .then((results) => {
                        if (results && results.length > 0) {
                            setDestination([parseFloat(results[0].lat), parseFloat(results[0].lon)]);
                        }
                    }).catch(e => console.error(e));
            }
        };

        fetchOrderData();

        const channel = supabase.channel(`admin_tracking_${order.driver_id}`);
        channel.on('broadcast', { event: 'location_update' }, (payload) => {
            setDriverLocation([payload.payload.lat, payload.payload.lng]);
        }).subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [order]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[70vh] lg:h-[80vh]">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-black text-lg">Rastreo Pedido #{order.id.toString().slice(-5)}</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase">{driver?.full_name || 'Repartidor'}</p>
                    </div>
                    <button onClick={onClose} className="size-10 flex items-center justify-center rounded-xl hover:bg-gray-50 text-gray-400">
                        <span className="material-icons-round">close</span>
                    </button>
                </div>
                <div className="flex-1 relative bg-gray-100 z-0">
                    <DeliveryMap 
                        origin={ORIGIN}
                        destination={destination}
                        driverLocation={driverLocation}
                        driverName={driver?.full_name}
                    />
                </div>
            </div>
        </div>
    );
}

export default function DeliveriesPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [drivers, setDrivers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
    const [schemaError, setSchemaError] = useState(false);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchData = async () => {
        try {
            // Fetch drivers
            const { data: driversData, error: driversError } = await supabase
                .from('delivery_drivers')
                .select('*')
                .eq('is_active', true);

            if (driversError) {
                if (driversError.code === '42P01') {
                    setSchemaError(true);
                } else {
                    console.error('Drivers fetch error', driversError);
                }
            } else {
                setDrivers(driversData || []);
            }

            // Fetch delivery orders (status not delivered/cancelled)
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('order_type', 'delivery')
                .not('status', 'in', '("entregado","cancelado")')
                .order('created_at', { ascending: false });

            if (ordersError) {
                console.error('Orders fetch error', ordersError);
            } else {
                setOrders(ordersData || []);
            }
            setLoading(false);
        } catch (err) {
            console.error('Data fetch error', err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 10000);
        return () => clearInterval(interval);
    }, []);

    const assignDriver = async (orderId: string, driverId: string) => {
        if (saving) return;
        setSaving(true);

        const driverName = drivers.find(d => d.id === driverId)?.full_name || driverId;
        console.log(`🚀 [AssignDriver] INICIANDO ASIGNACIÓN...`);
        console.log(`📦 Orden: ${orderId} | Repartidor: ${driverName} (${driverId})`);

        try {
            console.log(`⏳ [AssignDriver] Guardando en BD: orders.driver_id = ${driverId}, delivery_status = 'assigned'`);

            const { data, error } = await supabase
                .from('orders')
                .update({ 
                    driver_id: driverId, 
                    delivery_status: 'assigned',
                    status: 'en_camino'
                })
                .eq('id', orderId)
                .select();

            if (error) {
                console.error('❌ [AssignDriver] ERROR EN orders UPDATE:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                });
                showToast(`❌ Error al guardar: ${error.message} (${error.code})`, 'error');
                return;
            }

            console.log('✅ [AssignDriver] orders actualizada correctamente. Respuesta BD:', data);
            
            // Update driver status
            console.log(`⏳ [AssignDriver] Actualizando estado de repartidor a 'ocupado'...`);
            const { error: driverErr } = await supabase
                .from('delivery_drivers')
                .update({ status: 'ocupado' })
                .eq('id', driverId);

            if (driverErr) {
                console.error('⚠️ [AssignDriver] Error actualizando estado del repartidor:', driverErr);
            } else {
                console.log(`✅ [AssignDriver] Estado de repartidor actualizado a 'ocupado'`);
            }

            setSelectedOrder(null);
            await fetchData();
            console.log(`✨ [AssignDriver] COMPLETADO: Pedido ${orderId} asignado a ${driverName}`);
            showToast(`✅ Pedido asignado a ${driverName} y guardado en la BD`, 'success');

        } catch (err: any) {
            console.error('🔥 [AssignDriver] ERROR CRÍTICO:', err);
            showToast('❌ Error crítico: ' + (err.message || 'Error desconocido'), 'error');
        } finally {
            setSaving(false);
        }
    };

    if (schemaError) {
        return (
            <div className="p-8">
                <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-200">
                    <h2 className="text-xl font-black mb-2 flex items-center gap-2">
                        <span className="material-icons-round">warning</span>
                        Base de datos no configurada
                    </h2>
                    <p className="mb-4">Para usar el módulo de repartidores necesitas ejecutar el siguiente SQL en Supabase:</p>
                    <pre className="bg-black/10 p-4 rounded-xl text-xs font-mono overflow-auto overflow-x-hidden whitespace-pre-wrap select-all">
{`CREATE TABLE IF NOT EXISTS public.delivery_drivers (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    full_name TEXT NOT NULL,
    vehicle_type TEXT DEFAULT 'moto',
    status TEXT DEFAULT 'disponible',
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    last_location_update TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
`}
                    </pre>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-[#fcfbf9] p-4 lg:p-8 space-y-6 overflow-y-auto relative">

            {/* Toast Notification */}
            {toast && (
                <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl font-black text-sm transition-all animate-in slide-in-from-top-4 ${
                    toast.type === 'success' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-red-500 text-white'
                }`}>
                    <span className="material-icons-round text-[20px]">
                        {toast.type === 'success' ? 'check_circle' : 'error'}
                    </span>
                    {toast.msg}
                </div>
            )}

            {/* Saving overlay indicator */}
            {saving && (
                <div className="fixed top-4 right-4 z-50 bg-[#181511] text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-xl">
                    <span className="material-icons-round text-sm animate-spin">refresh</span>
                    Guardando...
                </div>
            )}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-black text-[#1D1D1F] tracking-tight">Envíos y Repartos</h1>
                    <p className="text-[#8c785f] text-sm font-bold ml-1">Centro de asignación en tiempo real</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/admin/deliveries/driver-setup" className="bg-[#f8f7f5] text-[#181511] px-4 py-2 rounded-xl font-black text-xs hover:bg-[#ebe9e4] transition-colors border border-gray-200 flex items-center gap-2 shadow-sm">
                        <span className="material-icons-round text-sm">person_add</span>
                        Crear Repartidor
                    </Link>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Orders List */}
                <div className="lg:col-span-2 flex flex-col gap-4">
                    <h2 className="font-black text-lg text-gray-800 flex items-center gap-2">
                        <span className="material-icons-round text-orange-500">list_alt</span>
                        Pedidos a Domicilio {loading && <span className="text-xs font-normal text-gray-400">...</span>}
                    </h2>
                    
                    {orders.length === 0 && !loading && (
                        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center flex flex-col items-center justify-center opacity-70">
                            <span className="material-icons-round text-6xl text-gray-300 mb-2">moped</span>
                            <p className="font-black text-gray-500">No hay pedidos a domicilio activos</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        {orders.map(order => (
                            <div key={order.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-black text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest">
                                                #{order.id.toString().slice(-5)}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-widest ${
                                                order.delivery_status === 'assigned' || order.status === 'en_camino' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                {order.delivery_status === 'assigned' || order.status === 'en_camino' ? 'ASIGNADO' : 'PENDIENTE'}
                                            </span>
                                        </div>
                                        <h3 className="font-black text-lg mt-1">{order.customer_name || 'Cliente'}</h3>
                                        <p className="text-sm font-bold text-gray-500 flex items-center gap-1 mt-0.5">
                                            <span className="material-icons-round text-sm">location_on</span>
                                            {order.delivery_address || 'Sin dirección'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-black text-xl text-[#f7951d]">${(order.total_amount || 0).toFixed(2)}</div>
                                        <div className="text-xs font-bold text-gray-400">{new Date(order.created_at).toLocaleTimeString()}</div>
                                    </div>
                                </div>
                                
                                <div className="bg-gray-50 rounded-xl p-3 text-xs mb-3">
                                    <p className="font-bold text-gray-500 mb-1 uppercase tracking-widest text-[9px]">Artículos:</p>
                                    <p className="font-medium text-gray-800 line-clamp-1">
                                        {(order.order_items || []).map((i:any) => `${i.quantity}x ${i.product_name}`).join(', ')}
                                    </p>
                                </div>

                                <div className="flex gap-2 justify-end">
                                    {order.driver_id ? (
                                        <>
                                            <div className="flex-1 flex items-center gap-2 bg-blue-50 text-blue-900 border border-blue-100 px-3 py-2 rounded-xl text-sm font-black">
                                                <span className="material-icons-round text-blue-500">sports_motorsports</span>
                                                {drivers.find(d => d.id === order.driver_id)?.full_name || 'Repartidor'}
                                            </div>
                                            <button
                                                onClick={() => setSelectedOrder(order.id === selectedOrder?.id ? null : order)}
                                                className="bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm font-black transition-colors flex items-center gap-1"
                                            >
                                                <span className="material-icons-round text-[18px]">swap_horiz</span>
                                                Cambiar
                                            </button>
                                            <button 
                                                onClick={() => setTrackingOrder(order)}
                                                className="bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-black transition-colors flex items-center gap-1"
                                            >
                                                <span className="material-icons-round text-[18px]">my_location</span>
                                                Track
                                            </button>
                                        </>
                                    ) : (
                                        <button 
                                            onClick={() => setSelectedOrder(order.id === selectedOrder?.id ? null : order)}
                                            className="bg-[#181511] text-white hover:bg-black px-4 py-2 rounded-xl text-sm font-black transition-all flex items-center gap-2 shadow-lg"
                                        >
                                            <span className="material-icons-round text-[18px]">add_task</span>
                                            Asignar Repartidor
                                        </button>
                                    )}
                                </div>
                                
                                {/* Assignment Expanded Area */}
                                {selectedOrder?.id === order.id && (
                                    <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2 flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                        {drivers.filter(d => d.is_active !== false).map(driver => (
                                            <button 
                                                key={driver.id}
                                                onClick={() => assignDriver(order.id, driver.id)}
                                                className={`flex-shrink-0 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all min-w-[120px] ${
                                                    driver.status === 'disponible' ? 'border-[#f7951d] hover:bg-orange-50 bg-white' : 'border-gray-200 opacity-60 bg-gray-50'
                                                }`}
                                            >
                                                <div className="size-10 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <span className="material-icons-round text-gray-500">sports_motorsports</span>
                                                </div>
                                                <div className="text-center">
                                                    <p className="font-black text-xs leading-none">{driver.full_name}</p>
                                                    <p className="font-bold text-[9px] uppercase tracking-widest text-gray-500 mt-1">{driver.status}</p>
                                                </div>
                                            </button>
                                        ))}
                                        {drivers.length === 0 && (
                                            <div className="text-sm font-bold text-gray-500 py-2">No hay repartidores creados.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tracking / Drivers Panel */}
                <div className="flex flex-col gap-4">
                    <h2 className="font-black text-lg text-gray-800 flex items-center gap-2">
                        <span className="material-icons-round text-green-500">sports_motorsports</span>
                        Flotilla Activa
                    </h2>
                    
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                        {drivers.length === 0 && (
                            <div className="p-6 text-center text-sm font-bold text-gray-400">Sin repartidores.</div>
                        )}
                        {drivers.map(driver => (
                            <div key={driver.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className="size-10 bg-gray-100 rounded-full flex items-center justify-center">
                                            <span className="material-icons-round text-gray-600">person</span>
                                        </div>
                                        <div className={`absolute -bottom-1 -right-1 size-4 rounded-full border-2 border-white ${
                                            driver.status === 'disponible' ? 'bg-green-500' : 'bg-orange-500'
                                        }`}></div>
                                    </div>
                                    <div>
                                        <p className="font-black text-sm">{driver.full_name}</p>
                                        <p className="font-bold text-[10px] text-gray-500 uppercase flex items-center gap-1">
                                            <span className="material-icons-round text-[12px]">two_wheeler</span>
                                            {driver.vehicle_type || 'Moto'}
                                        </p>
                                    </div>
                                </div>
                                <Link 
                                    href={`/admin/deliveries/driver/${driver.id}`}
                                    className="p-2 text-gray-400 hover:text-[#f7951d] hover:bg-orange-50 rounded-lg transition-colors"
                                >
                                    <span className="material-icons-round">chevron_right</span>
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
                
            </div>

            {/* Tracking Modal */}
            {trackingOrder && (
                <LiveTrackerModal 
                    order={trackingOrder} 
                    onClose={() => setTrackingOrder(null)} 
                />
            )}
        </div>
    );
}
