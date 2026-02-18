'use client';

import React, { useEffect, useState } from 'react';

export interface TicketData {
    atendido_por?: string;
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
        <div className="w-full bg-white text-black font-mono text-[9px] leading-[1.15] mx-auto px-0 py-2 flex flex-col items-center">

            {/* 1. LOGO Y DATOS DE CONTACTO */}
            <div className="flex flex-col items-center w-full mb-1">
                <img src="/icon.png" alt="Logo" className="w-14 grayscale mb-1" />
                <h1 className="font-black text-base tracking-tighter uppercase mb-0.5">CASALEÑA</h1>
                <div className="text-center font-bold text-[7.5px] uppercase leading-tight space-y-0 text-gray-800">
                    <p>Boulevard Juan N Alvarez</p>
                    <p>Col. Sentimientos de la Nación</p>
                    <p>Ometepec Guerrero CP 41706</p>
                </div>
                <div className="mt-1 font-bold text-[8.5px] leading-tight text-center">
                    <p>Tel {data.comercio.telefono}</p>
                    <p>WhatsApp 741-107-5056</p>
                    <p className="text-[7.5px] mt-0.5 italic text-gray-600 tracking-tight">Lun a Dom de 1:00pm a 9:30pm</p>
                </div>
            </div>

            <div className="w-full text-center text-[10px] my-1 tracking-tighter">
                - - - - - - - - - - - - - - - - - -
            </div>

            {/* 2. INFO DEL PEDIDO */}
            <div className="w-full px-2 space-y-0.5 font-bold text-[8.5px]">
                <div className="flex justify-between">
                    <span>FECHA: {dateStr}</span>
                    <span>HORA: {timeStr}</span>
                </div>
                {isDelivery && (
                    <div className="text-center bg-black text-white py-1 my-1 text-[11px] font-black tracking-widest">
                        DOMI: {data.pedido.id.toString().slice(-4).padStart(4, '0')}
                    </div>
                )}
                {!isDelivery && (
                    <div className="text-center border-2 border-black py-0.5 my-1 text-[10px] font-black">
                        {data.pedido.tipo === 'dine-in' ? `MESA: ${data.pedido.mesa || 'S/N'}` : 'PARA LLEVAR'}
                    </div>
                )}
            </div>

            {/* 3. RECUADRO DE DIRECCIÓN */}
            {isDelivery && data.cliente && (
                <div className="w-full px-2 my-1.5">
                    <div className="border border-black p-1.5 text-[8.5px] font-black text-center min-h-[36px] flex flex-col justify-center leading-tight">
                        <span className="uppercase break-words">{data.cliente.direccion}</span>
                    </div>
                </div>
            )}

            {/* 4. DETALLES OPERATIVOS */}
            <div className="w-full px-2 text-[7.5px] font-bold space-y-0.5 mt-1 border-b border-dashed border-black pb-1.5 opacity-80">
                <p>ATENDIDO POR: {data.atendido_por || 'ADMIN'}</p>
                <div className="flex justify-between uppercase">
                    <span>NOTA DE PEDIDO:</span>
                    <span className="font-black">#{data.pedido.id.toString().slice(-6).padStart(6, '0')}</span>
                </div>
            </div>

            {/* 5. TABLA DE PRODUCTOS */}
            <div className="w-full mt-2">
                <div className="grid grid-cols-[1.2rem_1fr_2.5rem] gap-1 font-black text-[8.5px] border-b border-black pb-1 mb-1 px-2 uppercase">
                    <div className="text-left">Cant</div>
                    <div className="text-left">Descripción</div>
                    <div className="text-right">Total</div>
                </div>

