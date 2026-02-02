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

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            console.log('=== FETCHING ADMIN DASHBOARD DATA ===');

            // Fetch both in parallel to speed up
            const [statsRes, transactionsRes] = await Promise.all([
                fetch('/api/dashboard/stats'),
                fetch('/api/dashboard/transactions?limit=5')
            ]);

            const statsData = await statsRes.json();
            const transactionsData = await transactionsRes.json();

            console.log('Stats received:', statsData);
            console.log('Transactions received:', transactionsData);

            setStats(statsData);
            setTransactions(Array.isArray(transactionsData) ? transactionsData : []);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
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

    return (
        <main className="flex-1 overflow-hidden flex flex-row">
            {/* Central Dashboard */}
            <div className="flex-1 overflow-y-auto p-8">

                <div className="flex flex-col gap-8 max-w-[1200px] mx-auto">
                    {/* Header */}
                    <div>
                        <h1 className="text-2xl font-bold text-[#181511]">Sales Overview</h1>
                        <p className="text-[#8c785f] text-sm">Monitor your daily performance metrics.</p>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <span className="material-symbols-outlined text-5xl text-primary animate-spin">progress_activity</span>
                        </div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Card 1 - Total Sales */}
                                <div className="flex flex-col gap-4 rounded-xl p-5 bg-white border border-[#e6e1db] shadow-sm relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[#8c785f] text-sm font-medium">Ventas Totales</p>
                                            <p className="text-[#181511] text-2xl font-bold">${stats?.totalSales || '0.00'}</p>
                                        </div>
                                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined">payments</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-sm">
                                        <span className="material-symbols-outlined text-green-600 text-lg">trending_up</span>
                                        <span className="text-green-600 font-bold">+12%</span>
                                        <span className="text-[#8c785f]">vs semana anterior</span>
                                    </div>
                                </div>

                                {/* Card 2 - Total Orders */}
                                <div className="flex flex-col gap-4 rounded-xl p-5 bg-white border border-[#e6e1db] shadow-sm relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[#8c785f] text-sm font-medium">Órdenes Totales</p>
                                            <p className="text-[#181511] text-2xl font-bold">{stats?.totalOrders || 0}</p>
                                        </div>
                                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined">receipt_long</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-sm">
                                        <span className="material-symbols-outlined text-green-600 text-lg">trending_up</span>
                                        <span className="text-green-600 font-bold">+5%</span>
                                        <span className="text-[#8c785f]">vs semana anterior</span>
                                    </div>
                                </div>

                                {/* Card 3 - Avg Order Value */}
                                <div className="flex flex-col gap-4 rounded-xl p-5 bg-white border border-[#e6e1db] shadow-sm relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[#8c785f] text-sm font-medium">Ticket Promedio</p>
                                            <p className="text-[#181511] text-2xl font-bold">${stats?.avgOrderValue || '0.00'}</p>
                                        </div>
                                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined">stacked_line_chart</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-sm">
                                        <span className="material-symbols-outlined text-red-500 text-lg">trending_down</span>
                                        <span className="text-red-500 font-bold">-2%</span>
                                        <span className="text-[#8c785f]">vs semana anterior</span>
                                    </div>
                                </div>

                                {/* Card 4 - Top Selling */}
                                <div className="flex flex-col gap-4 rounded-xl p-5 bg-white border border-[#e6e1db] shadow-sm relative group">
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[#8c785f] text-sm font-medium">Más Vendido</p>
                                            <p className="text-[#181511] text-lg font-bold truncate">{stats?.topProduct || 'N/A'}</p>
                                        </div>
                                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="material-symbols-outlined">local_pizza</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-sm">
                                        <span className="material-symbols-outlined text-green-600 text-lg">trending_up</span>
                                        <span className="text-green-600 font-bold">+8%</span>
                                        <span className="text-[#8c785f]">popularidad</span>
                                    </div>
                                </div>
                            </div>

                            {/* Charts Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Line Chart */}
                                <div className="lg:col-span-2 rounded-xl border border-[#e6e1db] bg-white p-6 shadow-sm">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <p className="text-[#181511] text-lg font-bold">Ingresos Semanales</p>
                                            <p className="text-[#8c785f] text-sm">Últimos 7 días</p>
                                        </div>
                                        <div className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full">
                                            <span className="material-symbols-outlined text-green-600 text-sm">arrow_upward</span>
                                            <span className="text-green-700 text-sm font-bold">${stats?.weeklySales || '0'}</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-[240px] relative">
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

                                                    // Generate points
                                                    const points = data.map((d, i) => {
                                                        const x = (i / (data.length - 1)) * width;
                                                        const y = height - ((d.amount / maxVal) * usableHeight) - 20; // 20px padding bottom
                                                        return `${x},${y}`;
                                                    }).join(' ');

                                                    const areaPath = `M0,${height} ${points.split(' ').map((p, i) => {
                                                        const [x, y] = p.split(',');
                                                        return i === 0 ? `L${x},${y}` : `L${x},${y}`;
                                                    }).join(' ')} V${height} Z`.replace('M0,240 L', 'M');

                                                    // Simple Polyline for the line
                                                    const linePath = `M${points.replace(/ /g, ' L')}`;

                                                    return (
                                                        <>
                                                            <path d={`${areaPath}`} fill="url(#gradient)"></path>
                                                            <path d={linePath} fill="none" stroke="#f7951d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                                                            {data.map((d, i) => {
                                                                const x = (i / (data.length - 1)) * width;
                                                                const y = height - ((d.amount / maxVal) * usableHeight) - 20;
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
                                            <div className="flex items-center justify-center h-full text-gray-400">
                                                No hay datos diarios disponibles
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between mt-4 text-[#8c785f] text-xs font-bold uppercase tracking-wider">
                                        {stats?.chartData?.map((d, i) => (
                                            <span key={i}>{d.day}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* Bar Chart */}
                                <div className="rounded-xl border border-[#e6e1db] bg-white p-6 shadow-sm flex flex-col">
                                    <p className="text-[#181511] text-lg font-bold mb-1">Ventas por Categoría</p>
                                    <p className="text-[#8c785f] text-sm mb-6">Productos más vendidos</p>
                                    <div className="flex-1 flex items-end justify-between gap-4 px-2">
                                        {stats?.categoryStats && stats.categoryStats.length > 0 ? (
                                            stats.categoryStats.map((cat, index) => {
                                                const opacity = Math.max(0.3, 1 - (index * 0.2));
                                                return (
                                                    <div key={index} className="flex flex-col items-center gap-2 flex-1 group w-full">
                                                        <div className="w-full bg-[#fcead2] rounded-t-lg relative h-40 group-hover:bg-[#fcdab0] transition-colors overflow-hidden flex items-end justify-center">
                                                            <div
                                                                className="w-full rounded-t-lg transition-all duration-1000 ease-out"
                                                                style={{
                                                                    height: `${cat.percentage}%`,
                                                                    backgroundColor: `rgba(247, 149, 29, ${opacity})`
                                                                }}
                                                            ></div>
                                                            <div className="absolute top-2 text-xs font-bold text-[#8c785f] opacity-0 group-hover:opacity-100 transition-opacity text-center w-full px-1">
                                                                {cat.count} vendidos
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-bold text-[#8c785f] text-center truncate w-full" title={cat.name}>{cat.name}</span>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="w-full text-center py-10 text-gray-400">No hay datos de categoría</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Recent Transactions Table */}
                            <div className="rounded-xl border border-[#e6e1db] bg-white shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-[#e6e1db] flex items-center justify-between">
                                    <h3 className="text-[#181511] text-lg font-bold">Transacciones Recientes</h3>
                                    <button className="text-primary text-sm font-bold hover:underline">Ver Todo</button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-[#fcfbf9] text-[#8c785f] text-xs uppercase tracking-wider">
                                                <th className="px-6 py-4 font-bold">ID Orden</th>
                                                <th className="px-6 py-4 font-bold">Hora</th>
                                                <th className="px-6 py-4 font-bold">Artículos</th>
                                                <th className="px-6 py-4 font-bold">Monto</th>
                                                <th className="px-6 py-4 font-bold text-center">Estado</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#e6e1db]">
                                            {transactions.length > 0 ? (
                                                transactions.map((transaction) => (
                                                    <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 text-sm font-bold text-[#181511]">{transaction.id}</td>
                                                        <td className="px-6 py-4 text-sm text-[#8c785f]">{transaction.time}</td>
                                                        <td className="px-6 py-4 text-sm text-[#181511]">{transaction.items}</td>
                                                        <td className="px-6 py-4 text-sm font-bold text-[#181511]">{transaction.amount}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(transaction.status)}`}>
                                                                {getStatusLabel(transaction.status)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-8 text-center text-[#8c785f]">
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
