'use client';

interface ReportData {
    id: number;
    date: string;
    time: string;
    items: string;
    amount: number;
    status: string;
    payment_method: string;
}

interface ReportTableProps {
    data: ReportData[];
    getStatusBadgeClass: (status: string) => string;
}

export default function ReportTable({ data, getStatusBadgeClass }: ReportTableProps) {
    return (
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
                        {data.map((row) => (
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
    );
}
