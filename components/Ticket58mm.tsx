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
    cliente?: {
        nombre: string;
        telefono: string;
        direccion: string;
    };
    productos: Array<{
        cantidad: number;
        nombre: string;
        precio: number;
        detalle?: string;
        extras?: string[]; // Array of extra names like ["Extra Queso", "Orilla Rellena"]
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
        <div className="w-full bg-white text-black font-sans text-[10px] leading-tight mx-auto px-1 py-4 flex flex-col shadow-none relative overflow-hidden text-center items-center">
            {/* Watermark Background */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-15">
                <img src="/icon.png" alt="" className="w-3/4 grayscale" />
            </div>

            <div className="relative z-10 w-full flex flex-col items-center">

                {/* 1. ENCABEZADO */}
                <div className="flex flex-col items-center mb-3 w-full">
                    <h1 className="font-black text-[13px] uppercase tracking-wider text-center break-words w-full mb-1">
                        {data.comercio.nombre}
                    </h1>
                    <p className="text-center font-bold text-[9px] w-full break-words">{data.comercio.direccion}</p>
                    <p className="text-center font-bold text-[9px]">{data.comercio.telefono}</p>
                </div>

                {/* Separador Sólido */}
                <div className="border-t-[2px] border-black my-2 w-full"></div>

                {/* 3. FECHA Y HORA */}
                <div className="flex justify-between w-full text-[10px] font-bold">
                    <span>{dateStr}</span>
                    <span>{timeStr}</span>
                </div>

                {/* 4. TIPO DE PEDIDO */}
                <div className="text-center font-black text-sm uppercase my-3 border-y-2 border-black py-1">
                    {data.pedido.tipo}
                </div>

                {/* 5. MESA */}
                {data.pedido.mesa && (
                    <div className="text-center font-black text-2xl my-2 uppercase">
                        MESA: {data.pedido.mesa}
                    </div>
                )}

                {/* 5.1 DATOS DEL CLIENTE (PARA DOMICILIO) */}
                {data.cliente && (
                    <div className="flex flex-col gap-1 my-3 p-2 border-2 border-black bg-gray-50 w-full">
                        <div className="flex items-center justify-center gap-1 border-b border-black pb-1 mb-1">
                            <span className="font-black uppercase text-[10px]">DATOS DEL CLIENTE</span>
                        </div>
                        <div className="text-center flex flex-col gap-0.5">
                            <p className="font-black text-sm uppercase leading-none">{data.cliente.nombre}</p>
                            <p className="font-bold text-[10px] break-words">
                                <span className="font-black uppercase">TEL: </span>{data.cliente.telefono}
                            </p>
                            <div className="mt-1 pb-1">
                                <p className="font-black uppercase text-[9px]">DIRECCIÓN:</p>
                                <p className="font-bold text-[10px] break-words uppercase leading-tight bg-white p-1 border border-black/20">
                                    {data.cliente.direccion}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. NÚMERO DE PEDIDO */}
                <div className="text-center font-black text-3xl my-2">
                    #{data.pedido.id.toString().slice(-4).padStart(4, '0')}
                </div>

                <div className="border-t-[2px] border-black my-2 w-full"></div>

                {/* 8. ENCABEZADO DE PRODUCTOS */}
                <div className="grid grid-cols-[1rem_1fr_2.5rem] gap-1 font-black mb-2 text-[9px] border-b border-black pb-1 w-full text-left">
                    <div className="text-left uppercase">C.</div>
                    <div className="text-left uppercase">Producto</div>
                    <div className="text-right uppercase">TOT</div>
                </div>

                {/* 9. LISTA DE PRODUCTOS */}
                <div className="flex flex-col gap-2 w-full">
                    {data.productos.map((prod, idx) => (
                        <div key={idx} className="grid grid-cols-[1.2rem_1fr_2.5rem] gap-1 items-start text-[10px] font-bold w-full">
                            <div className="text-left">{prod.cantidad}</div>
                            <div className="text-left flex flex-col leading-tight overflow-hidden">
                                <span className="uppercase break-words">{prod.nombre}</span>
                                {prod.detalle && (
                                    <span className="text-[9px] font-medium italic mt-0.5">
                                        ({prod.detalle})
                                    </span>
                                )}
                                {prod.extras && prod.extras.length > 0 && (
                                    <div className="text-[8px] font-medium italic mt-1 text-gray-700">
                                        {prod.extras.map((extra, i) => (
                                            <div key={i}>+ {extra}</div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="text-right whitespace-nowrap">
                                {formatCurrency(prod.precio * prod.cantidad)}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="border-t-[2px] border-black my-3 w-full"></div>

                {/* 11. TOTALES */}
                <div className="flex flex-col gap-1 text-[11px] font-bold w-full">
                    <div className="flex justify-between">
                        <span>TOTAL ARTÍCULOS</span>
                        <span>{data.productos.reduce((acc, item) => acc + item.cantidad, 0)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>SUBTOTAL</span>
                        <span>{formatCurrency(data.pedido.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-base font-black mt-1">
                        <span>TOTAL</span>
                        <span>{formatCurrency(data.pedido.total)}</span>
                    </div>
                </div>

                {/* 12. MÉTODO DE PAGO */}
                <div className="mt-4 mb-2 text-center uppercase font-black text-[11px] border border-black py-1">
                    PAGO: {data.pedido.metodo_pago}
                </div>

                {data.pedido.metodo_pago.toUpperCase() === 'EFECTIVO' && (
                    <div className="flex flex-col gap-1 text-[10px] font-bold mt-2 w-full">
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

                {/* NOTAS */}
                <div className="flex flex-col mt-4 mb-2 w-full">
                    <span className="mb-1 font-black text-[10px] uppercase text-left">NOTAS:</span>
                    <div className="w-full h-12 border-2 border-black"></div>
                </div>

                {/* PIE */}
                <div className="text-center mt-4 mb-4">
                    <p className="font-black text-xs uppercase">¡GRACIAS POR SU COMPRA!</p>
                    <div className="flex justify-center mt-2">
                        <span className="text-[9px] font-bold">casalena.netlify.app</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Ticket58mm;
