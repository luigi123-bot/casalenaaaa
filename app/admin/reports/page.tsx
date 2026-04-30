'use client';

import Link from 'next/link';

export default function ReportsDashboard() {
    const reportTypes = [
        {
            name: 'Reporte de Ventas',
            description: 'Historial detallado de transacciones, filtros por cajero, categoría y métodos de pago.',
            href: '/admin/reports/sales',
            icon: 'payments',
            color: 'bg-green-500'
        },
        {
            name: 'Analítica de Productos',
            description: 'Rendimiento de productos, tendencias de ventas y productos más populares.',
            href: '/admin/reports/insights',
            icon: 'insights',
            color: 'bg-blue-500'
        },
        {
            name: 'Estrategia con IA',
            description: 'Consultoría estratégica generada por IA basada en tus datos de ventas y costos.',
            href: '/admin/reports/ai',
            icon: 'psychology',
            color: 'bg-purple-500'
        },
        {
            name: 'Cierres de Caja',
            description: 'Informes de cierres de turno, arqueo de caja y diferencias.',
            href: '/admin/cierres',
            icon: 'account_balance_wallet',
            color: 'bg-orange-500'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {reportTypes.map((report) => (
                <Link 
                    key={report.href} 
                    href={report.href}
                    className="group bg-white p-8 rounded-3xl border border-[#e6e1db] shadow-sm hover:shadow-xl hover:border-black transition-all"
                >
                    <div className={`size-14 ${report.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                        <span className="material-symbols-outlined text-3xl">{report.icon}</span>
                    </div>
                    <h3 className="text-xl font-black text-[#181511] mb-2">{report.name}</h3>
                    <p className="text-[#8c785f] text-sm leading-relaxed mb-6">
                        {report.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#181511]">
                        Explorar Reporte
                        <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
                    </div>
                </Link>
            ))}
            
            {/* Quick Stats Placeholder or Info Card */}
            <div className="md:col-span-2 lg:col-span-3 bg-[#181511] p-8 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
                <div className="relative z-10">
                    <h2 className="text-2xl font-black mb-2">Toma decisiones basadas en datos</h2>
                    <p className="text-gray-400 text-sm max-w-md">
                        Utiliza las herramientas de analítica para identificar tus productos estrella, optimizar tus horarios de mayor venta y mejorar la rentabilidad de tu negocio.
                    </p>
                </div>
                <div className="relative z-10 flex gap-4">
                    <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
                        <p className="text-xs font-bold text-orange-400 uppercase tracking-tighter mb-1">Optimización</p>
                        <p className="text-2xl font-black">100%</p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 text-center">
                        <p className="text-xs font-bold text-blue-400 uppercase tracking-tighter mb-1">Eficiencia</p>
                        <p className="text-2xl font-black">Alta</p>
                    </div>
                </div>
                {/* Decorative background element */}
                <div className="absolute -right-10 -bottom-10 size-64 bg-orange-500/20 blur-3xl rounded-full"></div>
            </div>
        </div>
    );
}
