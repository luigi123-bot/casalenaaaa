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
}

export default function ReportTable({ data }: ReportTableProps) {
    if (!data || data.length === 0) {
        return (
            <div className="bg-white rounded-3xl border border-[#e6e1db] p-16 text-center shadow-sm">
                <div className="size-20 bg-gray-50 text-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                    <span className="material-symbols-outlined text-4xl">analytics</span>
                </div>
                <h3 className="text-xl font-black text-[#181511] mb-2">No hay datos para mostrar</h3>
                <p className="text-[#8c785f] text-sm max-w-xs mx-auto">
                    No se encontraron registros para los filtros seleccionados. Intenta ajustando las fechas o categorías.
                </p>
            </div>
        );
    }

    const getStatusPill = (status: string) => {
        const s = status.toLowerCase();
        let classes = 'bg-gray-50 text-gray-500 border-gray-200/80';
        let icon = 'help';
        let label = status;

        if (s === 'completado' || s === 'entregado') {
            classes = 'bg-green-50 text-green-700 border-green-200/80';
            icon = 'check_circle';
            label = 'Completado';
        } else if (s === 'pendiente') {
            classes = 'bg-amber-50 text-amber-700 border-amber-200/80';
            icon = 'schedule';
            label = 'Pendiente';
        } else if (s === 'preparando' || s === 'en_preparacion') {
            classes = 'bg-blue-50 text-blue-700 border-blue-200/80';
            icon = 'restaurant';
            label = 'Cocinando';
        } else if (s === 'listo') {
            classes = 'bg-purple-50 text-purple-700 border-purple-200/80';
            icon = 'delivery_dining';
            label = 'Listo';
        } else if (s === 'cancelado') {
            classes = 'bg-red-50 text-red-700 border-red-200/80';
            icon = 'cancel';
            label = 'Cancelado';
        }

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border ${classes}`}>
                <span className="material-symbols-outlined text-xs">{icon}</span>
                {label}
            </span>
        );
    };

    const getPaymentMethodBadge = (method: string) => {
        const m = method.toLowerCase();
        let icon = 'payments';
        let label = method;
        let color = 'text-green-600 bg-green-50 border-green-100';

        if (m === 'tarjeta' || m === 'card') {
            icon = 'credit_card';
            label = 'Tarjeta';
            color = 'text-blue-600 bg-blue-50 border-blue-100';
        } else if (m === 'online' || m === 'en linea' || m === 'en línea') {
            icon = 'language';
            label = 'En Línea';
            color = 'text-purple-600 bg-purple-50 border-purple-100';
        } else if (m === 'efectivo' || m === 'cash') {
            icon = 'payments';
            label = 'Efectivo';
            color = 'text-emerald-600 bg-emerald-50 border-emerald-100';
        }

        return (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight border ${color}`}>
                <span className="material-symbols-outlined text-xs">{icon}</span>
                {label}
            </span>
        );
    };

    return (
        <div className="bg-white rounded-3xl border border-[#e6e1db] shadow-sm overflow-hidden animate-in fade-in duration-500">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#fcfbf9] text-[#8c785f] text-[10px] uppercase tracking-widest border-b border-[#e6e1db]">
                            <th className="px-6 py-5 font-black">ID</th>
                            <th className="px-6 py-5 font-black">Fecha y Hora</th>
                            <th className="px-6 py-5 font-black">Artículos</th>
                            <th className="px-6 py-5 font-black">Monto</th>
                            <th className="px-6 py-5 font-black">Pago</th>
                            <th className="px-6 py-5 font-black text-center">Estado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e6e1db] text-sm">
                        {data.map((row) => (
                            <tr key={row.id} className="hover:bg-orange-50/10 transition-colors">
                                <td className="px-6 py-4 font-black text-[#181511]">#{row.id}</td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-[#181511]">{row.date}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{row.time}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-[#181511] max-w-xs truncate font-medium" title={row.items}>
                                    {row.items}
                                </td>
                                <td className="px-6 py-4 font-black text-[#181511] text-base">
                                    ${row.amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4">
                                    {getPaymentMethodBadge(row.payment_method)}
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {getStatusPill(row.status)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="bg-[#fcfbf9] border-t border-[#e6e1db] px-6 py-4 flex items-center justify-between text-xs font-bold text-gray-400">
                <span>Mostrando {data.length} transacción{data.length !== 1 ? 'es' : ''}</span>
                <span className="text-[#8c785f]">{data.length > 0 ? 'Fin del listado' : ''}</span>
            </div>
        </div>
    );
}
