import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { generateTicketPDF } from '@/utils/ticketGenerator';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { order, items, commerce } = body;

        // 1. Prepare Data
        const ticketData = {
            comercio: commerce || {
                nombre: "Casalena Pizza & Grill",
                telefono: "741-101-1595",
                direccion: "Blvd. Juan N Alvarez, CP 41706"
            },
            pedido: {
                id: order.id ? order.id.toString() : 'NO-ID',
                tipo: order.order_type || 'Comedor',
                mesa: order.table_number || '',
                subtotal: order.subtotal || order.total_amount,
                total: order.total_amount,
                metodo_pago: order.payment_method || 'Efectivo',
                pago_con: order.pago_con || 0,
                cambio: order.cambio || 0,
                cliente: order.order_type === 'delivery' ? {
                    nombre: order.customer_name || 'Desconocido',
                    telefono: order.phone_number || '',
                    direccion: order.delivery_address || ''
                } : null
            },
            productos: items.map((it: any) => ({
                cantidad: it.quantity,
                nombre: it.name || it.products?.name || 'Producto',
                precio: it.price || it.unit_price || 0,
                detalle: it.selectedSize || it.selected_size || ''
            }))
        };

        // 2. Generate PDF (uses /tmp which is available in Netlify Functions)
        const tempPath = `/tmp/ticket_${order.id || 'temp'}_${Date.now()}.pdf`;
        await generateTicketPDF(ticketData, tempPath);

        // 3. Read and convert to base64
        const pdfBuffer = fs.readFileSync(tempPath);
        const pdfBase64 = pdfBuffer.toString('base64');
        const dataUrl = `data:application/pdf;base64,${pdfBase64}`;

        // Cleanup
        try { fs.unlinkSync(tempPath); } catch (e) { console.warn('Cleanup warning:', e); }

        console.log('✅ [Server] PDF generado correctamente');

        return NextResponse.json({
            success: true,
            url: dataUrl
        });

    } catch (error: any) {
        console.error('❌ [Server] Error generating PDF:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
