import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { generateTicketPDF } from '@/utils/ticketGenerator';

const execPromise = promisify(exec);

// 🚀 Module-level Cache for Printer Name to speed up subsequent requests!
let cachedPrinter: string | null = null;

// Helper to execute print command with a timeout to prevent hanging (max 3 seconds)
const printWithTimeout = async (command: string, timeoutMs: number = 3000) => {
    return new Promise((resolve, reject) => {
        const child = exec(command, (error, stdout, stderr) => {
            if (error) reject(error);
            else resolve(stdout);
        });
        // Kill process if it takes too long
        setTimeout(() => {
            child.kill();
            reject(new Error('Print command timed out'));
        }, timeoutMs);
    });
};

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
        const ticketsDir = path.join(process.cwd(), 'public', 'tickets');
        if (!fs.existsSync(ticketsDir)) fs.mkdirSync(ticketsDir, { recursive: true });

        // Generate PDF using Native TypeScript Generator
        await generateTicketPDF(ticketData, outputPath);

        // OPTIMIZED AUTO-PRINTING (Linux/CUPS)
        let printed = false;
        try {
            console.log(`🖨️ [Server] Printing: ${outputPath}`);

            // ⚡ Strategy 1: Use Cached Printer (Fastest)
            if (cachedPrinter) {
                console.log(`⚡ [Server] Using cached printer: ${cachedPrinter}`);
                await printWithTimeout(`lp -d ${cachedPrinter} "${outputPath}"`);
                printed = true;
            } else {
                // 🔍 Strategy 2: Discovery Phase (First time only)
                try {
                    // Try default system printer first
                    const { stdout: defaultPrinter } = await execPromise('lpstat -d') as any;

                    if (!defaultPrinter.includes('no system default destination')) {
                        await printWithTimeout(`lp "${outputPath}"`);
                        console.log('✅ [Server] Printed to system default');
                        printed = true;
                    } else {
                        // Fallback: Scan for printers
                        console.log('🔍 [Server] Scanning for printers...');
                        const { stdout: printersOut } = await execPromise('lpstat -a') as any;
                        const firstPrinterLine = printersOut.split('\n')[0];

                        if (firstPrinterLine) {
                            const printerName = firstPrinterLine.split(' ')[0];
                            if (printerName) {
                                cachedPrinter = printerName; // CACHE IT!
                                console.log(`✅ [Server] Found & Cached printer: ${printerName}`);
                                await printWithTimeout(`lp -d ${printerName} "${outputPath}"`);
                                printed = true;
                            }
                        } else {
                            throw new Error('No printers found');
                        }
                    }
                } catch (e) {
                    throw e; // Propagate to outer catch
                }
            }
        } catch (printError) {
            console.warn('⚠️ [Server] Best-effort print failed:', printError);
            // We proceed returning the PDF URL, user can print manually
        }

        const publicUrl = `/tickets/ticket_${order.id}.pdf`;
        return NextResponse.json({ url: publicUrl, printed });

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
