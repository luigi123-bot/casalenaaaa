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
    const [step, setStep] = useState<'summary' | 'count' | 'gastos' | 'confirm' | 'done'>('summary');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Gastos state
    const [gastosCombustible, setGastosCombustible] = useState('');
    const [gastosInsumoCocina, setGastosInsumoCocina] = useState('');
    const [gastosInsumoLimpieza, setGastosInsumoLimpieza] = useState('');

    const fetchCierreData = useCallback(async () => {
        console.log('🚀 [Cierre] Iniciando proceso de cálculo de ventas...');
        setLoading(true);
        setError(null);
        try {
            // Recuperar el momento exacto en que se abrió la caja desde localStorage
            const dateStr = new Date().toLocaleDateString('sv-SE');
            const saved = localStorage.getItem(`caja_casalena_${dateStr}`);
            console.log('📡 [Cierre] Consultando resumen al servidor (API)...');
            
            const res = await Promise.race([
                fetch('/api/cashier/closure-summary'),
                new Promise<any>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))
            ]);

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Error al obtener el resumen del servidor');
            }

            const cierre = await res.json();
            console.log('✅ [Cierre] Resumen recibido del servidor:', cierre);
            
            setData(cierre);
        } catch (err: any) {
            if (err.name === 'AbortError') {
                setError('La conexión es lenta. El servidor no respondió a tiempo. Reintenta por favor.');
            } else {
                setError(err.message || 'Error al conectar con la base de datos');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        console.log('🔄 [Cierre] Montando componente / Re-ejecutando useEffect');
        const loadInitialShiftInfo = () => {
            const dateStr = new Date().toLocaleDateString('sv-SE');
            const saved = localStorage.getItem(`caja_casalena_${dateStr}`);
            if (saved) {
                const shift = JSON.parse(saved);
                if (shift.fondo) {
                    setFondoInicial(shift.fondo.toString());
                    console.log('🔄 [Cierre] Fondo inicial recuperado:', shift.fondo);
                }
            }
        };
        loadInitialShiftInfo();
        fetchCierreData(); 

        // Respaldo final: si después de 40s sigue cargando, forzar cierre del loader
        const finalSafety = setTimeout(() => setLoading(false), 40000);
        return () => clearTimeout(finalSafety);
    }, [fetchCierreData]);

    // Gastos totals
    const gastosCombustibleNum = parseFloat(gastosCombustible) || 0;
    const gastosInsumoCocinaNum = parseFloat(gastosInsumoCocina) || 0;
    const gastosInsumoLimpiezaNum = parseFloat(gastosInsumoLimpieza) || 0;
    const totalGastos = gastosCombustibleNum + gastosInsumoCocinaNum + gastosInsumoLimpiezaNum;

    // Calculated difference
    const fondoNum = parseFloat(fondoInicial) || 0;
    const contadoNum = parseFloat(efectivoContado) || 0;
    const expectedCash = fondoNum + (data?.ventasEfectivo ?? 0) - totalGastos;
    const diferencia = contadoNum - expectedCash;

    const handleConfirmarCierre = async () => {
        setSaving(true);
        try {
            const dateStr = new Date().toLocaleDateString('sv-SE');
            const saved = localStorage.getItem(`caja_casalena_${dateStr}`);
            const shift = saved ? JSON.parse(saved) : null;

            // Datos comunes calculados del día
            const metrics = {
                total_orders: data?.totalOrdenes || 0,
                total_products: data?.totalProductos || 0,
                total_sales: data?.totalVentas || 0,
                ventas_efectivo: data?.ventasEfectivo || 0,
                ventas_tarjeta: data?.ventasTarjeta || 0,
                initial_fund: fondoNum,
                expected_cash: expectedCash,
                final_cash: contadoNum,
                difference: diferencia,
                notes: `Cierre del turno - ${new Date().toLocaleTimeString('es-MX')}`,
                top_products: data?.topProductos || [],
                gastos_combustible: gastosCombustibleNum,
                gastos_insumo_cocina: gastosInsumoCocinaNum,
                gastos_insumo_limpieza: gastosInsumoLimpiezaNum,
                total_gastos: totalGastos,
                status: 'closed',
                closed_at: new Date().toISOString()
            };

            // 1. Actualizar Sesión (Nueva Tabla)
            if (shift && shift.sessionId) {
                 await Promise.race([
                    supabase.from('cashier_sessions').update(metrics).eq('id', shift.sessionId),
                    new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout al actualizar base de datos')), 8000))
                 ]);
                console.log('✅ [Shift] Sesión actualizada exitosamente en cashier_sessions.');
            }

            // 2. Guardar en Historial (Tabla Antigua compatible)
            // IMPORTANTE: Esta tabla usa nombres en ESPAÑOL
            const legacyPayload = {
                fecha_turno: `${data?.fechaTurno}${totalGastos > 0 ? ` | GASTOS: ${totalGastos.toFixed(2)}` : ''}`,
                cajero: cashierName,
                total_ordenes: metrics.total_orders,
                total_productos: metrics.total_products,
                total_ventas: metrics.total_sales,
                ventas_efectivo: metrics.ventas_efectivo,
                ventas_tarjeta: metrics.ventas_tarjeta,
                ventas_otro: data?.ventasOtro || 0,
                ticket_promedio: data?.ticketPromedio || 0,
                fondo_inicial: metrics.initial_fund,
                efectivo_esperado: metrics.expected_cash,
                efectivo_contado: metrics.final_cash,
                diferencia: metrics.difference,
                top_productos: metrics.top_products,
                gastos_combustible: metrics.gastos_combustible,
                gastos_insumo_cocina: metrics.gastos_insumo_cocina,
                gastos_insumo_limpieza: metrics.gastos_insumo_limpieza,
                total_gastos: metrics.total_gastos
            };

            const res = await Promise.race([
                fetch('/api/admin/closures', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(legacyPayload)
                }),
                new Promise<any>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT_API')), 10000))
            ]);

            if (!res.ok) {
                const errData = await res.json();
                setError(errData.error || 'Error en la respuesta del servidor');
                setSaving(false);
                return;
            }

            // 3. Marcar como cerrado en LocalStorage para evitar re-aperturas fantasma
            try {
                const dateStr = new Date().toLocaleDateString('sv-SE');
                const key = `caja_casalena_${dateStr}`;
                const current = localStorage.getItem(key);
                if (current) {
                    const parsed = JSON.parse(current);
                    localStorage.setItem(key, JSON.stringify({ ...parsed, closedAt: new Date().toISOString() }));
                }
                // Limpiar cualquier otra sesión abierta vieja
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k?.startsWith('caja_casalena_')) {
                        const val = localStorage.getItem(k);
                        if (val) {
                            const s = JSON.parse(val);
                            if (!s.closedAt) {
                                localStorage.setItem(k, JSON.stringify({ ...s, closedAt: new Date().toISOString() }));
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('[Cierre] No se pudo actualizar localStorage, pero la DB sí se actualizó.');
            }

            setStep('done');
            console.log('🏁 [Cierre] Proceso de cierre completado.');
        } catch (error: any) {
            console.error('🛑 [Cierre] Error catastrófico cerrando caja:', error);
            alert(`No se pudo cerrar la caja: ${error.message || 'Error de conexión'}. Verifica tu conexión a internet o habla con el administrador.`);
        } finally {
            setSaving(false);
        }
    };

    const handlePrint = () => {
        if (!data) return;

        const diferenciaLabel = diferencia === 0 ? '✓ CAJA CUADRADA' : diferencia > 0 ? '▲ SOBRANTE' : '▼ FALTANTE';

        const ticketHtml = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Cierre de Caja — Casaleña</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Courier New',Courier,monospace;width:80mm;max-width:80mm;margin:0 auto;padding:6mm 4mm;font-size:11px;color:#000000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.header{text-align:center;margin-bottom:6px}
.logo{font-size:22px;font-weight:900;letter-spacing:3px;text-transform:uppercase;color:#000}
.sub{font-size:9px;font-weight:700;color:#000;letter-spacing:1px;text-transform:uppercase;margin-top:1px}
.doc-title{margin-top:6px;background:#000;color:#fff;font-size:11px;font-weight:900;letter-spacing:2px;text-transform:uppercase;padding:3px 0}
.meta{font-size:9px;color:#000;font-weight:700;margin-top:4px;line-height:1.6}
.dashed{border:none;border-top:1px dashed #000;margin:5px 0}
.solid{border:none;border-top:2px solid #000;margin:5px 0}
.double{border:none;border-top:3px double #000;margin:5px 0}
.section{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;color:#000;text-align:center;border-top:1px solid #000;border-bottom:1px solid #000;padding:2px 0;margin:5px 0 4px 0}
.row{display:flex;justify-content:space-between;align-items:baseline;margin:2px 0}
.row .label{font-size:10px;font-weight:700;color:#000}
.row .value{font-size:10px;font-weight:900;color:#000;text-align:right}
.row.indent .label{padding-left:8px;font-size:9px}
.row.indent .value{font-size:9px}
.row.bold .label,.row.bold .value{font-size:11px;font-weight:900}
.total-box{border:2px solid #000;padding:5px 6px;margin:5px 0;display:flex;justify-content:space-between;align-items:center}
.total-box .t-label{font-size:11px;font-weight:900;text-transform:uppercase;color:#000}
.total-box .t-value{font-size:16px;font-weight:900;color:#000}
.diff-box{border:3px solid #000;padding:6px;margin:6px 0;text-align:center}
.diff-box .diff-label{font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#000}
.diff-box .diff-value{font-size:20px;font-weight:900;color:#000;margin:2px 0}
.diff-box .diff-status{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;color:#000}
.prod-row{display:flex;justify-content:space-between;margin:2px 0}
.prod-row .num{font-size:9px;font-weight:900;color:#000;width:14px}
.prod-row .name{font-size:9px;font-weight:700;color:#000;flex:1;padding:0 4px}
.prod-row .qty{font-size:9px;font-weight:900;color:#000;text-align:right}
.footer{text-align:center;margin-top:8px}
.footer p{font-size:8px;font-weight:700;color:#000;line-height:1.6}
.sign-line{border-top:1px solid #000;margin:10px auto 2px;width:60%}
@page{size:80mm auto;margin:0}
@media print{body{width:80mm}}
</style>
</head>
<body>
<div class="header">
  <div class="logo">CASALEÑA</div>
  <div class="sub">Pizza &amp; Grill · Ometepec, Gro.</div>
  <div class="doc-title">INFORME DE CIERRE DE CAJA</div>
  <div class="meta">
    Fecha: ${data.fechaTurno}<br/>
    Cajero: ${cashierName.toUpperCase()}<br/>
    Impreso: ${new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
  </div>
</div>
<hr class="double"/>
<div class="section">Resumen Operativo</div>
<div class="row bold"><span class="label">Total de Ordenes</span><span class="value">${data.totalOrdenes}</span></div>
<div class="row"><span class="label">Productos Vendidos</span><span class="value">${data.totalProductos}</span></div>
<div class="row"><span class="label">Ticket Promedio</span><span class="value">$${data.ticketPromedio.toFixed(2)}</span></div>
<hr class="dashed"/>
${data.ordenesPorTipo.length > 0 ? `<div class="section">Ventas por Canal</div>${data.ordenesPorTipo.map((t: any) => `<div class="row"><span class="label">${t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1)}</span><span class="value">${t.count} - $${t.total.toFixed(2)}</span></div>`).join('')}<hr class="dashed"/>` : ''}
<div class="section">Formas de Pago</div>
<div class="row"><span class="label">Efectivo</span><span class="value">$${data.ventasEfectivo.toFixed(2)}</span></div>
<div class="row"><span class="label">Tarjeta</span><span class="value">$${data.ventasTarjeta.toFixed(2)}</span></div>
<div class="row"><span class="label">Transferencia / Otro</span><span class="value">$${data.ventasOtro.toFixed(2)}</span></div>
<div class="total-box"><span class="t-label">TOTAL VENTAS</span><span class="t-value">$${data.totalVentas.toFixed(2)}</span></div>
<div class="section">Gastos del Turno</div>
<div class="row"><span class="label">Combustible</span><span class="value">$${gastosCombustibleNum.toFixed(2)}</span></div>
<div class="row"><span class="label">Insumos Cocina</span><span class="value">$${gastosInsumoCocinaNum.toFixed(2)}</span></div>
<div class="row"><span class="label">Insumos Limpieza</span><span class="value">$${gastosInsumoLimpiezaNum.toFixed(2)}</span></div>
<div class="row bold"><span class="label">TOTAL GASTOS</span><span class="value">$${totalGastos.toFixed(2)}</span></div>
<hr class="solid"/>
<div class="section">Cuadre de Caja</div>
<div class="row"><span class="label">Fondo Inicial</span><span class="value">$${fondoNum.toFixed(2)}</span></div>
<div class="row indent"><span class="label">(+) Ventas Efectivo</span><span class="value">$${data.ventasEfectivo.toFixed(2)}</span></div>
<div class="row indent"><span class="label">(-) Gastos</span><span class="value">$${totalGastos.toFixed(2)}</span></div>
<hr class="dashed"/>
<div class="row bold"><span class="label">Efectivo Esperado</span><span class="value">$${expectedCash.toFixed(2)}</span></div>
<div class="row bold"><span class="label">Efectivo Contado</span><span class="value">$${contadoNum.toFixed(2)}</span></div>
<div class="diff-box">
  <div class="diff-label">Diferencia</div>
  <div class="diff-value">${diferencia >= 0 ? '+' : ''}$${diferencia.toFixed(2)}</div>
  <div class="diff-status">${diferenciaLabel}</div>
</div>
${data.topProductos.length > 0 ? `<div class="section">Top Productos del Dia</div>${data.topProductos.map((p: any, i: number) => `<div class="prod-row"><span class="num">${i + 1}.</span><span class="name">${p.name}</span><span class="qty">${p.qty} uds.</span></div>`).join('')}` : ''}
<hr class="double"/>
<div class="footer">
  <div class="sign-line"></div>
  <p>Firma del Cajero</p>
  <p style="margin-top:8px">${cashierName.toUpperCase()}</p>
  <p style="margin-top:10px;font-size:7px">Documento de control interno - No valido como comprobante fiscal</p>
</div>
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}};</script>
</body>
</html>`;

        const win = window.open('', '_blank', 'width=500,height=900');
        if (win) {
            win.document.write(ticketHtml);
            win.document.close();
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="flex items-center justify-between px-7 py-5 border-b border-[#f0ede9] bg-[#181511] rounded-t-3xl">
                    <div>
                        <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Cajero: {cashierName || 'Cargando...'}</p>
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
                        { key: 'gastos', label: '3. Gastos' },
                        { key: 'confirm', label: '4. Confirmar' },
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
                            ) : error ? (
                                <div className="flex flex-col items-center py-12 gap-4 text-center">
                                    <span className="material-symbols-outlined text-red-500 text-5xl">error</span>
                                    <div>
                                        <p className="text-sm font-black text-gray-900">No se pudo cargar la información</p>
                                        <p className="text-xs text-gray-500 mt-1 max-w-[280px]">{error}</p>
                                    </div>
                                    <button 
                                        onClick={() => fetchCierreData()}
                                        className="mt-2 px-6 py-2 bg-gray-900 text-white text-xs font-black rounded-xl hover:bg-black transition-all"
                                    >
                                        REINTENTAR
                                    </button>
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
                                            { label: 'Ticket Prom.', value: `${data.ticketPromedio.toFixed(0)}`, icon: 'avg_pace', color: 'text-green-600' },
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
                                        { l: 'Gastos totales', v: -totalGastos },
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

                    {/* STEP 3: Gastos */}
                    {step === 'gastos' && (
                        <div className="p-6 space-y-5">
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                                <span className="material-symbols-outlined text-red-400 shrink-0 mt-0.5">receipt</span>
                                <p className="text-sm font-bold text-red-700">Registra los gastos del turno por categoría. Déjalo en $0 si no hubo gastos en esa categoría.</p>
                            </div>

                            {[
                                {
                                    label: 'Combustibles (Gas, Gasolina, Leña)',
                                    icon: 'local_gas_station',
                                    color: 'text-orange-500',
                                    val: gastosCombustible,
                                    set: setGastosCombustible,
                                    hint: 'Gas LP, gasolina, leña, carbón, etc.'
                                },
                                {
                                    label: 'Insumos Cocina',
                                    icon: 'restaurant',
                                    color: 'text-green-600',
                                    val: gastosInsumoCocina,
                                    set: setGastosInsumoCocina,
                                    hint: 'Ingredientes, empaque, utensilios, etc.'
                                },
                                {
                                    label: 'Insumos Limpieza',
                                    icon: 'cleaning_services',
                                    color: 'text-blue-500',
                                    val: gastosInsumoLimpieza,
                                    set: setGastosInsumoLimpieza,
                                    hint: 'Detergentes, desinfectantes, trapos, etc.'
                                },
                            ].map(f => (
                                <div key={f.label}>
                                    <label className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest block mb-2">
                                        <span className={`material-symbols-outlined text-base ${f.color}`}>{f.icon}</span>
                                        {f.label}
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-[#8c785f] text-lg">$</span>
                                        <input
                                            type="number"
                                            value={f.val}
                                            onChange={e => f.set(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl pl-8 pr-5 py-4 font-black text-[#181511] text-lg placeholder-gray-200 focus:border-[#F27405] outline-none transition-all"
                                            step="0.01"
                                            min="0"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 font-bold mt-1 ml-1">{f.hint}</p>
                                </div>
                            ))}

                            {totalGastos > 0 && (
                                <div className="bg-[#181511] rounded-2xl p-4 flex justify-between items-center">
                                    <span className="font-black text-[10px] text-orange-400 uppercase tracking-widest">Total Gastos del Turno</span>
                                    <span className="font-black text-white text-xl">${totalGastos.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 4: Confirm */}
                    {step === 'confirm' && data && (
                        <div className="p-6 space-y-5">
                            <div className="text-center py-4">
                                <span className="material-symbols-outlined text-5xl text-[#F27405]">lock_clock</span>
                                <h3 className="text-xl font-black text-[#181511] mt-3">¿Confirmar Cierre?</h3>
                                <p className="text-sm text-[#8c785f] mt-1">Esta acción cerrará el turno del día.</p>
                            </div>

                            <div className="bg-gray-50 rounded-2xl border border-gray-100 divide-y divide-gray-100 text-sm">
                                {[
                                    { l: 'Total ventas del día', v: `${data.totalVentas.toFixed(2)}`, bold: true },
                                    { l: 'Efectivo en caja', v: `${data.ventasEfectivo.toFixed(2)}` },
                                    { l: 'Total tarjeta', v: `${data.ventasTarjeta.toFixed(2)}` },
                                    { l: 'Fondo inicial', v: `${fondoNum.toFixed(2)}` },
                                    { l: 'Efectivo contado', v: `${contadoNum.toFixed(2)}` },
                                    { l: 'Diferencia de caja', v: `${diferencia >= 0 ? '+' : ''}${diferencia.toFixed(2)}`, alert: diferencia !== 0 },
                                ].map(row => (
                                    <div key={row.l} className={`flex justify-between px-5 py-3 ${row.bold ? 'bg-orange-50' : ''}`}>
                                        <span className={`font-bold ${row.alert ? 'text-red-600' : 'text-[#8c785f]'}`}>{row.l}</span>
                                        <span className={`font-black ${row.bold ? 'text-[#F27405] text-base' : row.alert && diferencia < 0 ? 'text-red-600' : 'text-[#181511]'}`}>{row.v}</span>
                                    </div>
                                ))}
                            </div>

                            {totalGastos > 0 && (
                                <div className="bg-red-50 rounded-2xl border border-red-100 divide-y divide-red-100 text-sm">
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest px-5 pt-3 pb-1">Gastos del Turno</p>
                                    {gastosCombustibleNum > 0 && (
                                        <div className="flex justify-between px-5 py-3">
                                            <span className="font-bold text-[#8c785f]">⛽ Combustibles</span>
                                            <span className="font-black text-[#181511]">${gastosCombustibleNum.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {gastosInsumoCocinaNum > 0 && (
                                        <div className="flex justify-between px-5 py-3">
                                            <span className="font-bold text-[#8c785f]">🍴 Insumos Cocina</span>
                                            <span className="font-black text-[#181511]">${gastosInsumoCocinaNum.toFixed(2)}</span>
                                        </div>
                                    )}
                                    {gastosInsumoLimpiezaNum > 0 && (
                                        <div className="flex justify-between px-5 py-3">
                                            <span className="font-bold text-[#8c785f]">🧹 Insumos Limpieza</span>
                                            <span className="font-black text-[#181511]">${gastosInsumoLimpiezaNum.toFixed(2)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between px-5 py-3 bg-red-50">
                                        <span className="font-black text-red-600">Total Gastos</span>
                                        <span className="font-black text-red-600">${totalGastos.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}
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
                                onClick={() => setStep(step === 'confirm' ? 'gastos' : step === 'gastos' ? 'count' : 'summary')}
                                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-[#8c785f] font-black hover:bg-gray-50 transition-colors"
                            >
                                ← Atrás
                            </button>
                        )}
                        <button
                            onClick={() => {
                                if (step === 'summary') setStep('count');
                                else if (step === 'count') setStep('gastos');
                                else if (step === 'gastos') setStep('confirm');
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
