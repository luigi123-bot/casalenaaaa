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
    let tempFilePath: string | null = null;

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

        // Create temp directory if it doesn't exist
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        // Generate PDF in temp location
        tempFilePath = path.join(tempDir, `ticket_${order.id}_${Date.now()}.pdf`);
        await generateTicketPDF(ticketData, tempFilePath);

        // AUTO-PRINT (Linux/CUPS)
        let printed = false;
        let printError = null;

        try {
            console.log(`🖨️ [Server] Auto-printing ticket for order ${order.id}...`);

            // ⚡ Strategy 1: Use Cached Printer (Fastest)
            if (cachedPrinter) {
                console.log(`⚡ [Server] Using cached printer: ${cachedPrinter}`);
                await printWithTimeout(`lp -d ${cachedPrinter} "${tempFilePath}"`);
                printed = true;
            } else {
                // 🔍 Strategy 2: Discovery Phase (First time only)
                try {
                    // Try default system printer first
                    const { stdout: defaultPrinter } = await execPromise('lpstat -d') as any;

                    if (!defaultPrinter.includes('no system default destination')) {
                        await printWithTimeout(`lp "${tempFilePath}"`);
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
                                await printWithTimeout(`lp -d ${printerName} "${tempFilePath}"`);
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
        } catch (error: any) {
            console.error('⚠️ [Server] Print failed:', error);
            printError = error.message;
        }

        // Clean up: Delete temp file immediately after printing (or attempting to print)
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
                console.log(`🗑️ [Server] Deleted temp file: ${tempFilePath}`);
            } catch (cleanupError) {
                console.warn('⚠️ [Server] Could not delete temp file:', cleanupError);
            }
        }

        // Return only print status (no URL)
        if (printed) {
            return NextResponse.json({
                success: true,
                printed: true,
                message: 'Ticket printed successfully'
            });
        } else {
            return NextResponse.json({
                success: false,
                printed: false,
                error: printError || 'Could not print ticket',
                message: 'Print failed - please check printer connection'
            }, { status: 500 });
        }

    } catch (error: any) {
        console.error('❌ [Server] API Error:', error);

        // Clean up temp file if it exists
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try {
                fs.unlinkSync(tempFilePath);
            } catch (cleanupError) {
                console.warn('⚠️ [Server] Could not delete temp file:', cleanupError);
            }
        }

        return NextResponse.json({
            success: false,
            error: error.message,
            message: 'Failed to generate or print ticket'
        }, { status: 500 });
    }
}
