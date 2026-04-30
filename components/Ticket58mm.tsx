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
        is_pre_ticket?: boolean; // Flag to show "PRE-CUENTA"
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
        note?: string; 
    }>;
}

interface Ticket58mmProps {
    data: TicketData;
}

const Ticket58mm: React.FC<Ticket58mmProps> = ({ data }: Ticket58mmProps) => {
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
        <div className="w-[58mm] bg-white text-black font-sans text-[12px] leading-[1.1] mx-auto p-0 flex flex-col items-center overflow-hidden">

            {/* 1. LOGO Y DATOS DE CONTACTO */}
            <div className="flex flex-col items-center w-full mb-2">
                <img src="/icon.png" alt="Logo" className="w-20 grayscale mb-1" />
                <h1 className="font-black text-3xl tracking-tighter uppercase leading-none">CASALEÑA</h1>
                <div className="text-center font-black text-[10px] uppercase leading-tight space-y-0 text-black mt-1">
                    <p>Blvd. Juan N Alvarez, Col. Sentimientos</p>
                    <p>Ometepec Guerrero CP 41706</p>
                </div>
                <div className="mt-1 font-black leading-tight text-center">
                    <p className="text-[12px]">Tel {data.comercio.telefono}</p>
                    <p className="text-[13px] font-black mt-0.5 border-y border-dashed border-black py-0.5 px-2 inline-block">WhatsApp 741-107-5056</p>
                </div>
            </div>

            <div className="w-full my-1 border-b border-dashed border-black"></div>

            {/* 2. INFO DEL PEDIDO */}
            <div className="w-full px-1 space-y-0.5 font-black text-[12px]">
                <div className="flex justify-between">
                    <span>FECHA: {dateStr}</span>
                    <span>HORA: {timeStr}</span>
                </div>
                {isDelivery && (
                    <div className="text-center bg-black text-white py-1 my-1 text-[13px] font-black tracking-widest">
                        DOMICILIO: {data.pedido.id.toString().slice(-4).padStart(4, '0')}
                    </div>
                )}
                {!isDelivery && (
                    <div className="text-center border border-black py-0.5 my-1 text-[12px] font-black">
                        {data.pedido.tipo === 'dine-in' ? `MESA: ${data.pedido.mesa || 'S/N'}` : 'PARA LLEVAR'}
                    </div>
                )}
                {data.pedido.is_pre_ticket && (
                    <div className="text-center bg-black text-white py-0.5 my-1 text-[13px] font-black tracking-widest">
                        *** PRE-CUENTA ***
                    </div>
                )}
            </div>

            {/* 3. RECUADRO DE DIRECCIÓN / CLIENTE */}
            {data.cliente && (
                <div className="w-full px-2 my-1.5">
                    <div className="border border-black p-1.5 text-[11px] font-black text-center min-h-[36px] flex flex-col justify-center leading-tight">
                        <span className="uppercase font-black text-[12px]">{data.cliente.nombre}</span>
                        {data.cliente.telefono && <span className="text-[11px]">{data.cliente.telefono}</span>}
                        {isDelivery && data.cliente.direccion && (
                            <span className="uppercase break-words mt-0.5 opacity-80">{data.cliente.direccion}</span>
                        )}
                    </div>
                </div>
            )}

            {/* 4. DETALLES OPERATIVOS */}
            <div className="w-full px-1 text-[11px] font-bold space-y-0.5 mt-1 border-b border-dashed border-black pb-1">
                <div className="bg-gray-100 py-1 px-2 border border-black mb-1">
                    <p className="text-black font-black uppercase text-center text-[12px]">ATENDIDO POR: {data.atendido_por || 'ADMIN'}</p>
                </div>
                <div className="flex justify-between uppercase px-1">
                    <span>FOLIO:</span>
                    <span className="font-black">#{data.pedido.id.toString().slice(-6).padStart(6, '0')}</span>
                </div>
            </div>

            {/* 5. TABLA DE PRODUCTOS */}
            <div className="w-full mt-2">
                <div className="grid grid-cols-[2rem_1fr_3.5rem] gap-1 font-black text-[11px] border-b border-black pb-1 mb-1 px-1 uppercase">
                    <div className="text-left">Cant</div>
                    <div className="text-left">Descripción</div>
                    <div className="text-right">Total</div>
                </div>

                <div className="flex flex-col gap-2 w-full px-2">
                    {data.productos.map((prod: any, idx: number) => {
                        // Clean up redundant size info if it's already in the name
                        const nameLower = prod.nombre.toLowerCase();
                        const detailLower = prod.detalle?.toLowerCase() || '';
                        const showDetail = prod.detalle && !nameLower.includes(detailLower);

                        return (
                            <div key={idx} className="grid grid-cols-[2rem_1fr_3.5rem] gap-1 items-start text-[11px] font-bold px-1">
                                <div className="text-left font-black">{prod.cantidad}</div>
                                <div className="text-left flex flex-col leading-tight pr-1">
                                    <span className="uppercase font-black text-[12px]">{prod.nombre}</span>
                                    {showDetail && <span className="text-[10px] italic text-gray-600">{prod.detalle}</span>}
                                    {prod.note && <span className="text-[10px] font-black text-[#181511] italic bg-gray-100/50 px-1 rounded-sm mt-0.5">Nota: {prod.note}</span>}
                                    {prod.extras && prod.extras.map((ex: any, i: number) => (
                                        <span key={i} className="text-[10px] font-normal italic text-gray-500 tracking-tight">
                                            + {ex === 'half_and_half' ? 'Mitad y Mitad' : ex}
                                        </span>
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
            <div className="w-full mt-1 pt-1 border-t-2 border-double border-black px-1 space-y-0.5">
                <div className="flex justify-between font-black text-[13px] border-b border-black/10 pb-0.5">
                    <span>TOTAL:</span>
                    <span>{formatCurrency(data.pedido.total)}</span>
                </div>
                <div className="flex justify-between font-bold text-[11px] pt-1 uppercase">
                    <span className="max-w-[100px] leading-none">PAGO: {data.pedido.metodo_pago}</span>
                    <span>{formatCurrency(data.pedido.pago_con || data.pedido.total)}</span>
                </div>
                {(data.pedido.cambio ?? 0) > 0 && (
                    <div className="flex justify-between font-black text-[13px] text-gray-800 uppercase">
                        <span>SU CAMBIO:</span>
                        <span>{formatCurrency(data.pedido.cambio!)}</span>
                    </div>
                )}
            </div>

            {/* 7. RECUADRO INFERIOR DE TIPO */}
            <div className="w-full px-4 my-1.5">
                <div className="border border-black py-1 text-center font-black text-[12px] uppercase tracking-tighter">
                    {data.pedido.tipo === 'delivery' ? 'ENTREGA A DOMICILIO' :
                        data.pedido.tipo === 'takeout' ? 'PEDIDO PARA LLEVAR' : 'CONSUMO EN COMEDOR'}
                </div>
            </div>

            {/* 8. DATOS DEL CLIENTE ABAJO (COPIA PARA REPARTIDOR) */}
            {isDelivery && data.cliente && (
                <div className="w-full px-3 text-[11px] font-bold space-y-0.5 mb-2 border-l-2 border-black ml-1">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase opacity-60">Domicilio:</span>
                        <span className="font-black uppercase leading-tight">{data.cliente.direccion}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 border-t border-black/20 pt-1.5 mt-1">
                        <div className="flex justify-between items-end">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase opacity-60">Cliente:</span>
                                <span className="font-black uppercase text-[13px]">{data.cliente.nombre.split(' ')[0]}</span>
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase opacity-60 mb-0.5">Teléfono:</span>
                            <div className="font-black text-[17px] leading-none tracking-widest border-2 border-black bg-gray-100/50 py-1.5 px-2 text-center rounded-sm">
                                {data.cliente.telefono}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 10. NOTAS (OPCIONAL/COMPACTO) */}
            <div className="w-full px-2 mt-1 mb-0.5">
                <p className="font-bold text-[10px] uppercase mb-0.5">Notas:</p>
                <div className="w-full border border-black h-8"></div>
            </div>

            {/* 9. PIE DE PÁGINA */}
            <div className="text-center w-full space-y-0.5 mt-1">
                <p className="font-black text-[10px] uppercase tracking-tighter">¡Agradecemos su preferencia!</p>
                <p className="text-xl font-black leading-none mt-0.5">:)</p>
                <div className="w-full border-t border-dashed border-black pt-0.5 mt-1 opacity-50">
                    <p className="text-[8px] italic leading-none">(Comprobante no válido para efectos fiscales)</p>
                </div>
            </div>

        </div>
    );
};

export default Ticket58mm;
