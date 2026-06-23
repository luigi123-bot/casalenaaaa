'use client';

interface ReportSummaryProps {
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
}

export default function ReportSummary({ totalSales, transactionCount, averageTicket }: ReportSummaryProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Sales Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#e6e1db] shadow-sm flex items-center justify-between group hover:shadow-md transition-shadow">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ventas del Período</p>
                    <p className="text-2xl font-black text-[#F27405] tracking-tight">
                        ${totalSales.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-green-600 font-bold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">trending_up</span> Ingresos brutos
                    </p>
                </div>
                <div className="size-12 bg-orange-50 rounded-2xl flex items-center justify-center text-[#F27405] group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">payments</span>
                </div>
            </div>

            {/* Transactions Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#e6e1db] shadow-sm flex items-center justify-between group hover:shadow-md transition-shadow">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Transacciones</p>
                    <p className="text-2xl font-black text-[#181511] tracking-tight">
                        {transactionCount.toLocaleString('es-MX')}
                    </p>
                    <p className="text-[10px] text-blue-600 font-bold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">receipt_long</span> Pedidos procesados
                    </p>
                </div>
                <div className="size-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">receipt</span>
                </div>
            </div>

            {/* Average Ticket Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#e6e1db] shadow-sm flex items-center justify-between group hover:shadow-md transition-shadow">
                <div className="space-y-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ticket Promedio</p>
                    <p className="text-2xl font-black text-green-600 tracking-tight">
                        ${averageTicket.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-green-700 font-bold flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-[10px]">analytics</span> Consumo por orden
                    </p>
                </div>
                <div className="size-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 group-hover:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-2xl">monitoring</span>
                </div>
            </div>
        </div>
    );
}
