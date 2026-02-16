'use client';

import React, { useEffect, useState } from 'react';

export interface TicketData {
    comercio: {
        nombre: string;
        telefono: string;
        direccion: string;
    };
    pedido: {
        id: string;
        tipo: string;
        mesa?: string;
        subtotal: number;
        total: number;
        metodo_pago: string;
        pago_con?: number;
        cambio?: number;
    };
    productos: Array<{
        cantidad: number;
        nombre: string;
        precio: number;
        detalle?: string;
    }>;
}

interface Ticket58mmProps {
    data: TicketData;
}

const Ticket58mm: React.FC<Ticket58mmProps> = ({ data }) => {
    const [mounted, setMounted] = useState(false);
    const [dateStr, setDateStr] = useState('');
    const [timeStr, setTimeStr] = useState('');

    useEffect(() => {
        setMounted(true);
        const now = new Date();

        // Format Date
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        setDateStr(`${day}/${month}/${year}`);

        // Format Time
        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
        hours = hours % 12;
        hours = hours ? hours : 12;
        setTimeStr(`${String(hours).padStart(2, '0')}:${minutes} ${ampm}`);
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2
        }).format(amount);
    };

    if (!mounted) return null;

    return (
        <div className="w-full bg-white text-black font-sans text-[10px] leading-tight mx-auto p-1 flex flex-col shadow-sm">
            {/* Global style removed - handled by TicketPrintModal */}

            {/* 1. ENCABEZADO */}
            <div className="flex flex-col items-center mb-2">
                <h1 className="font-bold text-sm uppercase tracking-wider text-center break-words w-full">
                    {data.comercio.nombre}
                </h1>
                <p className="text-center mt-1 text-[9px] w-full break-words">{data.comercio.direccion}</p>
                <p className="text-center text-[9px]">{data.comercio.telefono}</p>
            </div>

            {/* 2. Separador */}
            <div className="border-t-[1px] border-black border-dashed my-1 w-full"></div>

            {/* 3. FECHA Y HORA */}
            <div className="flex justify-between w-full text-[9px]">
                <span>Fecha: {dateStr}</span>
                <span>{timeStr}</span>
            </div>

            {/* 4. TIPO DE PEDIDO */}
            <div className="text-center font-bold text-xs uppercase my-2">
                {data.pedido.tipo}
            </div>

            {/* 5. MESA (si existe) */}
            {data.pedido.mesa && (
                <>
                    <div className="border-t-[1px] border-black border-dashed my-1 w-full"></div>
                    <div className="text-center font-bold text-xl my-1 uppercase">
                        MESA: {data.pedido.mesa}
                    </div>
                    <div className="border-t-[1px] border-black border-dashed my-1 w-full"></div>
                </>
            )}

            {/* 6. NÚMERO DE PEDIDO */}
            <div className="text-center font-bold text-2xl my-2">
                #{data.pedido.id.padStart(5, '0')}
            </div>

            {/* 7. Separador punteado */}
            <div className="border-t-[1px] border-black border-dashed my-1 w-full"></div>

            {/* 8. ENCABEZADO DE PRODUCTOS */}
            <div className="grid grid-cols-[20px_1fr_45px] gap-1 font-bold mb-1 text-[9px]">
                <div className="text-left">Ct</div>
                <div className="text-left">Producto</div>
                <div className="text-right">Total</div>
            </div>

            {/* 9. LISTA DE PRODUCTOS */}
            <div className="flex flex-col gap-1">
                {data.productos.map((prod, idx) => (
                    <div key={idx} className="grid grid-cols-[20px_1fr_45px] gap-1 items-start text-[10px]">
                        <div className="text-left">{prod.cantidad}</div>
                        <div className="text-left flex flex-col leading-tight">
                            <span className="uppercase">{prod.nombre}</span>
                            {prod.detalle && (
                                <span className="text-[9px] text-gray-500 font-normal">
                                    ({prod.detalle})
                                </span>
                            )}
                        </div>
                        <div className="text-right whitespace-nowrap">
                            {formatCurrency(prod.precio * prod.cantidad)}
                        </div>
                    </div>
                ))}
            </div>

            {/* 10. Separador punteado */}
            <div className="border-t-[1px] border-black border-dashed my-2 w-full"></div>

            {/* 11. TOTALES */}
            <div className="flex flex-col gap-1 text-[10px]">
                <div className="flex justify-between">
                    <span>SUBTOTAL</span>
                    <span>{formatCurrency(data.pedido.subtotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs mt-1">
                    <span>TOTAL</span>
                    <span>{formatCurrency(data.pedido.total)}</span>
                </div>
            </div>

            {/* 12. MÉTODO DE PAGO */}
            <div className="mt-3 mb-1 text-center uppercase font-bold text-[10px]">
                PAGO: {data.pedido.metodo_pago}
            </div>

            {data.pedido.metodo_pago.toUpperCase() === 'EFECTIVO' && (
                <div className="flex flex-col gap-1 text-[10px]">
                    <div className="flex justify-between">
                        <span>RECIBIDO:</span>
                        <span>{formatCurrency(data.pedido.pago_con || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>CAMBIO:</span>
                        <span>{formatCurrency(data.pedido.cambio || 0)}</span>
                    </div>
                </div>
            )}

            {/* 13. Separador punteado */}
            <div className="border-t-[1px] border-black border-dashed my-2 w-full"></div>

            {/* 14. NOTAS */}
            <div className="flex flex-col my-1">
                <span className="mb-1 font-bold text-[10px]">NOTAS:</span>
                <div className="w-full h-12 border border-black"></div>
            </div>

            {/* 15. Separador punteado */}
            <div className="border-t-[1px] border-black border-dashed my-2 w-full"></div>

            {/* 16. PIE */}
            <div className="text-center pb-4">
                <p className="font-bold text-sm">¡GRACIAS POR SU COMPRA!</p>
                <p className="mt-1 text-[10px]">Vuelva pronto</p>
            </div>
        </div>
    );
};

export default Ticket58mm;
