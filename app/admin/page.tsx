'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface DashboardStats {
    totalSales: string;
    totalOrders: number;
    avgOrderValue: string;
    completedOrders: number;
    weeklySales: string;
    topProduct: string;
    chartData: Array<{ day: string; amount: number; date: string }>;
    categoryStats: Array<{ name: string; count: number; percentage: number }>;
}

interface Transaction {
    id: string;
    time: string;
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

    useEffect(() => {
        fetchDashboardData();
    }, [timeRange]);

    const fetchDashboardData = async () => {
        if (!stats) setLoading(true); // Only show full loader on first load
        else setIsRefreshing(true); // Show refresh indicator on subsequent updates

        try {
            console.log(`=== FETCHING ADMIN DASHBOARD DATA (Range: ${timeRange}) ===`);

            // Fetch both in parallel to speed up
            // Note: transactions don't depend on range currently, but we refetch to keep sync if needed
            // If optimize: only fetch transactions once or separately.
            const [statsRes, transactionsRes] = await Promise.all([
                fetch(`/api/dashboard/stats?range=${timeRange}`),
                fetch('/api/dashboard/transactions?limit=5')
            ]);

            const statsData = await statsRes.json();
            const transactionsData = await transactionsRes.json();

            // console.log('Stats received:', statsData);
            // console.log('Transactions received:', transactionsData);

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
                return 'bg-green-100 text-green-800';
            case 'pendiente':
                return 'bg-yellow-100 text-yellow-800';
            case 'en_preparacion':
                return 'bg-blue-100 text-blue-800';
            case 'cancelado':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'completado':
                return 'Completed';
            case 'pendiente':
                return 'Pending';
            case 'en_preparacion':
                return 'Processing';
            case 'cancelado':
                return 'Cancelled';
            default:
                return status;
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

    return (
        <main className="flex-1 overflow-hidden flex flex-row">
            {/* Central Dashboard */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">

                <div className="flex flex-col gap-6 sm:gap-8 max-w-[1200px] mx-auto">
                    {/* Header - Responsive */}
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-[#181511]">Sales Overview</h1>
                        <p className="text-[#8c785f] text-xs sm:text-sm">Monitor your daily performance metrics.</p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards - Responsive Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                {/* Card 1 - Total Sales */}
                                <div className="flex flex-col gap-3 sm:gap-4 rounded-xl p-4 sm:p-5 bg-white border border-[#e6e1db] shadow-sm relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[#8c785f] text-xs sm:text-sm font-medium">Ventas Totales</p>
                                            <p className="text-[#181511] text-xl sm:text-2xl font-bold">${stats?.totalSales || '0.00'}</p>
                                        </div>
                                        <div className="size-9 sm:size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-xl sm:text-2xl">payments</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs sm:text-sm">
                                        <span className="material-symbols-outlined text-green-600 text-base sm:text-lg">trending_up</span>
                                        <span className="text-green-600 font-bold">+12%</span>
                                        <span className="text-[#8c785f] hidden sm:inline">vs periodo anterior</span>
                                        <span className="text-[#8c785f] sm:hidden">vs anterior</span>
                                    </div>
                                </div>

                                {/* Card 2 - Total Orders */}
                                <div className="flex flex-col gap-3 sm:gap-4 rounded-xl p-4 sm:p-5 bg-white border border-[#e6e1db] shadow-sm relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[#8c785f] text-xs sm:text-sm font-medium">Órdenes Totales</p>
                                            <p className="text-[#181511] text-xl sm:text-2xl font-bold">{stats?.totalOrders || 0}</p>
                                        </div>
                                        <div className="size-9 sm:size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-xl sm:text-2xl">receipt_long</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs sm:text-sm">
                                        <span className="material-symbols-outlined text-green-600 text-base sm:text-lg">trending_up</span>
                                        <span className="text-green-600 font-bold">+5%</span>
                                        <span className="text-[#8c785f] hidden sm:inline">vs periodo anterior</span>
                                        <span className="text-[#8c785f] sm:hidden">vs anterior</span>
                                    </div>
                                </div>

                                {/* Card 3 - Avg Order Value */}
                                <div className="flex flex-col gap-3 sm:gap-4 rounded-xl p-4 sm:p-5 bg-white border border-[#e6e1db] shadow-sm relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[#8c785f] text-xs sm:text-sm font-medium">Ticket Promedio</p>
                                            <p className="text-[#181511] text-xl sm:text-2xl font-bold">${stats?.avgOrderValue || '0.00'}</p>
                                        </div>
                                        <div className="size-9 sm:size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-xl sm:text-2xl">stacked_line_chart</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs sm:text-sm">
                                        <span className="material-symbols-outlined text-red-500 text-base sm:text-lg">trending_down</span>
                                        <span className="text-red-500 font-bold">-2%</span>
                                        <span className="text-[#8c785f] hidden sm:inline">vs periodo anterior</span>
                                        <span className="text-[#8c785f] sm:hidden">vs anterior</span>
                                    </div>
                                </div>

                                {/* Card 4 - Top Selling */}
                                <div className="flex flex-col gap-3 sm:gap-4 rounded-xl p-4 sm:p-5 bg-white border border-[#e6e1db] shadow-sm relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[#8c785f] text-xs sm:text-sm font-medium">Más Vendido</p>
                                            <p className="text-[#181511] text-base sm:text-lg font-bold truncate">{stats?.topProduct || 'N/A'}</p>
                                        </div>
                                        <div className="size-9 sm:size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-xl sm:text-2xl">local_pizza</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs sm:text-sm">
                                        <span className="material-symbols-outlined text-green-600 text-base sm:text-lg">trending_up</span>
                                        <span className="text-green-600 font-bold">+8%</span>
                                        <span className="text-[#8c785f]">popularidad</span>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Section - Responsive */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                                {/* Line Chart - Takes 2 columns on large screens */}
                                <div className="lg:col-span-2 rounded-xl border border-[#e6e1db] bg-white p-4 sm:p-6 shadow-sm relative transition-all">
                                    {isRefreshing && (
                                        <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-xl transition-all duration-300">
                                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                        </div>
                                    )}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                                        <div>
                                            <p className="text-[#181511] text-base sm:text-lg font-bold">{getChartTitle()}</p>
                                            <p className="text-[#8c785f] text-xs sm:text-sm">{getChartSubtitle()}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex bg-gray-100 rounded-lg p-1">
                                                <button
                                                    onClick={() => setTimeRange('week')}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeRange === 'week' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    Semana
                                                </button>
                                                <button
                                                    onClick={() => setTimeRange('month')}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeRange === 'month' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    Mes
                                                </button>
                                                <button
                                                    onClick={() => setTimeRange('year')}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${timeRange === 'year' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                                >
                                                    Año
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="w-full h-[180px] sm:h-[240px] relative">
                                        {stats?.chartData && stats.chartData.length > 0 ? (
                                            <svg className="w-full h-full overflow-visible" viewBox="0 0 800 240" preserveAspectRatio="none">
                                                <defs>
                                                    <linearGradient id="gradient" x1="0%" x2="0%" y1="0%" y2="100%">
                                                        <stop offset="0%" style={{ stopColor: '#f7951d', stopOpacity: 0.2 }}></stop>
                                                        <stop offset="100%" style={{ stopColor: '#f7951d', stopOpacity: 0 }}></stop>
                                                    </linearGradient>
                                                </defs>
                                                {/* Grid Lines */}
                                                <line stroke="#f0f0f0" strokeWidth="1" x1="0" x2="800" y1="240" y2="240"></line>
                                                <line stroke="#f0f0f0" strokeDasharray="4" strokeWidth="1" x1="0" x2="800" y1="180" y2="180"></line>
                                                <line stroke="#f0f0f0" strokeDasharray="4" strokeWidth="1" x1="0" x2="800" y1="120" y2="120"></line>
                                                <line stroke="#f0f0f0" strokeDasharray="4" strokeWidth="1" x1="0" x2="800" y1="60" y2="60"></line>

                                                {(() => {
                                                    const data = stats.chartData || [];
                                                    const maxVal = Math.max(...data.map(d => d.amount), 1); // Avoid div by 0
                                                    const width = 800;
                                                    const height = 240;
                                                    const paddingBottom = 40;
                                                    const usableHeight = height - paddingBottom;

                                                    // Ensure we have enough data points to render something meaningful
                                                    const xStep = data.length > 1 ? width / (data.length - 1) : width;

                                                    // Generate points
                                                    const points = data.map((d, i) => {
                                                        const x = i * xStep;
                                                        const y = height - ((d.amount / maxVal) * usableHeight) - 20; // 20px padding bottom
                                                        return `${x},${y}`;
                                                    }).join(' ');

                                                    const areaPath = `M0,${height} ${points.split(' ').map((p, i) => {
                                                        const [x, y] = p.split(',');
                                                        return `L${x},${y}`;
                                                    }).join(' ')} V${height} Z`.replace('M0,240 L', 'M');

                                                    // Simple Polyline for the line
                                                    const linePath = `M${points.replace(/ /g, ' L')}`;

                                                    return (
                                                        <>
                                                            <path d={`${areaPath}`} fill="url(#gradient)"></path>
                                                            <path d={linePath} fill="none" stroke="#f7951d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                                                            {data.map((d, i) => {
                                                                const x = i * xStep;
                                                                const y = height - ((d.amount / maxVal) * usableHeight) - 20;
                                                                // Show tooltip/dot only for fewer points to avoid clutter, or show all
                                                                const showDot = data.length <= 15 || i % Math.ceil(data.length / 15) === 0;

                                                                if (!showDot) return null;

                                                                return (
                                                                    <g key={i} className="group/point">
                                                                        <circle cx={x} cy={y} fill="white" r="4" stroke="#f7951d" strokeWidth="2" className="cursor-pointer transition-all duration-300 hover:r-6" />
                                                                        <text x={x} y={y - 15} textAnchor="middle" className="text-xs font-bold fill-[#181511] opacity-0 group-hover/point:opacity-100 transition-opacity">
                                                                            ${d.amount.toFixed(0)}
                                                                        </text>
                                                                    </g>
                                                                );
                                                            })}
                                                        </>
                                                    );
                                                })()}
                                            </svg>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                                                No hay datos disponibles para este periodo
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between mt-3 sm:mt-4 text-[#8c785f] text-[10px] sm:text-xs font-bold uppercase tracking-wider overflow-x-auto scrollbar-hide">
                                        {stats?.chartData?.map((d, i) => {
                                            // Only show labels occasionally if many data points
                                            const showLabel = stats.chartData.length <= 12 || i % Math.ceil(stats.chartData.length / 12) === 0;
                                            return (
                                                <span key={i} className={`shrink-0 ${!showLabel && 'hidden'}`}>{d.day}</span>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Bar Chart - Responsive */}
                                <div className="rounded-xl border border-[#e6e1db] bg-white p-4 sm:p-6 shadow-sm flex flex-col">
                                    <p className="text-[#181511] text-base sm:text-lg font-bold mb-1">Ventas por Categoría</p>
                                    <p className="text-[#8c785f] text-xs sm:text-sm mb-4 sm:mb-6">Productos más vendidos</p>
                                    <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 px-1 sm:px-2">
                                        {stats?.categoryStats && stats.categoryStats.length > 0 ? (
                                            stats.categoryStats.map((cat, index) => {
                                                const opacity = Math.max(0.3, 1 - (index * 0.2));
                                                return (
                                                    <div key={index} className="flex flex-col items-center gap-2 flex-1 group w-full">
                                                        <div className="w-full bg-[#fcead2] rounded-t-lg relative h-32 sm:h-40 group-hover:bg-[#fcdab0] transition-colors overflow-hidden flex items-end justify-center">
                                                            <div
                                                                className="w-full rounded-t-lg transition-all duration-1000 ease-out"
                                                                style={{
                                                                    height: `${cat.percentage}%`,
                                                                    backgroundColor: `rgba(247, 149, 29, ${opacity})`
                                                                }}
                                                            ></div>
                                                            <div className="absolute top-2 text-[10px] sm:text-xs font-bold text-[#8c785f] opacity-0 group-hover:opacity-100 transition-opacity text-center w-full px-1">
                                                                {cat.count} vendidos
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] sm:text-xs font-bold text-[#8c785f] text-center truncate w-full" title={cat.name}>{cat.name}</span>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="w-full text-center py-10 text-gray-400 text-sm">No hay datos de categoría</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Transactions Table - Responsive with Horizontal Scroll */}
                            <div className="rounded-xl border border-[#e6e1db] bg-white shadow-sm overflow-hidden">
                                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-[#e6e1db] flex items-center justify-between">
                                    <h3 className="text-[#181511] text-base sm:text-lg font-bold">Transacciones Recientes</h3>
                                    <button className="text-primary text-xs sm:text-sm font-bold hover:underline">Ver Todo</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[640px]">
                                        <thead>
                                            <tr className="bg-[#fcfbf9] text-[#8c785f] text-[10px] sm:text-xs uppercase tracking-wider">
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold">ID Orden</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold">Hora</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold">Artículos</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold">Monto</th>
                                                <th className="px-4 sm:px-6 py-3 sm:py-4 font-bold text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#e6e1db]">
                                            {transactions.length > 0 ? (
                                                transactions.map((transaction) => (
                                                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold text-[#181511]">{transaction.id}</td>
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#8c785f]">{transaction.time}</td>
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-[#181511]">{transaction.items}</td>
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-bold text-[#181511]">{transaction.amount}</td>
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-center">
                                                            <span className={`inline-flex items-center px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${getStatusBadgeClass(transaction.status)}`}>
                                                                {getStatusLabel(transaction.status)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-4 sm:px-6 py-6 sm:py-8 text-center text-[#8c785f] text-sm">
                                                        No hay transacciones recientes
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>


        </main>
    );
}
