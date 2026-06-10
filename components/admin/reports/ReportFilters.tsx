'use client';

import { useState } from 'react';

interface ReportFiltersProps {
    startDate: string;
    setStartDate: (val: string) => void;
    endDate: string;
    setEndDate: (val: string) => void;
    categories: any[];
    selectedCategory: string;
    setSelectedCategory: (val: string) => void;
    cashiers: any[];
    selectedCashier: string;
    setSelectedCashier: (val: string) => void;
    paymentMethods: {
        card: boolean;
        cash: boolean;
        online: boolean;
    };
    setPaymentMethods: (val: any) => void;
    loading: boolean;
    onExport: () => void;
    hasData: boolean;
}

export default function ReportFilters({
    startDate, setStartDate,
    endDate, setEndDate,
    categories, selectedCategory, setSelectedCategory,
    cashiers, selectedCashier, setSelectedCashier,
    paymentMethods, setPaymentMethods,
    loading, onExport, hasData
}: ReportFiltersProps) {

    const isFiltered = startDate || endDate || selectedCategory !== 'all' || selectedCashier !== 'all' || !paymentMethods.card || !paymentMethods.cash || !paymentMethods.online;

    const handleQuickRange = (range: 'today' | 'yesterday' | 'week' | 'month' | 'last30') => {
        const now = new Date();
        const formatDate = (date: Date) => {
            const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
            const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 10);
            return localISOTime;
        };

        let start = new Date();
        let end = new Date();

        switch (range) {
            case 'today':
                start = now;
                end = now;
                break;
            case 'yesterday':
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);
                start = yesterday;
                end = yesterday;
                break;
            case 'week':
                const dayOfWeek = now.getDay();
                // Set start date to Monday of current week
                const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const monday = new Date(now);
                monday.setDate(now.getDate() + distanceToMonday);
                start = monday;
                end = new Date();
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'last30':
                const prev = new Date();
                prev.setDate(now.getDate() - 30);
                start = prev;
                end = new Date();
                break;
        }

        setStartDate(formatDate(start));
        setEndDate(formatDate(end));
    };

    return (
        <div className="bg-white rounded-3xl border border-[#e6e1db] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col gap-6">
                
                {/* Upper Row: Date Range & Quick Buttons */}
                <div className="space-y-4 border-b border-[#e6e1db]/80 pb-6">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">calendar_month</span>
                            Rango de Fechas
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {([
                                { key: 'today', label: 'Hoy' },
                                { key: 'yesterday', label: 'Ayer' },
                                { key: 'week', label: 'Semana' },
                                { key: 'month', label: 'Mes' },
                                { key: 'last30', label: '30 Días' }
                            ] as const).map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => handleQuickRange(key)}
                                    className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight bg-gray-50 border border-gray-200 text-gray-500 hover:bg-[#F27405]/10 hover:border-[#F27405] hover:text-[#F27405] transition-all"
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-[11px] font-black text-[#8c785f] uppercase tracking-wider">Fecha Inicio</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-4 py-3 rounded-2xl border-2 border-gray-100 bg-[#f8f7f5] text-[#181511] font-bold focus:border-[#F27405] focus:bg-white outline-none w-full transition-all text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-[11px] font-black text-[#8c785f] uppercase tracking-wider">Fecha Fin</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-4 py-3 rounded-2xl border-2 border-gray-100 bg-[#f8f7f5] text-[#181511] font-bold focus:border-[#F27405] focus:bg-white outline-none w-full transition-all text-sm"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Lower Row: Advanced Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Category Filter */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-black text-[#8c785f] uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">category</span>
                            Categoría
                        </label>
                        <div className="relative">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full appearance-none rounded-2xl border-2 border-gray-100 bg-[#f8f7f5] px-4 py-3 text-sm font-bold text-[#181511] focus:border-[#F27405] focus:bg-white outline-none transition-all"
                            >
                                <option value="all">Todas las Categorías</option>
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-3.5 text-[#8c785f] pointer-events-none">expand_more</span>
                        </div>
                    </div>

                    {/* Cashier Filter */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-black text-[#8c785f] uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">person</span>
                            Cajero / Atendido por
                        </label>
                        <div className="relative">
                            <select
                                value={selectedCashier}
                                onChange={(e) => setSelectedCashier(e.target.value)}
                                className="w-full appearance-none rounded-2xl border-2 border-gray-100 bg-[#f8f7f5] px-4 py-3 text-sm font-bold text-[#181511] focus:border-[#F27405] focus:bg-white outline-none transition-all"
                            >
                                <option value="all">Todo el Personal</option>
                                {cashiers.map((user) => (
                                    <option key={user.id} value={user.id}>{user.full_name || user.email || 'Sin nombre'}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-4 top-3.5 text-[#8c785f] pointer-events-none">expand_more</span>
                        </div>
                    </div>

                    {/* Payment Type Filter */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-black text-[#8c785f] uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">credit_card</span>
                            Métodos de Pago
                        </label>
                        <div className="flex gap-2 h-full items-center">
                            {['card', 'cash', 'online'].map((method) => {
                                const checked = (paymentMethods as any)[method];
                                return (
                                    <label 
                                        key={method} 
                                        className={`flex-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-2xl border-2 px-3 py-3 select-none transition-all ${
                                            checked 
                                                ? 'border-[#F27405] bg-orange-50/30 text-[#F27405]' 
                                                : 'border-gray-100 bg-[#f8f7f5] text-gray-500 hover:border-gray-200'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={(e) => setPaymentMethods((prev: any) => ({ ...prev, [method]: e.target.checked }))}
                                            className="hidden"
                                        />
                                        <span className="material-symbols-outlined text-sm">
                                            {method === 'online' ? 'language' : method === 'card' ? 'credit_card' : 'payments'}
                                        </span>
                                        <span className="text-[11px] font-black uppercase tracking-tighter">
                                            {method === 'online' ? 'Línea' : method === 'card' ? 'Tarjeta' : 'Efectivo'}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Actions Row */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-[#e6e1db]/80">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                        {loading && (
                            <>
                                <span className="material-symbols-outlined animate-spin text-base text-[#F27405]">progress_activity</span>
                                Actualizando datos en tiempo real...
                            </>
                        )}
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                        {isFiltered && (
                            <button
                                onClick={() => {
                                    setStartDate('');
                                    setEndDate('');
                                    setSelectedCategory('all');
                                    setSelectedCashier('all');
                                    setPaymentMethods({ card: true, cash: true, online: true });
                                }}
                                className="flex-1 sm:flex-initial px-4 py-3 bg-white border border-[#e6e1db] text-[#8c785f] hover:text-[#181511] font-bold rounded-2xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
                            >
                                <span className="material-symbols-outlined text-base">filter_alt_off</span>
                                Limpiar Filtros
                            </button>
                        )}

                        {hasData && (
                            <button
                                onClick={onExport}
                                className="flex-1 sm:flex-initial px-6 py-3 bg-[#181511] text-white font-black rounded-2xl hover:bg-black transition-colors flex items-center justify-center gap-2 group text-xs uppercase tracking-wider shadow-lg shadow-black/10"
                            >
                                <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform">download</span>
                                Exportar CSV
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
