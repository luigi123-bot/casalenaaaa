'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';

interface CierreData {
    fechaTurno: string;
    totalOrdenes: number;
    totalVentas: number;
    ventasEfectivo: number;
    ventasTarjeta: number;
    ventasOtro: number;
    totalProductos: number;
    topProductos: { name: string; qty: number }[];
    ordenesPorTipo: { tipo: string; count: number; total: number }[];
    ticketPromedio: number;
}

interface CierreCajaModalProps {
    cashierName: string;
    onClose: () => void;
    onCloseSuccess?: () => void;
    mustClose?: boolean;
}

export default function CierreCajaModal({ cashierName, onClose, onCloseSuccess, mustClose = false }: CierreCajaModalProps) {
    const [data, setData] = useState<CierreData | null>(null);
    const [loading, setLoading] = useState(true);
    const [fondoInicial, setFondoInicial] = useState('');
    const [efectivoContado, setEfectivoContado] = useState('');
    const [step, setStep] = useState<'summary' | 'count' | 'confirm' | 'done'>('summary');
    const [saving, setSaving] = useState(false);

    const getTodayRange = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
        return { start, end };
    };

    const fetchCierreData = useCallback(async () => {
        setLoading(true);
        try {
            const { start, end } = getTodayRange();

            const { data: orders, error } = await supabase
                .from('orders')
                .select('*, order_items(product_name, quantity, unit_price, selected_size)')
                .gte('created_at', start)
                .lte('created_at', end)
                .in('status', ['entregado', 'completado', 'listo']);

            if (error) throw error;

            const cierre: CierreData = {
                fechaTurno: new Date().toLocaleDateString('es-MX', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                }),
                totalOrdenes: orders?.length ?? 0,
                totalVentas: 0,
                ventasEfectivo: 0,
                ventasTarjeta: 0,
                ventasOtro: 0,
                totalProductos: 0,
                topProductos: [],
                ordenesPorTipo: [],
                ticketPromedio: 0,
            };

            const productMap: Record<string, number> = {};
            const tipoMap: Record<string, { count: number; total: number }> = {};

            orders?.forEach(order => {
                cierre.totalVentas += order.total_amount ?? 0;

                const method = (order.payment_method || 'otro').toLowerCase();
                if (method === 'efectivo') cierre.ventasEfectivo += order.total_amount ?? 0;
                else if (method === 'tarjeta') cierre.ventasTarjeta += order.total_amount ?? 0;
                else cierre.ventasOtro += order.total_amount ?? 0;

                const tipo = order.order_type === 'delivery' ? 'Domicilio'
                    : order.order_type === 'takeout' ? 'Pick Up'
                    : 'Comedor';
                if (!tipoMap[tipo]) tipoMap[tipo] = { count: 0, total: 0 };
                tipoMap[tipo].count += 1;
                tipoMap[tipo].total += order.total_amount ?? 0;

                (order.order_items as any[])?.forEach((item: any) => {
                    const key = item.product_name || 'Sin nombre';
                    productMap[key] = (productMap[key] || 0) + (item.quantity || 1);
                    cierre.totalProductos += item.quantity || 1;
                });
            });

            cierre.topProductos = Object.entries(productMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, qty]) => ({ name, qty }));

            cierre.ordenesPorTipo = Object.entries(tipoMap)
                .map(([tipo, v]) => ({ tipo, count: v.count, total: v.total }));

            cierre.ticketPromedio = cierre.totalOrdenes > 0
                ? cierre.totalVentas / cierre.totalOrdenes : 0;

            setData(cierre);
        } catch (err) {
            console.error('[CierreCaja]', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchCierreData(); }, [fetchCierreData]);

    // Calculated difference
    const fondoNum = parseFloat(fondoInicial) || 0;
    const contadoNum = parseFloat(efectivoContado) || 0;
    const expectedCash = fondoNum + (data?.ventasEfectivo ?? 0);
    const diferencia = contadoNum - expectedCash;

    const handleConfirmarCierre = async () => {
        setSaving(true);
        try {
            const payload = {
                fecha_turno: data?.fechaTurno,
                cajero: cashierName,
                total_ordenes: data?.totalOrdenes || 0,
                total_productos: data?.totalProductos || 0,
                total_ventas: data?.totalVentas || 0,
                ventas_efectivo: data?.ventasEfectivo || 0,
                ventas_tarjeta: data?.ventasTarjeta || 0,
                ventas_otro: data?.ventasOtro || 0,
                ticket_promedio: data?.ticketPromedio || 0,
                fondo_inicial: fondoNum,
                efectivo_esperado: expectedCash,
                efectivo_contado: contadoNum,
                diferencia: diferencia,
                top_productos: data?.topProductos || []
            };

            await fetch('/api/admin/closures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            setStep('done');
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        if (!data) return;
        const lines = [
            `CIERRE DE CAJA — CASALEÑA`,
            `Fecha: ${data.fechaTurno}`,
            `Cajero: ${cashierName}`,
            `${'─'.repeat(32)}`,
            `ÓRDENES HOY: ${data.totalOrdenes}`,
            `PRODUCTOS VENDIDOS: ${data.totalProductos}`,
            `TICKET PROMEDIO: $${data.ticketPromedio.toFixed(2)}`,
            `${'─'.repeat(32)}`,
            `VENTAS POR FORMA DE PAGO`,
            `Efectivo:   $${data.ventasEfectivo.toFixed(2)}`,
            `Tarjeta:    $${data.ventasTarjeta.toFixed(2)}`,
            `Otro:       $${data.ventasOtro.toFixed(2)}`,
            `TOTAL:      $${data.totalVentas.toFixed(2)}`,
            `${'─'.repeat(32)}`,
            `CUADRE DE CAJA`,
            `Fondo inicial:     $${fondoNum.toFixed(2)}`,
            `Efectivo esperado: $${expectedCash.toFixed(2)}`,
            `Efectivo contado:  $${contadoNum.toFixed(2)}`,
            `DIFERENCIA:        $${diferencia.toFixed(2)}`,
            `${'─'.repeat(32)}`,
            `TOP PRODUCTOS:`,
            ...data.topProductos.map((p, i) => `  ${i + 1}. ${p.name} (${p.qty})`),
            `${'─'.repeat(32)}`,
            `Cierre generado: ${new Date().toLocaleString('es-MX')}`,
        ].join('\n');

        const win = window.open('', '_blank', 'width=400,height=700');
        if (win) {
            win.document.write(`<pre style="font-family:monospace;font-size:12px;padding:20px;">${lines}</pre>`);
            win.document.close();
            win.print();
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-[#f0ede9] bg-[#181511] rounded-t-3xl">
                    <div>
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Cajero: {cashierName}</p>
                        <h2 className="text-xl font-black text-white">Cierre de Caja</h2>
                    </div>
                    {!mustClose && step !== 'done' && (
                        <button onClick={onClose} className="size-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    )}
                </div>

                {/* Progress steps */}
                <div className="flex border-b border-[#f0ede9]">
                    {[
                        { key: 'summary', label: '1. Resumen' },
                        { key: 'count', label: '2. Cuadre' },
                        { key: 'confirm', label: '3. Confirmar' },
                    ].map(s => (
                        <div
                            key={s.key}
                            className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest transition-colors ${step === s.key ? 'text-[#F27405] border-b-2 border-[#F27405]' : step === 'done' ? 'text-green-500' : 'text-gray-300'}`}
                        >{s.label}</div>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto">

                    {/* STEP 1: Summary */}
                    {step === 'summary' && (
                        <div className="p-6 space-y-5">
                            {loading ? (
                                <div className="flex flex-col items-center py-12 gap-4">
                                    <div className="size-10 border-4 border-orange-100 border-t-[#F27405] rounded-full animate-spin" />
                                    <p className="text-sm font-bold text-gray-400">Calculando el día...</p>
                                </div>
                            ) : data && (
                                <>
                                    {/* Date banner */}
                                    <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                                        <span className="material-symbols-outlined text-2xl text-[#F27405]">calendar_today</span>
                                        <div>
                                            <p className="text-[10px] font-black text-[#F27405] uppercase tracking-widest">Turno del día</p>
                                            <p className="font-black text-[#181511] text-sm capitalize">{data.fechaTurno}</p>
                                        </div>
                                    </div>

                                    {/* KPI grid */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'Órdenes', value: data.totalOrdenes, icon: 'receipt_long', color: 'text-blue-600' },
                                            { label: 'Productos', value: data.totalProductos, icon: 'local_pizza', color: 'text-purple-600' },
                                            { label: 'Ticket Prom.', value: `$${data.ticketPromedio.toFixed(0)}`, icon: 'avg_pace', color: 'text-green-600' },
                                        ].map(k => (
                                            <div key={k.label} className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
                                                <span className={`material-symbols-outlined text-2xl mb-1 block ${k.color}`}>{k.icon}</span>
                                                <p className="font-black text-xl text-[#181511]">{k.value}</p>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{k.label}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Payment breakdown */}
                                    <div className="bg-[#181511] rounded-2xl p-5 text-white space-y-3">
                                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3">Ventas por Forma de Pago</p>
                                        {[
                                            { label: 'Efectivo', val: data.ventasEfectivo, icon: 'payments', color: 'text-green-400' },
                                            { label: 'Tarjeta', val: data.ventasTarjeta, icon: 'credit_card', color: 'text-blue-400' },
                                            { label: 'Otro', val: data.ventasOtro, icon: 'more_horiz', color: 'text-gray-400' },
                                        ].map(pm => (
                                            <div key={pm.label} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className={`material-symbols-outlined text-lg ${pm.color}`}>{pm.icon}</span>
                                                    <span className="text-sm font-bold text-gray-300">{pm.label}</span>
                                                </div>
                                                <span className="font-black text-white">${pm.val.toFixed(2)}</span>
                                            </div>
                                        ))}
                                        <div className="border-t border-white/10 pt-3 flex justify-between">
                                            <span className="font-black text-sm uppercase tracking-wider">TOTAL DEL DÍA</span>
                                            <span className="font-black text-[#F27405] text-xl">${data.totalVentas.toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Order type breakdown */}
                                    {data.ordenesPorTipo.length > 0 && (
                                        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-2">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Órdenes por Canal</p>
                                            {data.ordenesPorTipo.map(t => (
                                                <div key={t.tipo} className="flex items-center justify-between text-sm">
                                                    <span className="font-bold text-[#181511]">{t.tipo}</span>
                                                    <div className="flex gap-4">
                                                        <span className="text-[#8c785f] font-bold">{t.count} pedidos</span>
                                                        <span className="font-black text-[#181511]">${t.total.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Top products */}
                                    {data.topProductos.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Más Vendidos del Día</p>
                                            {data.topProductos.map((p, i) => (
                                                <div key={p.name} className="flex items-center gap-3">
                                                    <span className={`size-6 rounded-lg flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                                                    <span className="flex-1 text-sm font-bold text-[#181511]">{p.name}</span>
                                                    <span className="text-sm font-black text-primary bg-orange-50 px-2 py-0.5 rounded-lg">{p.qty} uds.</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* STEP 2: Cash Count */}
                    {step === 'count' && (
                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
                                <span className="material-symbols-outlined text-blue-500 shrink-0 mt-0.5">info</span>
                                <p className="text-sm font-bold text-blue-700">Ingresa el fondo inicial (dinero que había en caja al empezar el turno) y cuánto efectivo contaste físicamente.</p>
                            </div>

                            {[
                                { label: 'Fondo inicial del turno ($)', val: fondoInicial, set: setFondoInicial, placeholder: '0.00', hint: 'Dinero en caja al iniciar' },
                                { label: 'Efectivo contado en caja ($)', val: efectivoContado, set: setEfectivoContado, placeholder: '0.00', hint: 'Cuenta los billetes y monedas ahora' },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">{f.label}</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[#8c785f] text-lg">$</span>
                                        <input
                                            type="number"
                                            value={f.val}
                                            onChange={e => f.set(e.target.value)}
                                            placeholder={f.placeholder}
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-8 pr-5 py-4 font-black text-[#181511] text-lg placeholder-gray-200 focus:border-[#F27405] outline-none transition-all"
                                            step="0.01"
                                            min="0"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold mt-1 ml-1">{f.hint}</p>
                                </div>
                            ))}

                            {/* Live cuadre preview */}
                            {(fondoInicial || efectivoContado) && data && (
                                <div className="bg-[#181511] rounded-2xl p-5 space-y-2 text-sm">
                                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-3">Vista previa del cuadre</p>
                                    {[
                                        { l: 'Fondo inicial', v: fondoNum },
                                        { l: 'Ventas efectivo', v: data.ventasEfectivo },
                                        { l: 'Efectivo esperado', v: expectedCash },
                                        { l: 'Efectivo contado', v: contadoNum },
                                    ].map(r => (
                                        <div key={r.l} className="flex justify-between">
                                            <span className="text-gray-400 font-bold">{r.l}</span>
                                            <span className="font-black text-white">${r.v.toFixed(2)}</span>
                                        </div>
                                    ))}
                                    <div className={`flex justify-between border-t border-white/10 pt-2 mt-2`}>
                                        <span className="font-black text-sm uppercase">Diferencia</span>
                                        <span className={`font-black text-lg ${diferencia === 0 ? 'text-green-400' : diferencia > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                            {diferencia >= 0 ? '+' : ''}{diferencia.toFixed(2)}
                                        </span>
                                    </div>
                                    {diferencia !== 0 && (
                                        <p className="text-[10px] font-bold mt-1 text-center" style={{ color: diferencia > 0 ? '#60a5fa' : '#f87171' }}>
                                            {diferencia > 0 ? '⬆ Sobrante en caja' : '⬇ Faltante en caja'}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: Confirm */}
                    {step === 'confirm' && data && (
                        <div className="p-6 space-y-5">
                            <div className="text-center py-4">
                                <span className="material-symbols-outlined text-5xl text-[#F27405]">lock_clock</span>
                                <h3 className="text-xl font-black text-[#181511] mt-3">¿Confirmar Cierre?</h3>
                                <p className="text-sm text-[#8c785f] mt-1">Esta acción cerrará el turno del día.</p>
                            </div>

                            <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 text-sm">
                                {[
                                    { l: 'Total ventas del día', v: `$${data.totalVentas.toFixed(2)}`, bold: true },
                                    { l: 'Efectivo en caja', v: `$${data.ventasEfectivo.toFixed(2)}` },
                                    { l: 'Total tarjeta', v: `$${data.ventasTarjeta.toFixed(2)}` },
                                    { l: 'Fondo inicial', v: `$${fondoNum.toFixed(2)}` },
                                    { l: 'Efectivo contado', v: `$${contadoNum.toFixed(2)}` },
                                    { l: 'Diferencia de caja', v: `${diferencia >= 0 ? '+' : ''}$${diferencia.toFixed(2)}`, alert: diferencia !== 0 },
                                ].map(row => (
                                    <div key={row.l} className={`flex justify-between px-5 py-3 ${row.bold ? 'bg-orange-50' : ''}`}>
                                        <span className={`font-bold ${row.alert ? 'text-red-600' : 'text-[#8c785f]'}`}>{row.l}</span>
                                        <span className={`font-black ${row.bold ? 'text-[#F27405] text-base' : row.alert && diferencia < 0 ? 'text-red-600' : 'text-[#181511]'}`}>{row.v}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Done */}
                    {step === 'done' && (
                        <div className="p-8 flex flex-col items-center justify-center text-center gap-5">
                            <div className="size-20 rounded-3xl bg-green-100 flex items-center justify-center">
                                <span className="material-symbols-outlined text-5xl text-green-600">check_circle</span>
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-[#181511]">¡Turno Cerrado!</h3>
                                <p className="text-[#8c785f] text-sm mt-2 font-bold">El cierre de caja fue registrado correctamente.</p>
                            </div>
                            <div className="w-full bg-orange-50 border border-orange-200 rounded-2xl p-5 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="font-bold text-[#8c785f]">Total del día</span><span className="font-black text-[#F27405] text-lg">${data?.totalVentas.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span className="font-bold text-[#8c785f]">Diferencia de caja</span><span className={`font-black ${diferencia < 0 ? 'text-red-500' : 'text-green-600'}`}>{diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)}</span></div>
                            </div>
                            <button
                                onClick={handlePrint}
                                className="w-full flex items-center justify-center gap-2 bg-[#181511] text-white py-4 rounded-2xl font-black hover:bg-black transition-all active:scale-95"
                            >
                                <span className="material-symbols-outlined">print</span>
                                Imprimir Reporte de Cierre
                            </button>
                            <button onClick={() => { onCloseSuccess?.(); onClose(); }} className="text-sm text-[#8c785f] font-bold hover:text-[#181511] transition-colors">
                                Cerrar Ventana
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                {step !== 'done' && (
                    <div className="px-6 py-5 border-t border-[#f0ede9] flex gap-3">
                        {step !== 'summary' && (
                            <button
                                onClick={() => setStep(step === 'confirm' ? 'count' : 'summary')}
                                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-[#8c785f] font-black hover:bg-gray-50 transition-colors"
                            >
                                ← Atrás
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (step === 'summary') setStep('count');
                                else if (step === 'count') setStep('confirm');
                                else handleConfirmarCierre();
                            }}
                            disabled={saving || loading}
                            className={`flex-1 py-3.5 rounded-2xl font-black shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2
                                ${step === 'confirm' ? 'bg-green-600 text-white shadow-green-200 hover:bg-green-700' : 'bg-[#F27405] text-white shadow-orange-200 hover:bg-orange-600'}`}
                        >
                            {saving ? (
                                <><div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Cerrando...</>
                            ) : step === 'confirm' ? (
                                <><span className="material-symbols-outlined">lock</span> Confirmar y Cerrar Turno</>
                            ) : (
                                <>Siguiente →</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
