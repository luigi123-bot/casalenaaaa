'use client';

interface ReportSummaryProps {
    totalSales: number;
    transactionCount: number;
    averageTicket: number;
}

export default function ReportSummary({ totalSales, transactionCount, averageTicket }: ReportSummaryProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-[#e6e1db] shadow-sm">
                <p className="text-[#8c785f] text-sm font-medium">Ventas Totales en Periodo</p>
                <p className="text-[#181511] text-2xl font-bold">${totalSales.toFixed(2)}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#e6e1db] shadow-sm">
                <p className="text-[#8c785f] text-sm font-medium">Total Transacciones</p>
                <p className="text-[#181511] text-2xl font-bold">{transactionCount}</p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-[#e6e1db] shadow-sm">
                <p className="text-[#8c785f] text-sm font-medium">Ticket Promedio</p>
                <p className="text-[#181511] text-2xl font-bold">
                    ${averageTicket.toFixed(2)}
                </p>
            </div>
        </div>
    );
}
