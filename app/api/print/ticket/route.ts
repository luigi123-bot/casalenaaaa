import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { order, items, commerce } = body;

        // Prepare context for Python
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

        const jsonString = JSON.stringify(ticketData);
        const outputPath = path.join(process.cwd(), 'public', 'tickets', `ticket_${order.id}.pdf`);

        // Ensure tickets directory exists
        const ticketsDir = path.join(process.cwd(), 'public', 'tickets');
        if (!fs.existsSync(ticketsDir)) {
            fs.mkdirSync(ticketsDir, { recursive: true });
        }

        const scriptPath = path.join(process.cwd(), 'utils', 'generar_ticket.py');

        // Use the virtual environment python if it exists, otherwise fall back to system python
        // We use a completely dynamic approach to hide the path from Turbopack asset tracing
        let pythonCommand = process.env.PYTHON_PATH || 'python3';

        try {
            const venvPath = path.join(process.cwd(), ['ven', 'v'].join(''), 'bin', 'python');
            if (fs.existsSync(venvPath)) {
                pythonCommand = venvPath;
            }
        } catch (e) {
            // Fallback to python3 if check fails
        }

        // Execute Python script
        // We use a base64 encoding for the JSON to avoid shell execution issues with special characters
        const base64Json = Buffer.from(jsonString).toString('base64');
        const command = `${pythonCommand} ${scriptPath} --json "$(echo ${base64Json} | base64 -d)" --output ${outputPath}`;

        const { stdout, stderr } = await execPromise(command);

        if (stderr && !stdout.includes('SUCCESS')) {
            console.error('Python Error:', stderr);
            return NextResponse.json({ error: 'Error generating PDF' }, { status: 500 });
        }

        // Automatic Printing (Linux/CUPS)
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
