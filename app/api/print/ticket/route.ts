import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { generateTicketPDF } from '@/utils/ticketGenerator';

export async function POST(req: NextRequest) {
    let tempFilePath: string | null = null;
    let tempDir: string | null = null;

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

        // 2. Generate PDF
        tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const fileName = `ticket_${order.id || 'temp'}_${Date.now()}.pdf`;
        tempFilePath = path.join(tempDir, fileName);

        await generateTicketPDF(ticketData, tempFilePath);

        // 3. Return Data URL (Instant)
        const pdfBuffer = fs.readFileSync(tempFilePath);
        const pdfBase64 = pdfBuffer.toString('base64');
        const dataUrl = `data:application/pdf;base64,${pdfBase64}`;

        // Cleanup immediately since we sent the data buffer
        try { fs.unlinkSync(tempFilePath); } catch (e) { }

        console.log('✅ [Server] PDF generado correctamente (Modo Rápido)');

        return NextResponse.json({
            success: true,
            url: dataUrl
        });

    } catch (error: any) {
        console.error('❌ [Server] Error generating PDF:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
