'use client';

import { useState } from 'react';

interface ReportData {
    id: number;
    date: string;
    time: string;
    items: string;
    amount: number;
    status: string;
    payment_method: string;
}

export default function ReportsPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState<ReportData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const generateReport = async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);

            const res = await fetch(`/api/reports/sales?${params.toString()}`);
            if (!res.ok) throw new Error('Error al obtener datos');

            const data = await res.json();
            setReportData(data);
        } catch (err) {
            console.error(err);
            setError('Error al generar el reporte. Por favor intente de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        if (reportData.length === 0) return;

        const headers = ['ID Orden', 'Fecha', 'Hora', 'Artículos', 'Monto', 'Estado', 'Método de Pago'];
        const csvContent = [
            headers.join(','),
            ...reportData.map(row => [
                row.id,
                row.date,
                row.time,
                `"${row.items.replace(/"/g, '""')}"`, // Escape quotes in items
                row.amount.toFixed(2),
                row.status,
                row.payment_method
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_ventas_${startDate || 'inicio'}_${endDate || 'fin'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'completado': return 'bg-green-100 text-green-800';
            case 'pendiente': return 'bg-yellow-100 text-yellow-800';
            case 'en_preparacion': return 'bg-blue-100 text-blue-800';
            case 'cancelado': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const totalSales = reportData.reduce((sum, item) => sum + item.amount, 0);

    return (
        <main className="flex-1 overflow-y-auto p-8 bg-[#f8f7f5]">
            <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                {/* Header */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-2xl font-bold text-[#181511]">Reportes de Ventas</h1>
                        <p className="text-[#8c785f] text-sm">Genera y exporta reportes detallados de transacciones.</p>
                    </div>
                </div>

                {/* Filters Card */}
                <div className="bg-white p-6 rounded-xl border border-[#e6e1db] shadow-sm">
                    <div className="flex flex-col gap-6">
                        {/* Upper Row: Date Range */}
                        <div className="flex flex-col md:flex-row gap-6 items-end border-b border-[#e6e1db] pb-6">
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-sm font-bold text-[#181511]">Fecha Inicio</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-4 py-3 rounded-xl border border-[#e6e1db] bg-[#f8f7f5] text-[#181511] focus:ring-1 focus:ring-primary outline-none w-full"
                                />
                            </div>
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-sm font-bold text-[#181511]">Fecha Fin</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-4 py-3 rounded-xl border border-[#e6e1db] bg-[#f8f7f5] text-[#181511] focus:ring-1 focus:ring-primary outline-none w-full"
                                />
                            </div>
                        </div>

                        {/* Lower Row: Advanced Filters */}
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Category Filter */}
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-sm font-bold text-[#181511]">Categoría</label>
                                <div className="relative">
                                    <select className="w-full appearance-none rounded-xl border border-[#e6e1db] bg-white px-4 py-3 text-sm font-medium text-[#181511] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                                        <option>Todas las Categorías</option>
                                        <option>Pizzas</option>
                                        <option>Complementos</option>
                                        <option>Bebidas</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-3 text-[#8c785f] pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            {/* Cashier Filter */}
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-sm font-bold text-[#181511]">Cajero</label>
                                <div className="relative">
                                    <select className="w-full appearance-none rounded-xl border border-[#e6e1db] bg-white px-4 py-3 text-sm font-medium text-[#181511] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                                        <option>Todo el Personal</option>
                                        <option>Luis</option>
                                        <option>Maria</option>
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-3 text-[#8c785f] pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            {/* Payment Type Filter */}
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-sm font-bold text-[#181511]">Tipo de Pago</label>
                                <div className="flex flex-wrap gap-2">
                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e6e1db] px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input defaultChecked className="size-4 accent-primary rounded border-gray-300" type="checkbox" />
                                        <span className="text-sm font-medium">Tarjeta</span>
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e6e1db] px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input defaultChecked className="size-4 accent-primary rounded border-gray-300" type="checkbox" />
                                        <span className="text-sm font-medium">Efectivo</span>
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e6e1db] px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input className="size-4 accent-primary rounded border-gray-300" type="checkbox" />
                                        <span className="text-sm font-medium">En Línea</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-4 pt-4 border-t border-[#e6e1db]">
                            <button
                                onClick={generateReport}
                                disabled={loading}
                                className="px-6 py-3 bg-primary text-[#181511] font-bold rounded-xl hover:bg-[#e68a1b] transition-colors disabled:opacity-50 flex items-center gap-2 group w-full md:w-auto justify-center"
                            >
                                {loading ? (
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                ) : (
                                    <span className="material-symbols-outlined group-hover:scale-110 transition-transform">search</span>
                                )}
                                Generar Reporte
                            </button>
                            {reportData.length > 0 && (
                                <button
                                    onClick={exportToCSV}
                                    className="px-6 py-3 bg-white border border-[#e6e1db] text-[#181511] font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 group w-full md:w-auto justify-center"
                                >
                                    <span className="material-symbols-outlined group-hover:scale-110 transition-transform">download</span>
                                    Exportar CSV
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                {reportData.length > 0 && (
                    <div className="flex flex-col gap-6">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-[#e6e1db] shadow-sm">
                                <p className="text-[#8c785f] text-sm font-medium">Ventas Totales en Periodo</p>
                                <p className="text-[#181511] text-2xl font-bold">${totalSales.toFixed(2)}</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e6e1db] shadow-sm">
                                <p className="text-[#8c785f] text-sm font-medium">Total Transacciones</p>
                                <p className="text-[#181511] text-2xl font-bold">{reportData.length}</p>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-[#e6e1db] shadow-sm">
                                <p className="text-[#8c785f] text-sm font-medium">Ticket Promedio</p>
                                <p className="text-[#181511] text-2xl font-bold">
                                    ${reportData.length ? (totalSales / reportData.length).toFixed(2) : '0.00'}
                                </p>
                            </div>
                        </div>

                        {/* Data Table */}
                        <div className="bg-white rounded-xl border border-[#e6e1db] shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-[#fcfbf9] text-[#8c785f] text-xs uppercase tracking-wider border-b border-[#e6e1db]">
                                            <th className="px-6 py-4 font-bold">ID</th>
                                            <th className="px-6 py-4 font-bold">Fecha</th>
                                            <th className="px-6 py-4 font-bold">Items</th>
                                            <th className="px-6 py-4 font-bold">Monto</th>
                                            <th className="px-6 py-4 font-bold">Pago</th>
                                            <th className="px-6 py-4 font-bold text-center">Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#e6e1db]">
                                        {reportData.map((row) => (
                                            <tr key={row.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-sm font-bold text-[#181511]">#{row.id}</td>
                                                <td className="px-6 py-4 text-sm text-[#8c785f]">
                                                    {row.date} <span className="text-xs ml-1">{row.time}</span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-[#181511] max-w-xs truncate" title={row.items}>
                                                    {row.items}
                                                </td>
                                                <td className="px-6 py-4 text-sm font-bold text-[#181511]">${row.amount.toFixed(2)}</td>
                                                <td className="px-6 py-4 text-sm text-[#181511] capitalize">{row.payment_method}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass(row.status)}`}>
                                                        {row.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {reportData.length === 0 && !loading && !error && (
                    <div className="text-center py-20 text-[#8c785f]">
                        <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
                        <p>Selecciona un rango de fechas y genera un reporte.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
