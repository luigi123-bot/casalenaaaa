import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { generateTicketPDF } from '@/utils/ticketGenerator';

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { order, items, commerce } = body;

        // Prepare context for Generator
        const ticketData = {
            comercio: commerce || {
                nombre: "Casalena Pizza & Grill",
                telefono: "741-101-1595",
                direccion: "Blvd. Juan N Alvarez, CP 41706"
            },
            pedido: {
                id: order.id.toString().substring(0, 8),
                tipo: order.order_type || 'Comedor',
                mesa: order.table_number || '',
                subtotal: order.total_amount,
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
                nombre: it.name || it.products?.name,
                precio: it.price || it.unit_price,
                detalle: it.selectedSize || it.selected_size || ''
            }))
        };

        const outputPath = path.join(process.cwd(), 'public', 'tickets', `ticket_${order.id}.pdf`);

        // Ensure tickets directory exists
        const ticketsDir = path.join(process.cwd(), 'public', 'tickets');
        if (!fs.existsSync(ticketsDir)) {
            fs.mkdirSync(ticketsDir, { recursive: true });
        }

        // Generate PDF using Native TypeScript Generator
        await generateTicketPDF(ticketData, outputPath);

        // Automatic Printing (Linux/CUPS) - Optional/Local only
        let printed = false;
        try {
            console.log(`🖨️ [Server] Attempting to print: ${outputPath}`);
            // 'lp' sends the file to the default printer defined in the OS
            await execPromise(`lp "${outputPath}"`);
            console.log('✅ [Server] Sent to printer successfully');
            printed = true;
        } catch (printError) {
            console.warn('⚠️ [Server] Automatic print failed (lp command):', printError);
            // We proceed without erroring the whole request, letting the client handle the fallback (opening PDF)
        }

        const publicUrl = `/tickets/ticket_${order.id}.pdf`;
        return NextResponse.json({ url: publicUrl, printed });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
