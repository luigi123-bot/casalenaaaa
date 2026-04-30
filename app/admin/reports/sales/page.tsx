'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import ReportFilters from '@/components/admin/reports/ReportFilters';
import ReportSummary from '@/components/admin/reports/ReportSummary';
import ReportTable from '@/components/admin/reports/ReportTable';

interface ReportData {
    id: number;
    date: string;
    time: string;
    items: string;
    amount: number;
    status: string;
    payment_method: string;
}

export default function SalesReportPage() {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
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
            if (selectedCashier !== 'all') params.append('cashierId', selectedCashier);
            if (selectedCategory !== 'all') params.append('categoryId', selectedCategory);

            const methods = [];
            if (paymentMethods.card) methods.push('tarjeta');
            if (paymentMethods.cash) methods.push('efectivo');
            if (paymentMethods.online) methods.push('online');

            const allSelected = paymentMethods.card && paymentMethods.cash && paymentMethods.online;
            if (!allSelected && methods.length > 0) {
                params.append('paymentMethods', methods.join(','));
            } else if (!allSelected && methods.length === 0) {
                params.append('paymentMethods', 'none');
            }

            const res = await fetch(`/api/reports/sales?${params.toString()}`);
            if (!res.ok) throw new Error('Error al obtener datos');

            const data = await res.json();
            setReportData(data);
        } catch (err) {
            console.error(err);
            setError('Error al generar el reporte.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            const { data: cats } = await supabase.from('categories').select('*');
            if (cats) setCategories(cats);
            const { data: users } = await supabase.from('usuarios').select('id, full_name, role');
            if (users) {
                const staff = users.filter(u => ['admin', 'cajero', 'mesero'].includes(u.role || '') || !u.role);
                setCashiers(staff.length ? staff : users);
            }
        };
        fetchData();
    }, []);

    useEffect(() => {
        generateReport();
    }, [startDate, endDate, selectedCategory, selectedCashier, paymentMethods]);

    const exportToCSV = () => {
        if (reportData.length === 0) return;
        const totalSales = reportData.reduce((sum, item) => sum + item.amount, 0);
        const rows: string[][] = [
            ['REPORTE DE VENTAS - CASALEÑA'],
            [`Generado el: ${new Date().toLocaleString()}`],
            [`Periodo: ${startDate || 'Inicio'} a ${endDate || 'Fin'}`],
            [],
            ['RESUMEN GENERAL'],
            ['Ventas Totales', 'Transacciones', 'Ticket Promedio'],
            [totalSales.toFixed(2), reportData.length.toString(), (totalSales / reportData.length).toFixed(2)],
            [],
            ['DETALLE DE TRANSACCIONES'],
            ['ID Orden', 'Fecha', 'Hora', 'Artículos', 'Monto', 'Estado', 'Método de Pago']
        ];

        reportData.forEach(row => {
            rows.push([row.id.toString(), row.date, row.time, row.items, row.amount.toFixed(2), row.status, row.payment_method]);
        });

        const csvContent = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `reporte_ventas.csv`);
        link.click();
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'completado':
            case 'entregado': return 'bg-green-100 text-green-800';
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
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            {/* Filters Section */}
            <ReportFilters 
                startDate={startDate} setStartDate={setStartDate}
                endDate={endDate} setEndDate={setEndDate}
                categories={categories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
                cashiers={cashiers} selectedCashier={selectedCashier} setSelectedCashier={setSelectedCashier}
                paymentMethods={paymentMethods} setPaymentMethods={setPaymentMethods}
                loading={loading} onExport={exportToCSV} hasData={reportData.length > 0}
            />

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100">
                    {error}
                </div>
            )}

            {/* Results Section */}
            {reportData.length > 0 ? (
                <div className="flex flex-col gap-6">
                    <ReportSummary 
                        totalSales={totalSales} 
                        transactionCount={reportData.length} 
                        averageTicket={totalSales / reportData.length} 
                    />
                    <ReportTable 
                        data={reportData} 
                        getStatusBadgeClass={getStatusBadgeClass} 
                    />
                </div>
            ) : (
                !loading && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-[#e6e1db] text-[#8c785f]">
                        <span className="material-symbols-outlined text-5xl mb-4 opacity-20">analytics</span>
                        <p className="font-bold">No se encontraron resultados</p>
                        <p className="text-xs">Prueba ajustando los filtros de fecha o categoría.</p>
                    </div>
                )
            )}
        </div>
    );
}
