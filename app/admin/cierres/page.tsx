'use client';

import { useEffect, useState, useRef } from 'react';

interface CashClosure {
    id: string;
    fecha_turno: string;
    cajero: string;
    total_ordenes: number;
    total_productos: number;
    total_ventas: number;
    ventas_efectivo: number;
    ventas_tarjeta: number;
    ventas_otro: number;
    ticket_promedio: number;
    fondo_inicial: number;
    efectivo_esperado: number;
    efectivo_contado: number;
    diferencia: number;
    top_productos: any;
    created_at: string;
}

export default function CierresRerportsPage() {
    const [cierres, setCierres] = useState<CashClosure[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCierre, setSelectedCierre] = useState<CashClosure | null>(null);
    const [secretUnlocked, setSecretUnlocked] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const keyBufferRef = useRef('');

    useEffect(() => {
        fetchCierres();
    }, []);

    const fetchCierres = async () => {
        try {
            const res = await fetch('/api/admin/closures');
            if (res.ok) {
                const data = await res.json();
                setCierres(data || []);
            }
        } catch (error) {
            console.error("Error fetching closures", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignorar si el foco está en un input/textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
            keyBufferRef.current = (keyBufferRef.current + e.key).slice(-4).toLowerCase();
            if (keyBufferRef.current === 'luis') {
                setSecretUnlocked(prev => !prev);
                keyBufferRef.current = '';
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm('¿Eliminar este cierre permanentemente? Esta acción no se puede deshacer.')) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/admin/closures?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Error al eliminar');
            setCierres(prev => prev.filter(c => c.id !== id));
            setSelectedCierre(null);
            setSecretUnlocked(false);
        } catch (err: any) {
            alert('No se pudo eliminar: ' + err.message);
        } finally {
            setDeleting(false);
        }
    };

    const handlePrint = (data: CashClosure) => {
        const lines = [
            `CIERRE DE CAJA — CASALEÑA`,
            `Fecha: ${data.fecha_turno}`,
            `Cajero: ${data.cajero}`,
            `${'─'.repeat(32)}`,
            `ÓRDENES: ${data.total_ordenes}`,
            `PRODUCTOS VENDIDOS: ${data.total_productos}`,
            `TICKET PROMEDIO: $${data.ticket_promedio.toFixed(2)}`,
            `${'─'.repeat(32)}`,
            `VENTAS POR FORMA DE PAGO`,
            `Efectivo:   $${data.ventas_efectivo.toFixed(2)}`,
            `Tarjeta:    $${data.ventas_tarjeta.toFixed(2)}`,
            `Otro:       $${data.ventas_otro.toFixed(2)}`,
            `TOTAL:      $${data.total_ventas.toFixed(2)}`,
            `${'─'.repeat(32)}`,
            `CUADRE DE CAJA`,
            `Fondo inicial:     $${data.fondo_inicial.toFixed(2)}`,
            `Efectivo esperado: $${data.efectivo_esperado.toFixed(2)}`,
            `Efectivo contado:  $${data.efectivo_contado.toFixed(2)}`,
            `DIFERENCIA:        $${data.diferencia.toFixed(2)}`,
            `${'─'.repeat(32)}`,
            `Reporte impreso desde Admin`
        ].join('\n');

        const win = window.open('', '_blank', 'width=400,height=700');
        if (win) {
            win.document.write(`<pre style="font-family:monospace;font-size:12px;padding:20px;">${lines}</pre>`);
            win.document.close();
            win.print();
        }
    };

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8f7f5]">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#e6e1db] pb-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-[#181511] tracking-tight">Cierres de Caja</h1>
                        <p className="text-[#8c785f] mt-1 font-bold">Historial y cuadres registrados por tus cajeros.</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <span className="material-symbols-outlined animate-spin text-4xl text-[#F27405]">
                            progress_activity
                        </span>
                    </div>
                ) : cierres.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border shadow-sm">
                        <span className="material-symbols-outlined text-6xl text-[#8c785f] mb-4">
                            lock_clock
                        </span>
                        <h3 className="text-xl font-bold text-[#181511] mb-2">Aún no hay reportes</h3>
                        <p className="text-[#8c785f] font-medium">Los reportes aparecerán aquí cuando los cajeros terminen turno.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {cierres.map((c) => (
                            <div 
                                key={c.id} 
                                className="bg-white rounded-3xl overflow-hidden border border-[#e6e1db] shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                                onClick={() => setSelectedCierre(c)}
                            >
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <p className="text-[10px] font-black uppercase text-[#F27405] tracking-widest">{new Date(c.created_at).toLocaleTimeString()}</p>
                                            <h3 className="text-lg font-black text-[#181511] capitalize line-clamp-1">{c.fecha_turno}</h3>
                                        </div>
                                        <div className="size-10 bg-orange-50 rounded-full flex items-center justify-center text-[#F27405]">
                                            <span className="material-symbols-outlined text-xl">receipt_long</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-bold text-[#8c785f]">Cajero:</span>
                                            <span className="font-black text-[#181511]">{c.cajero}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-bold text-[#8c785f]">Ventas del día:</span>
                                            <span className="font-black text-[#181511]">${c.total_ventas.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="font-bold text-[#8c785f]">Efectivo total:</span>
                                            <span className="font-black text-green-600">${c.efectivo_contado.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    <div className={`p-4 rounded-2xl flex items-center justify-between ${c.diferencia === 0 ? 'bg-green-50' : c.diferencia > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-[#8c785f]">Cuadre</span>
                                            <span className={`font-black text-lg ${c.diferencia === 0 ? 'text-green-600' : c.diferencia > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                                {c.diferencia === 0 ? 'Exacto' : c.diferencia > 0 ? `Sobrante +$${c.diferencia.toFixed(2)}` : `Faltante -$${Math.abs(c.diferencia).toFixed(2)}`}
                                            </span>
                                        </div>
                                        <span className={`material-symbols-outlined ${c.diferencia === 0 ? 'text-green-500' : c.diferencia > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                            {c.diferencia === 0 ? 'check_circle' : 'warning'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal Detail View */}
            {selectedCierre && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
                        
                        {/* Header */}
                        <div className="flex items-center justify-between px-7 py-5 border-b border-[#f0ede9] bg-[#181511]">
                            <div className="cursor-default select-none">
                                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Detalles del Cierre</p>
                                <h2 className="text-xl font-black text-white capitalize">{selectedCierre.fecha_turno}</h2>
                            </div>
                            <div className="flex gap-2">
                                {secretUnlocked && (
                                    <button
                                        onClick={() => handleDelete(selectedCierre.id)}
                                        disabled={deleting}
                                        className="size-9 rounded-xl bg-red-600 flex items-center justify-center text-white hover:bg-red-700 transition-colors animate-in zoom-in-90 duration-200"
                                        title="Eliminar cierre"
                                    >
                                        <span className="material-symbols-outlined text-lg">{deleting ? 'progress_activity' : 'delete_forever'}</span>
                                    </button>
                                )}
                                <button onClick={() => handlePrint(selectedCierre)} className="size-9 rounded-xl bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 transition-colors">
                                    <span className="material-symbols-outlined text-lg">print</span>
                                </button>
                                <button onClick={() => { setSelectedCierre(null); setSecretUnlocked(false); }} className="size-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cajero Responsable</p>
                                    <p className="font-black text-lg text-[#181511]">{selectedCierre.cajero}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Órdenes Generadas</p>
                                    <p className="font-black text-lg text-[#181511]">{selectedCierre.total_ordenes}</p>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Ventas por Forma de Pago</h3>
                                <div className="bg-white border rounded-2xl overflow-hidden text-sm">
                                    <div className="flex justify-between p-4 border-b border-gray-100">
                                        <span className="font-bold text-[#8c785f]">Efectivo</span>
                                        <span className="font-black">${selectedCierre.ventas_efectivo.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between p-4 border-b border-gray-100">
                                        <span className="font-bold text-[#8c785f]">Tarjeta</span>
                                        <span className="font-black">${selectedCierre.ventas_tarjeta.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between p-4 border-b border-gray-100">
                                        <span className="font-bold text-[#8c785f]">Otro</span>
                                        <span className="font-black">${selectedCierre.ventas_otro.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between p-4 bg-orange-50">
                                        <span className="font-black tracking-widest uppercase">Total Ventas</span>
                                        <span className="font-black text-[#F27405] text-lg">${selectedCierre.total_ventas.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Revisión de Caja Fuerte</h3>
                                <div className="bg-[#181511] text-white rounded-2xl overflow-hidden p-5 space-y-3 shadow-lg">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-gray-400 text-sm">Fondo Inicial Reportado</span>
                                        <span className="font-black">${selectedCierre.fondo_inicial.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-gray-400">Total Esperado (Fondo + Efectivo)</span>
                                        <span className="font-black text-blue-300">${selectedCierre.efectivo_esperado.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-gray-400 text-sm">Efectivo Físico Contado</span>
                                        <span className="font-black text-xl text-green-400">${selectedCierre.efectivo_contado.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t border-white/20 pt-3 flex justify-between items-end">
                                        <span className="font-black uppercase tracking-widest text-xs">Cuadre Final</span>
                                        <div className="text-right">
                                            <span className={`font-black tracking-tighter text-2xl ${selectedCierre.diferencia === 0 ? 'text-green-500' : selectedCierre.diferencia > 0 ? 'text-blue-500' : 'text-red-500'}`}>
                                                {selectedCierre.diferencia === 0 ? 'EXACTO' : selectedCierre.diferencia > 0 ? `+ $${selectedCierre.diferencia.toFixed(2)}` : `- $${Math.abs(selectedCierre.diferencia).toFixed(2)}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
