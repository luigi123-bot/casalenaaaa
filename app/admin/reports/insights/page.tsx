'use client';

import { useState, useEffect, useCallback } from 'react';

// ---- Types ----
interface PizzaRow {
    name: string;
    total: number;
    chica: number;
    grande: number;
    familiar: number;
    otro: number;
}

interface ProductRow {
    name: string;
    count: number;
}

interface InsightsData {
    period: string;
    totalSales: number;
    totalOrders: number;
    pizzaTotal: number;
    pizzaBySize: { chica: number; grande: number; familiar: number; otro: number };
    pizzas: PizzaRow[];
    drinkTotal: number;
    drinks: ProductRow[];
    burgers: ProductRow[];
    combos: ProductRow[];
    desserts: ProductRow[];
    others: ProductRow[];
    top10: ProductRow[];
}

type Period = 'week' | 'month' | 'year' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
    week: 'Esta Semana',
    month: 'Este Mes',
    year: 'Este Año',
    all: 'Todo el Tiempo',
};

// ---- Reusable bar chart row ----
function BarRow({ name, count, max, color = 'bg-orange-500' }: { name: string; count: number; max: number; color?: string }) {
    const pct = max > 0 ? (count / max) * 100 : 0;
    return (
        <div className="grid grid-cols-[1fr_auto] gap-3 items-center group">
            <div className="space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#181511] truncate">{name}</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>
            <span className="text-sm font-black text-[#181511] min-w-[2.5rem] text-right tabular-nums">{count}</span>
        </div>
    );
}

