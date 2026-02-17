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
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        setDateStr(`${day}/${month}/${year}`);

        let hours = now.getHours();
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'pm' : 'am';
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

    const isDelivery = data.pedido.tipo.toLowerCase().includes('domicilio') || data.pedido.tipo.toLowerCase().includes('delivery');

    return (
        <div className="w-full bg-white text-black font-mono text-[9px] leading-tight mx-auto px-0 py-2 flex flex-col items-center">

            {/* 1. LOGO Y DATOS FISCALES / CONTACTO */}
            <div className="flex flex-col items-center w-full mb-1">
                <img src="/icon.png" alt="Logo" className="w-16 grayscale mb-1" />
                <h1 className="font-black text-lg tracking-tighter uppercase mb-1">CASALEÑA</h1>
                <p className="text-center font-bold text-[8px] uppercase leading-none">
                    Boulevard Juan N Alvarez<br />
                    Col. Sentimientos de la Nación<br />
                    Ometepec Guerrero CP 41706
                </p>
                <div className="mt-1 font-bold text-[9px]">
                    <p>Tel {data.comercio.telefono}</p>
                    <p>WhatsApp 741-107-5056</p>
                    <p className="text-[8px] mt-1 italic">Lun a Dom de 1:00pm a 9:30pm</p>
                </div>
            </div>

            <div className="w-full text-center text-[10px] my-1">
                - - - - - - - - - - - - - - - - - -
            </div>

            {/* 2. INFO DEL PEDIDO */}
            <div className="w-full px-1 space-y-0.5 font-bold">
                <div className="flex justify-between">
                    <span>Fecha: {dateStr}</span>
                    <span>Hora: {timeStr}</span>
                </div>
                {isDelivery && (
                    <div className="text-center bg-black text-white py-1 my-1 text-xs font-black">
                        DOMI: {data.pedido.id.toString().slice(-4).padStart(4, '0')}
                    </div>
                )}
                {!isDelivery && (
                    <div className="text-center border-2 border-black py-1 my-1 text-xs font-black">
                        {data.pedido.tipo === 'dine-in' ? `MESA: ${data.pedido.mesa || 'S/N'}` : 'PARA LLEVAR'}
                    </div>
                )}
            </div>

            {/* 3. RECUADRO DE REFERENCIA / DIRECCIÓN CORTA */}
            {isDelivery && data.cliente && (
                <div className="w-full px-1 my-2">
                    <div className="border-2 border-black p-1 text-[9px] font-black text-center min-h-[40px] flex flex-col justify-center">
                        <span className="uppercase">{data.cliente.direccion}</span>
                    </div>
                </div>
            )}

            {/* 4. DETALLES OPERATIVOS */}
            <div className="w-full px-1 text-[8px] font-bold space-y-0.5 mt-1 border-b border-dashed border-black pb-2">
                <p>ATENDIDO POR: BELEM</p>
                <div className="flex justify-between">
                    <span>NOTAS DE PEDIDO</span>
                    <span>00000{data.pedido.id.toString().slice(-1)}</span>
                </div>
            </div>

            {/* 5. TABLA DE PRODUCTOS */}
            <div className="w-full mt-2">
                <div className="grid grid-cols-[1.5rem_1fr_2.5rem] gap-1 font-black text-[9px] border-b border-black pb-1 mb-1 px-1">
                    <div className="text-left">Cant</div>
                    <div className="text-left">Descripción/Observ.</div>
                    <div className="text-right">Importe</div>
                </div>

                <div className="flex flex-col gap-2 w-full px-1">
                    {data.productos.map((prod, idx) => (
                        <div key={idx} className="grid grid-cols-[1.5rem_1fr_2.5rem] gap-1 items-start text-[9px] font-bold">
                            <div className="text-left">{prod.cantidad}</div>
                            <div className="text-left flex flex-col leading-tight">
                                <span className="uppercase">{prod.nombre}</span>
                                {prod.detalle && <span className="text-[8px] italic">{prod.detalle}</span>}
                                {prod.extras && prod.extras.map((ex, i) => (
                                    <span key={i} className="text-[7px] text-gray-600">+ {ex}</span>
                                ))}
                            </div>
                            <div className="text-right">
                                {(prod.precio * prod.cantidad).toFixed(2)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 6. TOTALES */}
            <div className="w-full mt-2 pt-1 border-t-2 border-double border-black px-1 space-y-1">
                <div className="flex justify-between font-black text-[11px]">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(data.pedido.total)}</span>
                </div>
                <div className="flex justify-between font-bold text-[9px]">
                    <span>PAGO EN {data.pedido.metodo_pago.toUpperCase()}</span>
                    <span>{formatCurrency(data.pedido.pago_con || data.pedido.total)}</span>
                </div>
                {data.pedido.cambio && data.pedido.cambio > 0 && (
                    <div className="flex justify-between font-bold text-[9px]">
                        <span>SU CAMBIO:</span>
                        <span>{formatCurrency(data.pedido.cambio)}</span>
                    </div>
                )}
            </div>

            {/* 7. RECUADRO INFERIOR DE TIPO */}
            <div className="w-full px-4 my-4">
                <div className="border border-black py-1 text-center font-black text-[10px] uppercase">
                    {data.pedido.tipo === 'delivery' ? 'ENTREGA A DOMICILIO' :
                        data.pedido.tipo === 'takeout' ? 'PEDIDO PARA LLEVAR' : 'CONSUMO EN COMEDOR'}
                </div>
            </div>

            {/* 8. DATOS DEL CLIENTE ABAJO (COPIA PARA REPARTIDOR) */}
            {isDelivery && data.cliente && (
                <div className="w-full px-2 text-[9px] font-bold space-y-1 mb-4">
                    <p>DOMICILIO: <span className="font-normal uppercase">{data.cliente.direccion}</span></p>
                    <p>TELÉFONO: <span className="font-black">{data.cliente.telefono}</span></p>
                    <p>CLIENTE: <span className="font-normal uppercase">{data.cliente.nombre}</span></p>
                </div>
            )}

            {/* 9. PIE DE PÁGINA */}
            <div className="text-center w-full space-y-1 mt-2">
                <p className="font-black text-[9px] uppercase">¡Agradecemos su preferencia!</p>
                <p className="text-xl font-black">:)</p>
                <div className="w-full border-t border-dashed border-black pt-1">
                    <p className="text-[7px] italic text-gray-500">(Comprobante no válido para efectos fiscales)</p>
                </div>
            </div>

        </div>
    );
};

export default Ticket58mm;
