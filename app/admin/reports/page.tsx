'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';

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

    // Filters State
    const [categories, setCategories] = useState<any[]>([]);
    const [cashiers, setCashiers] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedCashier, setSelectedCashier] = useState('all');
    const [paymentMethods, setPaymentMethods] = useState({
        card: true,
        cash: true,
        online: true
    });

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

            // Add Filters
            if (selectedCashier !== 'all') params.append('cashierId', selectedCashier);
            if (selectedCategory !== 'all') params.append('categoryId', selectedCategory);

            const methods = [];
            if (paymentMethods.card) methods.push('tarjeta');
            if (paymentMethods.cash) methods.push('efectivo');
            if (paymentMethods.online) methods.push('online'); // or 'en_linea' depending on DB value?
            // Let's assume 'tarjeta', 'efectivo', 'online' match DB. 
            // If DB uses 'credit_card', mapped logic is needed. Assuming simplistics for now.

            // Only filter by payment method if NOT all are selected (to include nulls/others if 'all' is desired)
            const allSelected = paymentMethods.card && paymentMethods.cash && paymentMethods.online;
            if (!allSelected && methods.length > 0) {
                params.append('paymentMethods', methods.join(','));
            } else if (methods.length === 0) {
                // specific case: if nothing selected, maybe show nothing? or show all? 
                // Let's assume user wants to see nothing if they uncheck everything, 
                // BUT preventing empty result is friendlier. Let's send a standard 'none' or just handle empty.
                // If we send nothing, API might return all. 
                // If users uncheck all, they usually expect 0 results.
                if (!allSelected) params.append('paymentMethods', 'none');
            }

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

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            // Fetch Categories
            const { data: cats } = await supabase.from('categories').select('*');
            if (cats) setCategories(cats);

            // Fetch Staff (Cashiers/Waiters from usuarios or custom query)
            // Assuming 'usuarios' table holds users. 
            // If you don't have roles, we fetch all. If you have roles, filter.
            // Let's try fetching all for now or filter by role if possible.
            const { data: users } = await supabase.from('usuarios').select('id, full_name, role');
            if (users) {
                // Filter if roles exist, otherwise show all
                const staff = users.filter(u => ['admin', 'cajero', 'mesero'].includes(u.role || '') || !u.role);
                setCashiers(staff.length ? staff : users);
            }
        };
        fetchData();
    }, []);

    // Filter Effect
    useEffect(() => {
        generateReport();
    }, [startDate, endDate, selectedCategory, selectedCashier, paymentMethods]);

    const exportToCSV = () => {
        if (reportData.length === 0) return;

        // --- Calculate Summaries ---
        const totalSales = reportData.reduce((sum, item) => sum + item.amount, 0);
        const totalTransactions = reportData.length;
        const averageTicket = totalTransactions ? (totalSales / totalTransactions) : 0;

        // Payment Method Breakdown
        const payMethods: Record<string, number> = {};
        reportData.forEach(r => {
            const method = r.payment_method || 'Desconocido';
            payMethods[method] = (payMethods[method] || 0) + r.amount;
        });

        // Status Breakdown
        const statusCounts: Record<string, number> = {};
        reportData.forEach(r => {
            const status = r.status || 'Desconocido';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });

        // --- meaningful CSV Construction ---
        // Using array of arrays to handle rows, then joining.
        const rows: string[][] = [];

        // 1. Title & Date
        rows.push(['REPORTE DE VENTAS - CASALENA']);
        rows.push([`Generado el: ${new Date().toLocaleString()}`]);
        rows.push([`Periodo: ${startDate || 'Inicio'} a ${endDate || 'Fin'}`]);
        rows.push([]); // Empty line

        // 2. Main KPIs
        rows.push(['RESUMEN GENERAL']);
        rows.push(['Ventas Totales', 'Transacciones', 'Ticket Promedio']);
        rows.push([
            totalSales.toFixed(2),
            totalTransactions.toString(),
            averageTicket.toFixed(2)
        ]);
        rows.push([]);

        // 3. Payment Method Breakdown
        rows.push(['DESGLOSE POR MÉTODO DE PAGO']);
        rows.push(['Método', 'Total Vendido']);
        Object.entries(payMethods).forEach(([method, amount]) => {
            rows.push([method.toUpperCase(), amount.toFixed(2)]);
        });
        rows.push([]);

        // 4. Status Breakdown
        rows.push(['ESTADO DE ÓRDENES']);
        rows.push(['Estado', 'Cantidad']);
        Object.entries(statusCounts).forEach(([status, count]) => {
            rows.push([status.toUpperCase(), count.toString()]);
        });
        rows.push([]);
        rows.push(['--------------------------------------------------']);
        rows.push([]);

        // 5. Detailed Data Table
        rows.push(['DETALLE DE TRANSACCIONES']);
        const headers = ['ID Orden', 'Fecha', 'Hora', 'Artículos', 'Monto', 'Estado', 'Método de Pago'];
        rows.push(headers);

        reportData.forEach(row => {
            rows.push([
                row.id.toString(),
                row.date,
                row.time,
                row.items,
                row.amount.toFixed(2),
                row.status,
                row.payment_method
            ]);
        });

        // Convert to CSV String (Robust with quoting)
        const csvContent = rows.map(r =>
            r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')
        ).join('\n');

        // Download
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_ventas_${startDate || 'completo'}_${endDate || 'completo'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'completado':
            case 'entregado': return 'bg-green-100 text-green-800'; // Added entregado usually used
            case 'pendiente': return 'bg-yellow-100 text-yellow-800';
            case 'en_preparacion':
            case 'preparando': return 'bg-blue-100 text-blue-800';
            case 'cancelado': return 'bg-red-100 text-red-800';
            case 'listo': return 'bg-purple-100 text-purple-800';
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
                                    <select
                                        value={selectedCategory}
                                        onChange={(e) => setSelectedCategory(e.target.value)}
                                        className="w-full appearance-none rounded-xl border border-[#e6e1db] bg-white px-4 py-3 text-sm font-medium text-[#181511] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="all">Todas las Categorías</option>
                                        {categories.map((cat) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-3 text-[#8c785f] pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            {/* Cashier Filter */}
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-sm font-bold text-[#181511]">Cajero</label>
                                <div className="relative">
                                    <select
                                        value={selectedCashier}
                                        onChange={(e) => setSelectedCashier(e.target.value)}
                                        className="w-full appearance-none rounded-xl border border-[#e6e1db] bg-white px-4 py-3 text-sm font-medium text-[#181511] focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                                    >
                                        <option value="all">Todo el Personal</option>
                                        {cashiers.map((user) => (
                                            <option key={user.id} value={user.id}>{user.full_name || user.email || 'Sin nombre'}</option>
                                        ))}
                                    </select>
                                    <span className="material-symbols-outlined absolute right-3 top-3 text-[#8c785f] pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            {/* Payment Type Filter */}
                            <div className="flex flex-col gap-2 flex-1">
                                <label className="text-sm font-bold text-[#181511]">Tipo de Pago</label>
                                <div className="flex flex-wrap gap-2">
                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e6e1db] px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input
                                            type="checkbox"
                                            checked={paymentMethods.card}
                                            onChange={(e) => setPaymentMethods(prev => ({ ...prev, card: e.target.checked }))}
                                            className="size-4 accent-primary rounded border-gray-300"
                                        />
                                        <span className="text-sm font-medium">Tarjeta</span>
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e6e1db] px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input
                                            type="checkbox"
                                            checked={paymentMethods.cash}
                                            onChange={(e) => setPaymentMethods(prev => ({ ...prev, cash: e.target.checked }))}
                                            className="size-4 accent-primary rounded border-gray-300"
                                        />
                                        <span className="text-sm font-medium">Efectivo</span>
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e6e1db] px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input
                                            type="checkbox"
                                            checked={paymentMethods.online}
                                            onChange={(e) => setPaymentMethods(prev => ({ ...prev, online: e.target.checked }))}
                                            className="size-4 accent-primary rounded border-gray-300"
                                        />
                                        <span className="text-sm font-medium">En Línea</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-end gap-4 pt-4 border-t border-[#e6e1db]">
                            <div className="flex items-center gap-2 text-sm text-[#8c785f] mr-auto">
                                {loading && (
                                    <>
                                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                        Actualizando...
                                    </>
                                )}
                            </div>

                            {(startDate || endDate || selectedCategory !== 'all' || selectedCashier !== 'all' || !paymentMethods.card || !paymentMethods.cash || !paymentMethods.online) && (
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setSelectedCategory('all');
                                        setSelectedCashier('all');
                                        setPaymentMethods({ card: true, cash: true, online: true });
                                    }}
                                    className="px-4 py-3 bg-white border border-[#e6e1db] text-[#8c785f] font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined">filter_alt_off</span>
                                    Limpiar Filtros
                                </button>
                            )}

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
                        <p>No se encontraron resultados con los filtros seleccionados.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
