'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';

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
    gastos_combustible?: number;
    gastos_insumo_cocina?: number;
    gastos_insumo_limpieza?: number;
    total_gastos?: number;
    created_at: string;
}

type TimeFilter = 'today' | 'week' | 'month' | 'year' | 'custom';

export default function CierresRerportsPage() {
    const [cierres, setCierres] = useState<CashClosure[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCierre, setSelectedCierre] = useState<CashClosure | null>(null);
    const [secretUnlocked, setSecretUnlocked] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const keyBufferRef = useRef('');

    // ── Filtros ──────────────────────────────────────────────────────────────
    const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
    const [cajeroFilter, setCajeroFilter] = useState<string>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

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

    // ── Cajeros únicos para selector ─────────────────────────────────────────
    const cajeroOptions = useMemo(() => {
        const normalizedMap = new Map<string, string>(); // Upper-cased -> original trimmed name
        cierres.forEach(c => {
            if (!c.cajero) return;
            const trimmed = c.cajero.trim();
            const upper = trimmed.toUpperCase();
            // Prefer mixed case over all-caps if both exist
            const existing = normalizedMap.get(upper);
            if (!existing || (existing === existing.toUpperCase() && trimmed !== trimmed.toUpperCase())) {
                normalizedMap.set(upper, trimmed);
            }
        });
        return Array.from(normalizedMap.values()).sort((a, b) => a.localeCompare(b));
    }, [cierres]);

    // ── Lógica de filtrado ────────────────────────────────────────────────────
    const filteredCierres = useMemo(() => {
        const now = new Date();

        const getStartOf = (unit: TimeFilter): Date => {
            const d = new Date(now);
            if (unit === 'today') {
                d.setHours(0, 0, 0, 0);
            } else if (unit === 'week') {
                const day = d.getDay(); // 0=domingo
                d.setDate(d.getDate() - day);
                d.setHours(0, 0, 0, 0);
            } else if (unit === 'month') {
                d.setDate(1);
                d.setHours(0, 0, 0, 0);
            } else if (unit === 'year') {
                d.setMonth(0, 1);
                d.setHours(0, 0, 0, 0);
            }
            return d;
        };

        return cierres.filter(c => {
            // Filtro por cajero (ignora espacios y diferencias de mayúsculas/minúsculas)
            if (cajeroFilter !== 'all') {
                const closureCajero = c.cajero?.trim().toUpperCase();
                const filterCajero = cajeroFilter.trim().toUpperCase();
                if (closureCajero !== filterCajero) return false;
            }

            // Filtro por fecha usando created_at
            const fecha = new Date(c.created_at);

            if (timeFilter === 'custom') {
                if (customFrom) {
                    const from = new Date(customFrom);
                    from.setHours(0, 0, 0, 0);
                    if (fecha < from) return false;
                }
                if (customTo) {
                    const to = new Date(customTo);
                    to.setHours(23, 59, 59, 999);
                    if (fecha > to) return false;
                }
                return true;
            }

            const start = getStartOf(timeFilter);
            return fecha >= start && fecha <= now;
        });
    }, [cierres, timeFilter, cajeroFilter, customFrom, customTo]);

    // ── Totales del período filtrado ──────────────────────────────────────────
    const summaryStats = useMemo(() => {
        return filteredCierres.reduce((acc, c) => ({
            totalVentas: acc.totalVentas + c.total_ventas,
            totalEfectivo: acc.totalEfectivo + c.ventas_efectivo,
            totalTarjeta: acc.totalTarjeta + c.ventas_tarjeta,
            totalOrdenes: acc.totalOrdenes + c.total_ordenes,
            totalGastos: acc.totalGastos + (c.total_gastos || 0),
        }), { totalVentas: 0, totalEfectivo: 0, totalTarjeta: 0, totalOrdenes: 0, totalGastos: 0 });
    }, [filteredCierres]);



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

    const handleAuthSubmit = (id: string) => {
        const validKeys = ['luis', 'casalena', '1010', '2026', 'caja123'];
        if (validKeys.includes(authPassword.trim().toLowerCase())) {
            setShowPasswordPrompt(false);
            setAuthPassword('');
            setAuthError('');
            setSecretUnlocked(true);
            setTimeout(() => handleDelete(id), 100);
        } else {
            setAuthError('Clave incorrecta. Inténtalo de nuevo.');
        }
    };

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
        const diferenciaLabel = data.diferencia === 0 ? '✓ CAJA CUADRADA' : data.diferencia > 0 ? '▲ SOBRANTE' : '▼ FALTANTE';
        const fondoNum = data.fondo_inicial;
        const expectedCash = data.efectivo_esperado;
        const contadoNum = data.efectivo_contado;
        const difference = data.diferencia;
        const totalGastos = data.total_gastos || 0;
        const gastosCombustibleNum = data.gastos_combustible || 0;
        const gastosInsumoCocinaNum = data.gastos_insumo_cocina || 0;
        const gastosInsumoLimpiezaNum = data.gastos_insumo_limpieza || 0;

        const ticketBodyHtml = `
<div class="header">
  <div class="logo">CASALEÑA</div>
  <div class="sub">Pizza &amp; Grill · Ometepec, Gro.</div>
  <div class="doc-title">CIERRE DE CAJA (COPIA ADMIN)</div>
  <div class="meta">
    Fecha: ${data.fecha_turno}<br/>
    <div class="cashier-highlight">CAJERO: ${(data.cajero || '').trim().toUpperCase()}</div>
    <span style="font-size:8px">Impreso: ${new Date().toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
  </div>
</div>
<hr class="double"/>
<div class="section">Resumen</div>
<div class="row bold"><span class="label">Ordenes</span><span class="value">${data.total_ordenes}</span></div>
<div class="row"><span class="label">Productos</span><span class="value">${data.total_productos}</span></div>
<div class="row"><span class="label">Ticket Prom.</span><span class="value">$${data.ticket_promedio.toFixed(2)}</span></div>
<hr class="dashed"/>
<div class="section">Pagos</div>
<div class="row"><span class="label">Efectivo</span><span class="value">$${data.ventas_efectivo.toFixed(2)}</span></div>
<div class="row"><span class="label">Tarjeta</span><span class="value">$${data.ventas_tarjeta.toFixed(2)}</span></div>
<div class="row"><span class="label">Otros</span><span class="value">$${data.ventas_otro.toFixed(2)}</span></div>
<div class="total-box"><span class="t-label">TOTAL VENTAS</span><span class="t-value">$${data.total_ventas.toFixed(2)}</span></div>
${totalGastos > 0 ? `
<div class="section">Gastos</div>
<div class="row"><span class="label">Combust.</span><span class="value">$${gastosCombustibleNum.toFixed(2)}</span></div>
<div class="row"><span class="label">Cocina</span><span class="value">$${gastosInsumoCocinaNum.toFixed(2)}</span></div>
<div class="row"><span class="label">Limpieza</span><span class="value">$${gastosInsumoLimpiezaNum.toFixed(2)}</span></div>
<div class="row bold"><span class="label">TOTAL GASTOS</span><span class="value">$${totalGastos.toFixed(2)}</span></div>
<hr class="solid"/>
` : ''}
<div class="section">Cuadre</div>
<div class="row"><span class="label">Fondo Ini.</span><span class="value">$${fondoNum.toFixed(2)}</span></div>
<div class="row"><span class="label">(+) Efectivo</span><span class="value">$${data.ventas_efectivo.toFixed(2)}</span></div>
${totalGastos > 0 ? `<div class="row"><span class="label">(-) Gastos</span><span class="value">$${totalGastos.toFixed(2)}</span></div>` : ''}
<hr class="dashed"/>
<div class="row bold"><span class="label">Esperado</span><span class="value">$${expectedCash.toFixed(2)}</span></div>
<div class="row bold"><span class="label">Contado</span><span class="value">$${contadoNum.toFixed(2)}</span></div>
<div class="diff-box">
  <div class="diff-label">Diferencia</div>
  <div class="diff-value">${difference >= 0 ? '+' : ''}$${difference.toFixed(2)}</div>
  <div class="diff-status">${diferenciaLabel}</div>
</div>
${data.top_productos && data.top_productos.length > 0 ? `
<div class="section">Top Ventas</div>
${data.top_productos.slice(0, 5).map((p: any, i: number) => `<div class="prod-row"><span class="name">${i + 1}. ${p.name}</span><span class="qty">${p.qty}</span></div>`).join('')}
` : ''}
<hr class="double"/>
<div class="footer">
  <div class="sign-line"></div>
  <p>Firma Cajero: ${(data.cajero || '').trim().toUpperCase()}</p>
  <p style="margin-top:4px;font-size:7px">Control Interno - Casaleña POS</p>
</div>
        `;

        const cleanTicketBody = DOMPurify.sanitize(ticketBodyHtml, {
            ADD_TAGS: ['svg', 'path', 'circle', 'rect', 'hr'],
            ADD_ATTR: ['style', 'class', 'id', 'd', 'fill', 'stroke', 'width', 'height']
        });

        const isElectron = typeof window !== 'undefined' && 
                          ((window as any).electron?.isElectron || navigator.userAgent.toLowerCase().includes('electron'));

        const styles = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;width:58mm;max-width:58mm;margin:0;padding:1mm;font-size:11px;color:#000;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.header{text-align:center;margin-bottom:2px}
.logo{font-size:16px;font-weight:900;letter-spacing:1px;text-transform:uppercase}
.sub{font-size:8px;font-weight:700;margin-top:0}
.doc-title{margin-top:2px;background:#000;color:#fff;font-size:11px;font-weight:900;text-transform:uppercase;padding:1px 0}
.meta{font-size:10px;font-weight:700;margin-top:2px;line-height:1.2}
.cashier-highlight{font-size:14px;font-weight:900;background:#eee;display:block;padding:2px 0;margin:2px 0;border:1px solid #000}
.dashed{border:none;border-top:1px dashed #000;margin:3px 0}
.solid{border:none;border-top:1px solid #000;margin:3px 0}
.double{border:none;border-top:2px double #000;margin:3px 0}
.section{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1px;text-align:center;border-top:1px solid #000;border-bottom:1px solid #000;padding:1px 0;margin:4px 0 2px 0}
.row{display:flex;justify-content:space-between;align-items:baseline;margin:1px 0}
.row .label{font-size:10px;font-weight:700}
.row .value{font-size:10px;font-weight:900;text-align:right}
.row.bold .label,.row.bold .value{font-size:11px;font-weight:900}
.total-box{border:1px solid #000;padding:3px 4px;margin:3px 0;display:flex;justify-content:space-between;align-items:center}
.total-box .t-label{font-size:11px;font-weight:900}
.total-box .t-value{font-size:14px;font-weight:900}
.diff-box{border:2px solid #000;padding:4px;margin:4px 0;text-align:center}
.diff-label{font-size:9px;font-weight:900;text-transform:uppercase}
.diff-value{font-size:16px;font-weight:900;margin:1px 0}
.diff-status{font-size:10px;font-weight:900;text-transform:uppercase}
.prod-row{display:flex;justify-content:space-between;margin:1px 0;font-size:9px}
.prod-row .name{flex:1;padding-right:4px;font-weight:700}
.prod-row .qty{font-weight:900;text-align:right}
.footer{text-align:center;margin-top:4px}
.footer p{font-size:8px;font-weight:700;line-height:1.2}
.sign-line{border-top:1px solid #000;margin:8px auto 1px;width:70%}
@page{size:58mm auto;margin:0}
@media print{body{width:58mm}}
        `;

        const fullHtml = `
          <html>
            <head>
              <title>Cierre de Caja — Casaleña</title>
              <style>${styles}</style>
            </head>
            <body onload="window.print();">
              <div style="width: 58mm; overflow: hidden;">
                ${cleanTicketBody}
              </div>
            </body>
          </html>
        `;

        if (isElectron && (window as any).electron?.printSilent) {
            (window as any).electron.printSilent({ html: fullHtml })
                .catch((err: any) => {
                    console.error('[Print] Error in Admin silent print:', err);
                });
            return;
        }

        const oldIframe = document.getElementById('admin-cierre-print-iframe');
        if (oldIframe) oldIframe.remove();

        const iframe = document.createElement('iframe');
        iframe.id = 'admin-cierre-print-iframe';
        iframe.style.display = 'none';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(fullHtml);
            doc.close();
            
            // Clean up iframe after 10s
            setTimeout(() => {
                const f = document.getElementById('admin-cierre-print-iframe');
                if (f) f.remove();
            }, 10000);
        }
    };

    return (
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8f7f5]">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#e6e1db] pb-4">
                    <div>
                        <h1 className="text-3xl font-black text-[#181511] tracking-tight">Cierres de Caja</h1>
                        <p className="text-[#8c785f] mt-1 font-bold">Historial y cuadres registrados por tus cajeros.</p>
                    </div>
                    <p className="text-xs font-bold text-gray-400 mt-2 md:mt-0">
                        {filteredCierres.length} cierre{filteredCierres.length !== 1 ? 's' : ''} encontrado{filteredCierres.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* ── Barra de Filtros ── */}
                <div className="bg-white rounded-2xl border border-[#e6e1db] p-4 shadow-sm space-y-3">
                    {/* Filtros de tiempo */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1 shrink-0">Período:</span>
                        {([
                            { key: 'today', label: 'Hoy' },
                            { key: 'week',  label: 'Esta Semana' },
                            { key: 'month', label: 'Este Mes' },
                            { key: 'year',  label: 'Este Año' },
                            { key: 'custom', label: 'Personalizado' },
                        ] as { key: TimeFilter; label: string }[]).map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setTimeFilter(key)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all ${
                                    timeFilter === key
                                        ? 'bg-[#181511] text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Rango personalizado */}
                    {timeFilter === 'custom' && (
                        <div className="flex flex-wrap gap-3 items-center animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                                <span className="text-[10px] font-black text-gray-400 uppercase">Desde:</span>
                                <input
                                    type="date"
                                    value={customFrom}
                                    onChange={e => setCustomFrom(e.target.value)}
                                    className="text-sm font-bold text-[#181511] bg-transparent outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                                <span className="text-[10px] font-black text-gray-400 uppercase">Hasta:</span>
                                <input
                                    type="date"
                                    value={customTo}
                                    onChange={e => setCustomTo(e.target.value)}
                                    className="text-sm font-bold text-[#181511] bg-transparent outline-none"
                                />
                            </div>
                            {(customFrom || customTo) && (
                                <button
                                    onClick={() => { setCustomFrom(''); setCustomTo(''); }}
                                    className="text-[10px] font-black text-gray-400 hover:text-red-500 transition-colors uppercase"
                                >
                                    Limpiar rango
                                </button>
                            )}
                        </div>
                    )}

                    {/* Filtro por cajero */}
                    {cajeroOptions.length > 1 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-1 shrink-0">Cajero:</span>
                            <button
                                onClick={() => setCajeroFilter('all')}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-tight transition-all ${
                                    cajeroFilter === 'all'
                                        ? 'bg-[#F27405] text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                Todos
                            </button>
                            {cajeroOptions.map(cajero => (
                                <button
                                    key={cajero}
                                    onClick={() => setCajeroFilter(cajero)}
                                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black capitalize transition-all ${
                                        cajeroFilter === cajero
                                            ? 'bg-[#F27405] text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {cajero}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Resumen del período ── */}
                {filteredCierres.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-in fade-in duration-300">
                        {[
                            { label: 'Total Ventas', value: `$${summaryStats.totalVentas.toFixed(2)}`, icon: 'payments', color: 'text-[#F27405]', bg: 'bg-orange-50' },
                            { label: 'Efectivo', value: `$${summaryStats.totalEfectivo.toFixed(2)}`, icon: 'attach_money', color: 'text-green-600', bg: 'bg-green-50' },
                            { label: 'Transferencia', value: `$${summaryStats.totalTarjeta.toFixed(2)}`, icon: 'account_balance', color: 'text-blue-600', bg: 'bg-blue-50' },
                            { label: 'Órdenes', value: summaryStats.totalOrdenes.toString(), icon: 'receipt_long', color: 'text-purple-600', bg: 'bg-purple-50' },
                            { label: 'Gastos', value: `$${summaryStats.totalGastos.toFixed(2)}`, icon: 'trending_down', color: 'text-red-500', bg: 'bg-red-50' },
                        ].map(stat => (
                            <div key={stat.label} className={`${stat.bg} rounded-2xl p-4 border border-white/80`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`material-symbols-outlined text-base ${stat.color}`}>{stat.icon}</span>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <p className={`font-black text-xl tracking-tight ${stat.color}`}>{stat.value}</p>
                                <p className="text-[9px] font-bold text-gray-400 mt-0.5">{filteredCierres.length} cierre{filteredCierres.length !== 1 ? 's' : ''}</p>
                            </div>
                        ))}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <span className="material-symbols-outlined animate-spin text-4xl text-[#F27405]">
                            progress_activity
                        </span>
                    </div>
                ) : filteredCierres.length === 0 ? (
                    <div className="bg-white rounded-3xl p-12 text-center border shadow-sm">
                        <span className="material-symbols-outlined text-6xl text-[#8c785f] mb-4">
                            lock_clock
                        </span>
                        <h3 className="text-xl font-bold text-[#181511] mb-2">
                            {cierres.length === 0 ? 'Aún no hay reportes' : 'Sin resultados para este filtro'}
                        </h3>
                        <p className="text-[#8c785f] font-medium">
                            {cierres.length === 0
                                ? 'Los reportes aparecerán aquí cuando los cajeros terminen turno.'
                                : 'Intenta cambiar el período o el cajero seleccionado.'}
                        </p>
                        {cierres.length > 0 && (
                            <button
                                onClick={() => { setTimeFilter('month'); setCajeroFilter('all'); setCustomFrom(''); setCustomTo(''); }}
                                className="mt-4 px-4 py-2 bg-[#181511] text-white text-xs font-black rounded-xl"
                            >
                                Ver todos los cierres
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredCierres.map((c) => (
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
                                            <span className="font-black text-[#181511]">{c.cajero?.trim()}</span>
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
                    <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 relative">
                        
                        {showPasswordPrompt && (
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                                <div className="bg-white rounded-3xl p-6 w-full max-w-sm border shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
                                    <div className="text-center">
                                        <span className="material-symbols-outlined text-red-500 text-4xl mb-2">lock</span>
                                        <h4 className="font-black text-lg text-[#181511]">Clave de Autorización</h4>
                                        <p className="text-xs text-gray-400">Ingresa la clave para desbloquear la eliminación.</p>
                                    </div>
                                    <div>
                                        <input
                                            type="password"
                                            value={authPassword}
                                            onChange={(e) => setAuthPassword(e.target.value)}
                                            placeholder="Introduce la clave..."
                                            className="w-full bg-gray-50 border-2 border-gray-150 rounded-2xl px-4 py-3 font-black text-center text-[#181511] text-lg focus:border-[#F27405] focus:bg-white outline-none transition-all"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleAuthSubmit(selectedCierre.id);
                                            }}
                                            autoFocus
                                        />
                                    </div>
                                    {authError && (
                                        <p className="text-xs font-bold text-red-600 text-center animate-shake">{authError}</p>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setShowPasswordPrompt(false); setAuthPassword(''); setAuthError(''); }}
                                            className="flex-1 py-3 bg-gray-100 text-gray-500 font-black text-xs rounded-xl hover:bg-gray-200 transition-all"
                                        >
                                            CANCELAR
                                        </button>
                                        <button
                                            onClick={() => handleAuthSubmit(selectedCierre.id)}
                                            className="flex-1 py-3 bg-red-600 text-white font-black text-xs rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                                        >
                                            CONFIRMAR
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Header */}
                        <div className="flex items-center justify-between px-7 py-5 border-b border-[#f0ede9] bg-[#181511]">
                            <div className="cursor-default select-none">
                                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Detalles del Cierre</p>
                                <h2 className="text-xl font-black text-white capitalize">{selectedCierre.fecha_turno}</h2>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (secretUnlocked) {
                                            handleDelete(selectedCierre.id);
                                        } else {
                                            setShowPasswordPrompt(true);
                                        }
                                    }}
                                    disabled={deleting}
                                    className={`size-9 rounded-xl flex items-center justify-center transition-all ${
                                        secretUnlocked 
                                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30' 
                                            : 'bg-white/10 hover:bg-white/20 text-red-400 hover:text-red-500'
                                    }`}
                                    title={secretUnlocked ? "Eliminar cierre permanentemente" : "Eliminar cierre (Requires authorization)"}
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {deleting ? 'progress_activity' : secretUnlocked ? 'delete_forever' : 'lock'}
                                    </span>
                                </button>
                                <button onClick={() => handlePrint(selectedCierre)} className="size-9 rounded-xl bg-orange-500 flex items-center justify-center text-white hover:bg-orange-600 transition-colors" title="Imprimir Cierre">
                                    <span className="material-symbols-outlined text-lg">print</span>
                                </button>
                                <button onClick={() => { setSelectedCierre(null); setSecretUnlocked(false); }} className="size-9 rounded-xl bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors" title="Cerrar">
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cajero Responsable</p>
                                    <p className="font-black text-lg text-[#181511]">{selectedCierre.cajero?.trim()}</p>
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

                            {selectedCierre.total_gastos !== undefined && selectedCierre.total_gastos > 0 && (
                                <div>
                                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Gastos del Turno</h3>
                                    <div className="bg-white border rounded-2xl overflow-hidden text-sm">
                                        {selectedCierre.gastos_combustible !== undefined && selectedCierre.gastos_combustible > 0 && (
                                            <div className="flex justify-between p-4 border-b border-gray-100">
                                                <span className="font-bold text-[#8c785f]">⛽ Combustibles (Gas, Gasolina, Leña)</span>
                                                <span className="font-black">${selectedCierre.gastos_combustible.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {selectedCierre.gastos_insumo_cocina !== undefined && selectedCierre.gastos_insumo_cocina > 0 && (
                                            <div className="flex justify-between p-4 border-b border-gray-100">
                                                <span className="font-bold text-[#8c785f]">🍴 Insumos Cocina</span>
                                                <span className="font-black">${selectedCierre.gastos_insumo_cocina.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {selectedCierre.gastos_insumo_limpieza !== undefined && selectedCierre.gastos_insumo_limpieza > 0 && (
                                            <div className="flex justify-between p-4 border-b border-gray-100">
                                                <span className="font-bold text-[#8c785f]">🧹 Insumos Limpieza</span>
                                                <span className="font-black">${selectedCierre.gastos_insumo_limpieza.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between p-4 bg-red-50 text-red-700">
                                            <span className="font-black tracking-widest uppercase">Total Gastos</span>
                                            <span className="font-black text-lg">${selectedCierre.total_gastos.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Revisión de Caja Fuerte</h3>
                                <div className="bg-[#181511] text-white rounded-2xl overflow-hidden p-5 space-y-3 shadow-lg">
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold text-gray-400 text-sm">Fondo Inicial Reportado</span>
                                        <span className="font-black">${selectedCierre.fondo_inicial.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-bold text-gray-400">
                                            {selectedCierre.total_gastos !== undefined && selectedCierre.total_gastos > 0
                                                ? 'Total Esperado (Fondo + Efectivo - Gastos)'
                                                : 'Total Esperado (Fondo + Efectivo)'}
                                        </span>
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
