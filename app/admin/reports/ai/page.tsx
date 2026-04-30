'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

export default function AIReportPage() {
    const [loading, setLoading] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [months, setMonths] = useState(3);

    const generateAIReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/ai-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ months })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Error al generar el análisis');
            }

            const data = await res.json();
            setInsight(data.insight);
        } catch (err: any) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            {/* Header / Intro */}
            <div className="bg-[#181511] p-8 rounded-3xl text-white relative overflow-hidden shadow-xl">
                <div className="relative z-10 max-w-2xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                        <span className="material-symbols-outlined text-xs">bolt</span>
                        Estrategia IA
                    </div>
                    <h1 className="text-3xl font-black mb-4">Consultor Estratégico de IA</h1>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6">
                        Nuestro motor de IA analiza tus datos históricos de ventas, márgenes y categorías para entregarte recomendaciones accionables y detectar oportunidades de crecimiento.
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Periodo de Análisis</label>
                            <select 
                                value={months}
                                onChange={(e) => setMonths(Number(e.target.value))}
                                className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                            >
                                <option value={1} className="bg-[#181511]">Último mes</option>
                                <option value={3} className="bg-[#181511]">Últimos 3 meses</option>
                                <option value={6} className="bg-[#181511]">Últimos 6 meses</option>
                                <option value={12} className="bg-[#181511]">Último año</option>
                            </select>
                        </div>
                        
                        <button
                            onClick={generateAIReport}
                            disabled={loading}
                            className="mt-5 px-8 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 text-white font-black rounded-2xl transition-all shadow-lg flex items-center gap-2 group active:scale-95"
                        >
                            {loading ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                                    ANALIZANDO DATOS...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-lg group-hover:scale-125 transition-transform">neurology</span>
                                    GENERAR ANÁLISIS ESTRATÉGICO
                                </>
                            )}
                        </button>
                    </div>
                </div>
                
                {/* Decorative element */}
                <div className="absolute -right-20 -bottom-20 size-80 bg-orange-500/10 blur-3xl rounded-full"></div>
                <span className="material-symbols-outlined absolute right-10 top-10 text-[120px] text-white/5 pointer-events-none select-none">psychology</span>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-3xl flex items-start gap-4">
                    <span className="material-symbols-outlined text-red-400">warning</span>
                    <div>
                        <p className="font-black text-sm uppercase mb-1">Error de Conexión</p>
                        <p className="text-sm opacity-80">{error}</p>
                    </div>
                </div>
            )}

            {/* Insight Result */}
            {insight ? (
                <div className="bg-white p-8 md:p-12 rounded-[40px] border border-[#e6e1db] shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[#f0ede9]">
                        <div className="size-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center shadow-sm">
                            <span className="material-symbols-outlined">description</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-[#181511]">Informe de Estrategia</h2>
                            <p className="text-[#8c785f] text-xs font-bold uppercase tracking-widest">Generado el {new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                    
                    <div className="prose prose-orange max-w-none 
                        prose-headings:font-black prose-headings:text-[#181511] prose-headings:tracking-tight
                        prose-p:text-[#4a4238] prose-p:leading-relaxed
                        prose-strong:text-[#181511] prose-strong:font-black
                        prose-li:text-[#4a4238]
                        prose-hr:border-[#f0ede9]">
                        <ReactMarkdown>{insight}</ReactMarkdown>
                    </div>
                    
                    <div className="mt-12 pt-8 border-t border-[#f0ede9] flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-2 text-[#8c785f]">
                            <span className="material-symbols-outlined text-sm">verified</span>
                            <span className="text-xs font-bold uppercase tracking-wider">Basado en datos reales de Casaleña POS</span>
                        </div>
                        <button 
                            onClick={() => window.print()}
                            className="px-6 py-2 border border-[#e6e1db] text-[#181511] text-xs font-black uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">print</span>
                            Descargar Informe PDF
                        </button>
                    </div>
                </div>
            ) : (
                !loading && !error && (
                    <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-[#e6e1db]">
                        <div className="size-20 bg-[#fcfbf9] rounded-3xl flex items-center justify-center mx-auto mb-6 text-[#e6e1db]">
                            <span className="material-symbols-outlined text-4xl">rocket_launch</span>
                        </div>
                        <h3 className="text-[#181511] font-black text-lg mb-2">Listo para el análisis</h3>
                        <p className="text-[#8c785f] text-sm max-w-xs mx-auto">
                            Haz clic en el botón superior para procesar tus datos y recibir consejos de crecimiento personalizados.
                        </p>
                    </div>
                )
            )}
        </div>
    );
}