                <div className="flex flex-col gap-2 w-full px-2">
                    {data.productos.map((prod, idx) => {
                        // Clean up redundant size info if it's already in the name
                        const nameLower = prod.nombre.toLowerCase();
                        const detailLower = prod.detalle?.toLowerCase() || '';
                        const showDetail = prod.detalle && !nameLower.includes(detailLower);

                        return (
                            <div key={idx} className="grid grid-cols-[1.2rem_1fr_2.5rem] gap-1 items-start text-[8.5px] font-bold">
                                <div className="text-left font-black">{prod.cantidad}</div>
                                <div className="text-left flex flex-col leading-tight pr-1">
                                    <span className="uppercase font-black text-[9px]">{prod.nombre}</span>
                                    {showDetail && <span className="text-[7.5px] italic text-gray-600">{prod.detalle}</span>}
                                    {prod.extras && prod.extras.map((ex, i) => (
                                        <span key={i} className="text-[7.5px] font-normal italic text-gray-500 tracking-tight">+ {ex}</span>
                                    ))}
                                </div>
                                <div className="text-right font-black">
                                    {formatCurrency(prod.precio * prod.cantidad).replace('$', '')}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 6. TOTALES */}
            <div className="w-full mt-3 pt-1.5 border-t-2 border-double border-black px-2 space-y-1">
                <div className="flex justify-between font-black text-[12px] border-b border-black/10 pb-1">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(data.pedido.total)}</span>
                </div>
                <div className="flex justify-between font-bold text-[8.5px] pt-1 uppercase">
                    <span className="max-w-[80px] leading-none">PAGO: {data.pedido.metodo_pago}</span>
                    <span>{formatCurrency(data.pedido.pago_con || data.pedido.total)}</span>
                </div>
                {data.pedido.cambio && data.pedido.cambio > 0 && (
                    <div className="flex justify-between font-black text-[10px] text-gray-800 uppercase">
                        <span>SU CAMBIO:</span>
                        <span>{formatCurrency(data.pedido.cambio)}</span>
                    </div>
                )}
            </div>

            {/* 7. RECUADRO INFERIOR DE TIPO */}
            <div className="w-full px-4 my-3">
                <div className="border border-black py-1 text-center font-black text-[9px] uppercase tracking-tighter">
                    {data.pedido.tipo === 'delivery' ? 'ENTREGA A DOMICILIO' :
                        data.pedido.tipo === 'takeout' ? 'PEDIDO PARA LLEVAR' : 'CONSUMO EN COMEDOR'}
                </div>
            </div>

            {/* 8. DATOS DEL CLIENTE ABAJO (COPIA PARA REPARTIDOR) */}
            {isDelivery && data.cliente && (
                <div className="w-full px-3 text-[8.5px] font-bold space-y-1 mb-4 border-l-2 border-black ml-1">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[7.5px] uppercase opacity-60">Domicilio:</span>
                        <span className="font-black uppercase leading-tight">{data.cliente.direccion}</span>
                    </div>
                    <div className="flex justify-between border-t border-black/10 pt-1">
                        <div className="flex flex-col">
                            <span className="text-[7.5px] uppercase opacity-60">Teléfono:</span>
                            <span className="font-black">{data.cliente.telefono}</span>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[7.5px] uppercase opacity-60">Cliente:</span>
                            <span className="font-black uppercase">{data.cliente.nombre.split(' ')[0]}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 10. NOTAS */}
            <div className="w-full px-2 mt-2 mb-1">
                <p className="font-bold text-[8.5px] uppercase">Notas:</p>
                <div className="border-b border-black border-dotted h-4"></div>
                <div className="border-b border-black border-dotted h-4"></div>
            </div>

            {/* 9. PIE DE PÁGINA */}
            <div className="text-center w-full space-y-1 mt-2">
                <p className="font-black text-[8.5px] uppercase tracking-tighter">¡Agradecemos su preferencia!</p>
                <p className="text-2xl font-black leading-none mt-1">:)</p>
                <div className="w-full border-t border-dashed border-black pt-1 mt-2 opacity-50">
                    <p className="text-[6.5px] italic leading-none">(Comprobante no válido para efectos fiscales)</p>
                </div>
            </div>

        </div>
    );
};

export default Ticket58mm;