// ---- Section card ----
function Section({ title, icon, badge, badgeColor = 'bg-orange-100 text-orange-700', children }: {
    title: string; icon: string; badge?: string; badgeColor?: string; children: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-3xl border border-[#e6e1db] shadow-sm overflow-hidden">
            <div className="px-7 py-5 border-b border-[#f0ede9] flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-2xl text-[#F27405]">{icon}</span>
                    <h3 className="text-lg font-black text-[#181511]">{title}</h3>
                </div>
                {badge && (
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${badgeColor}`}>
                        {badge}
                    </span>
                )}
            </div>
            <div className="p-7">{children}</div>
        </div>
    );
}

// ---- Empty state ----
function Empty({ label = 'Sin datos en este periodo' }: { label?: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-300">
            <span className="material-symbols-outlined text-5xl">sentiment_dissatisfied</span>
            <p className="text-sm font-bold">{label}</p>
        </div>
    );
}

// ---- Main Page ----
export default function InsightsPage() {
    const [period, setPeriod] = useState<Period>('month');
    const [data, setData] = useState<InsightsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<'pizzas' | 'bebidas' | 'otros' | 'top'>('pizzas');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/insights?period=${period}`);
            if (!res.ok) throw new Error('Error fetching data');
            setData(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ---- KPI helper ----
    const kpi = (label: string, value: string | number, sub?: string, accent = false) => (
        <div className={`rounded-2xl p-5 border flex flex-col gap-1 ${accent ? 'bg-[#181511] border-[#181511]' : 'bg-white border-[#e6e1db]'}`}>
            <p className={`text-[10px] font-black uppercase tracking-widest ${accent ? 'text-orange-400' : 'text-[#8c785f]'}`}>{label}</p>
            <p className={`text-3xl font-black leading-none tabular-nums ${accent ? 'text-white' : 'text-[#181511]'}`}>{value}</p>
            {sub && <p className={`text-xs font-bold mt-1 ${accent ? 'text-gray-400' : 'text-[#8c785f]'}`}>{sub}</p>}
        </div>
    );

    const maxPizza = data?.pizzas[0]?.total || 1;
    const maxDrink = data?.drinks[0]?.count || 1;

    return (
        <main className="flex-1 overflow-y-auto bg-[#f8f7f5]">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-[#f8f7f5]/95 backdrop-blur-sm border-b border-[#e6e1db] px-6 md:px-10 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={() => window.history.back()}
                        className="flex items-center gap-1 text-[#8c785f] hover:text-[#181511] text-xs font-bold mb-1 transition-colors"
                    >
                        <span className="material-symbols-outlined text-base">arrow_back</span>
                        Reportes
                    </button>
                    <h1 className="text-2xl font-black text-[#181511] leading-tight">Analítica de Productos</h1>
                </div>

                {/* Period switcher */}
                <div className="flex gap-1.5 bg-white border border-[#e6e1db] p-1.5 rounded-2xl shadow-sm">
                    {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${period === p
                                ? 'bg-[#F27405] text-white shadow-sm'
                                : 'text-[#8c785f] hover:bg-gray-50'
                                }`}
                        >
                            {PERIOD_LABELS[p]}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-[1300px] mx-auto px-6 md:px-10 py-8 space-y-8">

                {/* KPI Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {kpi('Ingresos Totales', loading ? '—' : `$${data?.totalSales.toFixed(2) ?? '0.00'}`, PERIOD_LABELS[period], true)}
                    {kpi('Órdenes', loading ? '—' : data?.totalOrders ?? 0, 'completadas')}
                    {kpi('Pizzas Vendidas', loading ? '—' : data?.pizzaTotal ?? 0, 'unidades totales')}
                    {kpi('Bebidas Vendidas', loading ? '—' : data?.drinkTotal ?? 0, 'unidades totales')}
                </div>

                {/* Large size badge strip for PIZZA */}
                {!loading && data && (
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: '🍕 Chicas', val: data.pizzaBySize.chica, color: 'border-blue-300 bg-blue-50' },
                            { label: '🍕 Grandes', val: data.pizzaBySize.grande, color: 'border-orange-300 bg-orange-50' },
                            { label: '🍕 Familiares', val: data.pizzaBySize.familiar, color: 'border-purple-300 bg-purple-50' },
                        ].map(s => (
                            <div key={s.label} className={`rounded-2xl border-2 p-5 text-center ${s.color}`}>
                                <p className="text-xs font-black text-gray-500 uppercase tracking-widest mb-1">{s.label}</p>
                                <p className="text-4xl font-black text-[#181511] tabular-nums">{s.val}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Section Nav */}
                <div className="flex gap-2 border-b border-[#e6e1db] pb-0">
                    {[
                        { key: 'pizzas', label: 'Pizzas', icon: 'local_pizza' },
                        { key: 'bebidas', label: 'Bebidas', icon: 'local_bar' },
                        { key: 'otros', label: 'Otros', icon: 'fastfood' },
                        { key: 'top', label: 'Top Global', icon: 'emoji_events' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveSection(tab.key as any)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-black uppercase tracking-wider border-b-2 transition-all -mb-px ${activeSection === tab.key
                                ? 'border-[#F27405] text-[#F27405]'
                                : 'border-transparent text-[#8c785f] hover:text-[#181511]'
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ---- PIZZAS SECTION ---- */}
                {activeSection === 'pizzas' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <Section title="Pizzas por Nombre y Tamaño" icon="local_pizza" badge={`${data?.pizzaTotal ?? 0} total`}>
                            {loading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
                                    ))}
                                </div>
                            ) : data?.pizzas.length ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="text-[10px] font-black text-[#8c785f] uppercase tracking-widest border-b border-[#f0ede9]">
                                                <th className="pb-3 pr-4">Pizza</th>
                                                <th className="pb-3 px-3 text-center">Total</th>
                                                <th className="pb-3 px-3 text-center text-blue-500">Chica</th>
                                                <th className="pb-3 px-3 text-center text-orange-500">Grande</th>
                                                <th className="pb-3 px-3 text-center text-purple-500">Familiar</th>
                                                <th className="pb-3 pl-3 text-center">Barra</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#f5f2ef]">
                                            {data.pizzas.map((p, i) => {
                                                const pct = (p.total / maxPizza) * 100;
                                                return (
                                                    <tr key={p.name} className="hover:bg-orange-50/30 transition-colors group">
                                                        <td className="py-3 pr-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`size-5 flex items-center justify-center rounded-lg text-[10px] font-black shrink-0 ${i === 0 ? 'bg-orange-500 text-white' : i === 1 ? 'bg-slate-700 text-white' : i === 2 ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                                    {i + 1}
                                                                </span>
                                                                <span className="font-bold text-[#181511] whitespace-nowrap">{p.name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3 text-center font-black text-[#181511]">{p.total}</td>
                                                        <td className="py-3 px-3 text-center font-bold text-blue-600">{p.chica || '—'}</td>
                                                        <td className="py-3 px-3 text-center font-bold text-orange-600">{p.grande || '—'}</td>
                                                        <td className="py-3 px-3 text-center font-bold text-purple-600">{p.familiar || '—'}</td>
                                                        <td className="py-3 pl-3 w-32">
                                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-orange-400 rounded-full transition-all duration-700"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-[#e6e1db] bg-[#fcfbf9]">
                                                <td className="py-3 pr-4 font-black text-[#8c785f] text-xs uppercase tracking-wider">TOTAL</td>
                                                <td className="py-3 px-3 text-center font-black text-[#181511]">{data.pizzaTotal}</td>
                                                <td className="py-3 px-3 text-center font-black text-blue-600">{data.pizzaBySize.chica}</td>
                                                <td className="py-3 px-3 text-center font-black text-orange-600">{data.pizzaBySize.grande}</td>
                                                <td className="py-3 px-3 text-center font-black text-purple-600">{data.pizzaBySize.familiar}</td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : <Empty />}
                        </Section>

                        {/* Mini insight card */}
                        {data?.pizzas[0] && (
                            <div className="bg-[#181511] rounded-3xl p-7 text-white flex flex-col md:flex-row items-center justify-between gap-6">
                                <div>
                                    <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-2">⭐ Pizza Estrella del Periodo</p>
                                    <h4 className="text-3xl font-black">{data.pizzas[0].name}</h4>
                                    <p className="text-gray-400 text-sm mt-1">{data.pizzas[0].total} unidades vendidas en {PERIOD_LABELS[period].toLowerCase()}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-3 shrink-0">
                                    {[
                                        { l: 'Chicas', v: data.pizzas[0].chica, c: 'bg-blue-900/50 text-blue-300' },
                                        { l: 'Grandes', v: data.pizzas[0].grande, c: 'bg-orange-900/50 text-orange-300' },
                                        { l: 'Familiares', v: data.pizzas[0].familiar, c: 'bg-purple-900/50 text-purple-300' },
                                    ].map(b => (
                                        <div key={b.l} className={`rounded-2xl p-3 text-center ${b.c}`}>
                                            <p className="text-2xl font-black">{b.v}</p>
                                            <p className="text-[10px] font-bold uppercase">{b.l}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ---- BEBIDAS SECTION ---- */}
                {activeSection === 'bebidas' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <Section
                            title="Bebidas más Vendidas"
                            icon="local_bar"
                            badge={`${data?.drinkTotal ?? 0} total`}
                            badgeColor="bg-blue-100 text-blue-700"
                        >
                            {loading ? (
                                <div className="space-y-4">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                            ) : data?.drinks.length ? (
                                <div className="space-y-5">
                                    {data.drinks.map((d, i) => (
                                        <BarRow key={d.name} name={d.name} count={d.count} max={maxDrink} color="bg-blue-500" />
                                    ))}
                                </div>
                            ) : <Empty label="Sin ventas de bebidas en este periodo" />}
                        </Section>

                        {/* Low rotation alert */}
                        {data?.drinks && data.drinks.length > 3 && (
                            <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-7">
                                <div className="flex items-start gap-4">
                                    <span className="material-symbols-outlined text-3xl text-amber-500 shrink-0 mt-0.5">warning</span>
                                    <div>
                                        <h4 className="font-black text-[#181511] mb-2">💡 Bebidas de Baja Rotación</h4>
                                        <p className="text-sm text-[#8c785f] mb-4">Considera retirar del menú las bebidas con menos de 5 ventas:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {data.drinks.filter(d => d.count < 5).map(d => (
                                                <span key={d.name} className="px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-black text-amber-700">
                                                    {d.name} ({d.count})
                                                </span>
                                            ))}
                                            {data.drinks.filter(d => d.count < 5).length === 0 && (
                                                <span className="text-sm text-green-600 font-bold">✅ ¡Todas tus bebidas tienen buena rotación!</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ---- OTROS SECTION ---- */}
                {activeSection === 'otros' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                        <Section title="Hamburguesas" icon="lunch_dining" badge={`${data?.burgers.reduce((s, b) => s + b.count, 0) ?? 0}`} badgeColor="bg-red-100 text-red-700">
                            {loading ? <div className="h-24 bg-gray-100 rounded-xl animate-pulse" /> :
                                data?.burgers.length ? (
                                    <div className="space-y-4">
                                        {data.burgers.map(b => (
                                            <BarRow key={b.name} name={b.name} count={b.count} max={data.burgers[0].count} color="bg-red-400" />
                                        ))}
                                    </div>
                                ) : <Empty label="Sin datos de hamburguesas" />}
                        </Section>

                        <Section title="Combos" icon="shopping_bag" badge={`${data?.combos.reduce((s, b) => s + b.count, 0) ?? 0}`} badgeColor="bg-green-100 text-green-700">
                            {loading ? <div className="h-24 bg-gray-100 rounded-xl animate-pulse" /> :
                                data?.combos.length ? (
                                    <div className="space-y-4">
                                        {data.combos.map(b => (
                                            <BarRow key={b.name} name={b.name} count={b.count} max={data.combos[0].count} color="bg-green-500" />
                                        ))}
                                    </div>
                                ) : <Empty label="Sin datos de combos" />}
                        </Section>

                        <Section title="Postres y Snacks" icon="cake" badge={`${data?.desserts.reduce((s, b) => s + b.count, 0) ?? 0}`} badgeColor="bg-pink-100 text-pink-700">
                            {loading ? <div className="h-24 bg-gray-100 rounded-xl animate-pulse" /> :
                                data?.desserts.length ? (
                                    <div className="space-y-4">
                                        {data.desserts.map(b => (
                                            <BarRow key={b.name} name={b.name} count={b.count} max={data.desserts[0].count} color="bg-pink-400" />
                                        ))}
                                    </div>
                                ) : <Empty label="Sin datos de postres" />}
                        </Section>

                        <Section title="Otros Productos" icon="category" badge={`${data?.others.reduce((s, b) => s + b.count, 0) ?? 0}`} badgeColor="bg-slate-100 text-slate-600">
                            {loading ? <div className="h-24 bg-gray-100 rounded-xl animate-pulse" /> :
                                data?.others.length ? (
                                    <div className="space-y-4">
                                        {data.others.map(b => (
                                            <BarRow key={b.name} name={b.name} count={b.count} max={data.others[0].count} color="bg-slate-500" />
                                        ))}
                                    </div>
                                ) : <Empty label="Sin datos" />}
                        </Section>
                    </div>
                )}

                {/* ---- TOP GLOBAL ---- */}
                {activeSection === 'top' && (
                    <div className="animate-in fade-in duration-300">
                        <Section title="Top 10 Productos Globales" icon="emoji_events" badge="Todos los tipos">
                            {loading ? (
                                <div className="space-y-4">{[...Array(8)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                            ) : data?.top10.length ? (
                                <div className="space-y-5">
                                    {data.top10.map((p, i) => (
                                        <div key={p.name} className="flex items-center gap-4">
                                            <span className={`size-8 flex items-center justify-center rounded-xl text-xs font-black shrink-0 ${i === 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : i === 1 ? 'bg-slate-700 text-white' : i === 2 ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                {i + 1}
                                            </span>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-sm font-bold text-[#181511]">{p.name}</span>
                                                    <span className="text-sm font-black text-[#181511] tabular-nums">{p.count}</span>
                                                </div>
                                                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-orange-500' : i < 3 ? 'bg-slate-600' : 'bg-gray-400'}`}
                                                        style={{ width: `${(p.count / (data.top10[0]?.count || 1)) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : <Empty />}
                        </Section>
                    </div>
                )}

            </div>
        </main>
    );
}
