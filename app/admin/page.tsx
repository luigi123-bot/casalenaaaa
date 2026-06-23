'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSafeFetch } from '@/hooks/useSafeFetch';

// Dynamically import map to avoid SSR issues — show skeleton while loading
const DeliveryMap = dynamic(() => import('@/components/DeliveryMap'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full min-h-[200px] bg-gray-100 rounded-xl animate-pulse flex items-center justify-center">
            <span className="text-gray-400 text-sm font-medium">Cargando mapa...</span>
        </div>
    ),
});

interface DashboardStats {
    totalSales: string;
    totalOrders: number;
    avgOrderValue: string;
    completedOrders: number;
    weeklySales: string;
    topProduct: string;
    chartData: Array<{ day: string; amount: number; date: string }>;
    categoryStats: Array<{ name: string; count: number; percentage: number }>;
    changes?: { sales: string; orders: string };
}

interface Transaction {
    id: string;
    time: string;
    date: string;
    datetime: string;
    items: string;
    amount: string;
    status: string;
    paymentMethod?: string;
}

export default function AdminPage() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
    const [activeDrivers, setActiveDrivers] = useState<any[]>([]);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
    const safeFetch = useSafeFetch();

    const ORIGIN: [number, number] = [16.6853, -98.4116]; 

    useEffect(() => {
        // Subscribe to all driver updates for fleet monitoring
        const { supabase } = require('@/utils/supabase/client');
        
        const fetchDrivers = async () => {
            const { data } = await supabase.from('delivery_drivers').select('*').eq('is_active', true);
            if (data) setActiveDrivers(data);
        };
        fetchDrivers();

        const channel = supabase.channel('admin_fleet_monitor')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_drivers' }, () => {
                fetchDrivers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        fetchDashboardData();
    }, [timeRange]);

    const fetchDashboardData = async () => {
        if (!stats) setLoading(true);
        else setIsRefreshing(true);

        try {
            // Calcular offset de zona horaria local (ej. -05:00)
            const timezoneOffset = new Date().getTimezoneOffset();
            const offsetHours = Math.abs(Math.floor(timezoneOffset / 60));
            const offsetMinutes = Math.abs(timezoneOffset % 60);
            const offsetSign = timezoneOffset > 0 ? '-' : '+';
            const offsetString = encodeURIComponent(`${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`);

            const [statsRes, transactionsRes] = await Promise.all([
                safeFetch(`/api/dashboard/stats?range=${timeRange}&tz=${offsetString}`),
                safeFetch(`/api/dashboard/transactions?limit=8&range=${timeRange}&tz=${offsetString}`)
            ]);

            // safeFetch returns a never-resolving promise on abort — check ok before parsing
            if (!statsRes.ok || !transactionsRes.ok) return;

            const [statsData, transactionsData] = await Promise.all([
                statsRes.json(),
                transactionsRes.json(),
            ]);

            setStats(statsData);
            setTransactions(Array.isArray(transactionsData) ? transactionsData : []);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'completado':
                return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
            case 'pendiente':
                return 'bg-amber-50 text-amber-700 border border-amber-100';
            case 'en_preparacion':
                return 'bg-blue-50 text-blue-700 border border-blue-100';
            case 'cancelado':
                return 'bg-red-50 text-red-700 border border-red-100';
            default:
                return 'bg-gray-50 text-gray-700 border border-gray-100';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completado': return 'Completado';
            case 'pendiente': return 'Pendiente';
            case 'en_preparacion': return 'En proceso';
            case 'cancelado': return 'Cancelado';
            default: return status;
        }
    };

    const getStatusDot = (status: string) => {
        switch (status) {
            case 'completado': return 'bg-emerald-500';
            case 'pendiente': return 'bg-amber-500';
            case 'en_preparacion': return 'bg-blue-500';
            case 'cancelado': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };

    const getChartTitle = () => {
        switch (timeRange) {
            case 'week': return 'Ingresos Semanales';
            case 'month': return 'Ingresos Mensuales';
            case 'year': return 'Ingresos Anuales';
            default: return 'Ingresos';
        }
    };

    const getChartSubtitle = () => {
        switch (timeRange) {
            case 'week': return 'Últimos 7 días';
            case 'month': return 'Este mes';
            case 'year': return 'Este año';
            default: return '';
        }
    };

    const statCards = [
        {
            label: 'Ventas Totales',
            value: `$${stats?.totalSales || '0.00'}`,
            change: stats?.changes?.sales,
            icon: 'payments',
            color: 'from-orange-500 to-amber-400',
            bgLight: 'bg-orange-50',
            textColor: 'text-orange-600',
        },
        {
            label: 'Órdenes Totales',
            value: stats?.totalOrders?.toString() || '0',
            change: stats?.changes?.orders,
            icon: 'receipt_long',
            color: 'from-violet-500 to-purple-400',
            bgLight: 'bg-violet-50',
            textColor: 'text-violet-600',
        },
        {
            label: 'Ticket Promedio',
            value: `$${stats?.avgOrderValue || '0.00'}`,
            change: '-2',
            icon: 'stacked_line_chart',
            color: 'from-sky-500 to-cyan-400',
            bgLight: 'bg-sky-50',
            textColor: 'text-sky-600',
        },
        {
            label: 'Más Vendido',
            value: stats?.topProduct || 'N/A',
            change: '+8',
            icon: 'local_pizza',
            color: 'from-emerald-500 to-teal-400',
            bgLight: 'bg-emerald-50',
            textColor: 'text-emerald-600',
            isPositive: true,
        },
    ];

    return (
        <main className="flex-1 overflow-hidden flex flex-row bg-[#f5f4f1]">
            {/* Central Dashboard */}
            <div className="flex-1 overflow-y-auto">

                {/* Hero Header */}
                <div className="bg-[#181511] px-6 sm:px-10 lg:px-14 pt-8 pb-14 relative overflow-hidden">
                    {/* Decorative circles */}
                    <div className="absolute -top-20 -right-20 size-80 rounded-full bg-[#f7951d]/10 blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-10 left-1/3 size-60 rounded-full bg-violet-500/10 blur-3xl pointer-events-none" />

                    <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="size-2 bg-[#f7951d] rounded-full animate-pulse inline-block" />
                                <span className="text-[#f7951d] text-[10px] font-black uppercase tracking-[3px]">Panel de Control</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Resumen de Ventas</h1>
                            <p className="text-gray-400 text-sm mt-1 font-medium">Monitorea el rendimiento en tiempo real.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchDashboardData}
                                disabled={isRefreshing}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-black rounded-xl border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                            >
                                <span className={`material-symbols-outlined text-sm ${isRefreshing ? 'animate-spin' : ''}`}>refresh</span>
                                Actualizar
                            </button>
                        </div>
                    </div>
                </div>

                <div className="px-4 sm:px-8 lg:px-12 -mt-8 pb-12 max-w-[1200px] mx-auto space-y-6">

                    {/* Stat Cards — float over the dark header */}
                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-32 rounded-2xl bg-white shadow-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {statCards.map((card, i) => {
                                const isNeg = card.change?.toString().startsWith('-');
                                const changeNum = card.change?.toString().replace('%', '').replace('+', '') || '0';
                                return (
                                    <div key={i} className="bg-white rounded-2xl shadow-lg border border-white/60 p-5 flex flex-col gap-4 hover:shadow-xl transition-all duration-300 group relative overflow-hidden">
                                        <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${card.bgLight} -translate-y-8 translate-x-8 group-hover:scale-125 transition-transform duration-500`} />
                                        <div className="flex items-start justify-between relative">
                                            <div>
                                                <p className="text-[#8c785f] text-xs font-bold uppercase tracking-wider">{card.label}</p>
                                                <p className={`text-[#181511] text-xl sm:text-2xl font-black mt-1 leading-tight ${i === 3 ? 'text-base sm:text-base' : ''}`}>
                                                    {card.value}
                                                </p>
                                            </div>
                                            <div className={`size-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md shrink-0`}>
                                                <span className="material-symbols-outlined text-white text-xl">{card.icon}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black ${isNeg ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                <span className="material-symbols-outlined text-[12px]">{isNeg ? 'trending_down' : 'trending_up'}</span>
                                                {isNeg ? '' : '+'}{changeNum}%
                                            </div>
                                            <span className="text-[#8c785f] text-[10px] font-medium">
                                                {i === 3 ? 'popularidad' : 'vs período anterior'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {!loading && (
                        <>
                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                                {/* Line Chart */}
                                <div className="lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm relative transition-all">
                                    {isRefreshing && (
                                        <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-sm rounded-2xl transition-all duration-300">
                                            <div className="w-8 h-8 border-4 border-[#f7951d] border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                                        <div>
                                            <p className="text-[#181511] text-base font-black">{getChartTitle()}</p>
                                            <p className="text-[#8c785f] text-xs font-medium mt-0.5">{getChartSubtitle()}</p>
                                        </div>
                                        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
                                            {(['week', 'month', 'year'] as const).map((r) => (
                                                <button
                                                    key={r}
                                                    onClick={() => setTimeRange(r)}
                                                    className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${timeRange === r ? 'bg-white text-[#f7951d] shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                                >
                                                    {r === 'week' ? 'Sem' : r === 'month' ? 'Mes' : 'Año'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="w-full h-[200px] sm:h-[250px] relative">
                                        {stats?.chartData && stats.chartData.length > 0 ? (
                                            <svg className="w-full h-full overflow-visible" viewBox="0 0 800 250" preserveAspectRatio="none">
                                                <defs>
                                                    <linearGradient id="chartGradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                                        <stop offset="0%" style={{ stopColor: '#f7951d', stopOpacity: 0.25 }} />
                                                        <stop offset="100%" style={{ stopColor: '#f7951d', stopOpacity: 0 }} />
                                                    </linearGradient>
                                                    <filter id="glow">
                                                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                                        <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                                    </filter>
                                                </defs>
                                                {/* Grid */}
                                                {[0, 1, 2, 3, 4].map((g) => (
                                                    <line key={g} stroke="#f0ede9" strokeDasharray={g > 0 ? "6 4" : "0"} strokeWidth="1"
                                                        x1="0" x2="800" y1={200 - g * 50} y2={200 - g * 50} />
                                                ))}
                                                {(() => {
                                                    const data = stats.chartData || [];
                                                    const maxVal = Math.max(...data.map(d => d.amount), 1);
                                                    const width = 800;
                                                    const height = 250;
                                                    const paddingBottom = 50;
                                                    const paddingTop = 20;
                                                    const usableHeight = height - paddingBottom - paddingTop;
                                                    const xStep = data.length > 1 ? width / (data.length - 1) : width;

                                                    const pts = data.map((d, i) => ({
                                                        x: i * xStep,
                                                        y: paddingTop + usableHeight - (d.amount / maxVal) * usableHeight,
                                                        amount: d.amount,
                                                    }));

                                                    const pointsStr = pts.map(p => `${p.x},${p.y}`).join(' ');
                                                    const linePath = `M${pts.map(p => `${p.x},${p.y}`).join(' L')}`;
                                                    const areaPath = `M0,${height - paddingBottom} L${pts.map(p => `${p.x},${p.y}`).join(' L')} L${width},${height - paddingBottom} Z`;

                                                    return (
                                                        <>
                                                            <path d={areaPath} fill="url(#chartGradient)" />
                                                            <path d={linePath} fill="none" stroke="#f7951d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
                                                            {pts.map((p, i) => {
                                                                const showDot = data.length <= 15 || i % Math.ceil(data.length / 15) === 0;
                                                                if (!showDot) return null;
                                                                const isHovered = hoveredPoint === i;
                                                                return (
                                                                    <g key={i}>
                                                                        {isHovered && (
                                                                            <>
                                                                                <line x1={p.x} x2={p.x} y1={paddingTop} y2={height - paddingBottom}
                                                                                    stroke="#f7951d" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
                                                                                <rect x={p.x - 36} y={p.y - 32} width="72" height="22" rx="6"
                                                                                    fill="#181511" />
                                                                                <text x={p.x} y={p.y - 17} textAnchor="middle"
                                                                                    style={{ fontSize: 11, fontWeight: 800, fill: 'white' }}>
                                                                                    ${p.amount.toFixed(0)}
                                                                                </text>
                                                                            </>
                                                                        )}
                                                                        <circle cx={p.x} cy={p.y}
                                                                            r={isHovered ? 6 : 4}
                                                                            fill={isHovered ? '#f7951d' : 'white'}
                                                                            stroke="#f7951d"
                                                                            strokeWidth="2.5"
                                                                            style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                                                                            onMouseEnter={() => setHoveredPoint(i)}
                                                                            onMouseLeave={() => setHoveredPoint(null)}
                                                                        />
                                                                    </g>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}
                                            </svg>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-300 text-sm font-medium">
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="material-symbols-outlined text-4xl text-gray-200">bar_chart</span>
                                                    No hay datos para este período
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* X-axis labels */}
                                    <div className="flex justify-between mt-3 text-[#8c785f] text-[10px] font-bold uppercase tracking-wider overflow-x-auto scrollbar-hide px-1">
                                        {stats?.chartData?.map((d, i) => {
                                            const showLabel = stats.chartData.length <= 12 || i % Math.ceil(stats.chartData.length / 12) === 0;
                                            return (
                                                <span key={i}
                                                    className={`shrink-0 transition-colors ${!showLabel ? 'hidden' : ''} ${hoveredPoint === i ? 'text-[#f7951d]' : ''}`}>
                                                    {d.day}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Bar Chart */}
                                <div className="rounded-2xl border border-gray-100 bg-white p-5 sm:p-6 shadow-sm flex flex-col">
                                    <p className="text-[#181511] text-base font-black">Ventas por Categoría</p>
                                    <p className="text-[#8c785f] text-xs font-medium mt-0.5 mb-6">Productos más vendidos</p>

                                    {stats?.categoryStats && stats.categoryStats.length > 0 ? (
                                        <div className="flex-1 flex items-end justify-between gap-3 px-1">
                                            {stats.categoryStats.map((cat, index) => {
                                                const colors = [
                                                    { bar: '#f7951d', bg: '#fef0db' },
                                                    { bar: '#8b5cf6', bg: '#ede9fe' },
                                                    { bar: '#0ea5e9', bg: '#e0f2fe' },
                                                    { bar: '#10b981', bg: '#d1fae5' },
                                                    { bar: '#f43f5e', bg: '#ffe4e6' },
                                                ];
                                                const c = colors[index % colors.length];
                                                return (
                                                    <div key={index} className="flex flex-col items-center gap-2 flex-1 group min-w-0">
                                                        <span className="text-[10px] font-black" style={{ color: c.bar }}>{cat.percentage.toFixed(0)}%</span>
                                                        <div className="w-full rounded-xl relative flex items-end justify-center overflow-hidden" style={{ height: '140px', backgroundColor: c.bg }}>
                                                            <div
                                                                className="w-full rounded-xl transition-all duration-700 ease-out group-hover:opacity-90"
                                                                style={{
                                                                    height: `${Math.max(cat.percentage, 4)}%`,
                                                                    backgroundColor: c.bar,
                                                                }}
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-[10px] font-black text-white bg-black/30 px-2 py-0.5 rounded-lg backdrop-blur-sm">
                                                                    {cat.count} ventas
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] sm:text-[10px] font-bold text-[#8c785f] text-center leading-tight line-clamp-2 px-0.5" title={cat.name}>
                                                            {cat.name}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex items-center justify-center text-gray-300 flex-col gap-2">
                                            <span className="material-symbols-outlined text-4xl">bar_chart</span>
                                            <span className="text-sm font-medium">Sin datos</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Recent Transactions */}
                            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-[#181511] text-base font-black">Transacciones Recientes</h3>
                                        <p className="text-[#8c785f] text-xs font-medium mt-0.5">{transactions.length} transacciones registradas</p>
                                    </div>
                                    <Link href="/admin/orders" className="flex items-center gap-1.5 text-[#f7951d] text-xs font-black hover:underline">
                                        Ver todo
                                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                    </Link>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[620px]">
                                        <thead>
                                            <tr className="bg-[#faf9f7] text-[#8c785f] text-[10px] uppercase tracking-widest">
                                                <th className="px-5 sm:px-6 py-3 font-black">Orden</th>
                                                <th className="px-5 sm:px-6 py-3 font-black">Fecha / Hora</th>
                                                <th className="px-5 sm:px-6 py-3 font-black">Artículos</th>
                                                <th className="px-5 sm:px-6 py-3 font-black">Monto</th>
                                                <th className="px-5 sm:px-6 py-3 font-black text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {transactions.length > 0 ? (
                                                transactions.map((transaction, idx) => (
                                                    <tr key={transaction.id} className="hover:bg-[#faf9f7] transition-colors group">
                                                        <td className="px-5 sm:px-6 py-3.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="size-7 rounded-lg bg-[#f7951d]/10 flex items-center justify-center shrink-0">
                                                                    <span className="material-symbols-outlined text-[#f7951d] text-sm">receipt</span>
                                                                </div>
                                                                <span className="text-[#181511] text-xs font-black">{transaction.id}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 sm:px-6 py-3.5">
                                                            <span className="block text-xs font-bold text-[#181511]">{transaction.date}</span>
                                                            <span className="text-[10px] text-[#8c785f] font-medium">{transaction.time}</span>
                                                        </td>
                                                        <td className="px-5 sm:px-6 py-3.5 text-xs text-[#181511] font-medium max-w-[180px] truncate">{transaction.items}</td>
                                                        <td className="px-5 sm:px-6 py-3.5">
                                                            <span className="text-sm font-black text-[#181511]">{transaction.amount}</span>
                                                        </td>
                                                        <td className="px-5 sm:px-6 py-3.5 text-center">
                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black ${getStatusBadgeClass(transaction.status)}`}>
                                                                <span className={`size-1.5 rounded-full ${getStatusDot(transaction.status)}`} />
                                                                {getStatusLabel(transaction.status)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-2 text-gray-300">
                                                            <span className="material-symbols-outlined text-4xl">receipt_long</span>
                                                            <span className="text-sm font-medium">No hay transacciones recientes</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Fleet Monitoring */}
                            <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
                                <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-[#181511] text-base font-black">Monitoreo de Flota</h3>
                                        <p className="text-[#8c785f] text-xs font-medium mt-0.5">Ubicación en tiempo real de tus repartidores.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-100">
                                            <span className="size-1.5 bg-emerald-500 rounded-full animate-ping inline-block" />
                                            {activeDrivers.filter(d => d.status === 'disponible' || d.status === 'ocupado').length} ACTIVOS
                                        </span>
                                        {activeDrivers.length > 0 && (
                                            <div className="flex -space-x-1.5">
                                                {activeDrivers.slice(0, 3).map((d, i) => (
                                                    <div key={i} className="size-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 border-2 border-white flex items-center justify-center text-white text-[9px] font-black" title={d.full_name}>
                                                        {(d.full_name || 'R').charAt(0)}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 h-[400px] w-full relative z-0">
                                    <DeliveryMap
                                        origin={ORIGIN}
                                        destination={null}
                                        drivers={activeDrivers}
                                    />
                                    {activeDrivers.length > 1 && (
                                        <div className="absolute top-6 right-6 z-[10] bg-white/95 backdrop-blur p-3 rounded-xl shadow-lg border border-gray-100 min-w-[140px]">
                                            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Repartidores</p>
                                            <ul className="space-y-2">
                                                {activeDrivers.slice(0, 4).map((d, i) => (
                                                    <li key={i} className="flex items-center gap-2">
                                                        <span className={`size-2 rounded-full shrink-0 ${d.status === 'disponible' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                        <span className="text-[11px] font-bold text-gray-700 truncate">{d.full_name}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}
