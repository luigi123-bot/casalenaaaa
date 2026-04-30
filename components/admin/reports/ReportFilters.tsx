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

    return (
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
                            {['card', 'cash', 'online'].map((method) => (
                                <label key={method} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e6e1db] px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                    <input
                                        type="checkbox"
                                        checked={(paymentMethods as any)[method]}
                                        onChange={(e) => setPaymentMethods((prev: any) => ({ ...prev, [method]: e.target.checked }))}
                                        className="size-4 accent-primary rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium capitalize">{method === 'online' ? 'En Línea' : method === 'card' ? 'Tarjeta' : 'Efectivo'}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

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

                    {isFiltered && (
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

                    {hasData && (
                        <button
                            onClick={onExport}
                            className="px-6 py-3 bg-white border border-[#e6e1db] text-[#181511] font-bold rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2 group w-full md:w-auto justify-center"
                        >
                            <span className="material-symbols-outlined group-hover:scale-110 transition-transform">download</span>
                            Exportar CSV
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
