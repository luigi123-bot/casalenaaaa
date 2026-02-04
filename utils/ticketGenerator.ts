import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

interface CommerceData {
    nombre: string;
    telefono: string;
    direccion: string;
}

interface CustomerData {
    nombre: string;
    telefono: string;
    direccion: string;
}

interface OrderData {
    id: string;
    tipo: string;
    mesa?: string;
    subtotal: number;
    total: number;
    metodo_pago: string;
    pago_con?: number;
    cambio?: number;
    cliente?: CustomerData | null;
}

interface ProductData {
    cantidad: number;
    nombre: string;
    precio: number;
    detalle?: string;
}

interface TicketData {
    comercio: CommerceData;
    pedido: OrderData;
    productos: ProductData[];
}

export async function generateTicketPDF(data: TicketData, outputPath: string): Promise<string> {
    const { comercio, pedido, productos } = data;

    // Dimensions for 58mm thermal printer (58mm = ~164.4 points)
    const mmToPoints = 2.83465;
    const width = 58 * mmToPoints;
    const margin = 2 * mmToPoints;
    const usableWidth = width - (margin * 2);

    // Initial constants
    // Use an absolute path that works in Next.js development and potentially production (if assets copied)
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'casalena-font.ttf');
    const fontSizeNormal = 8;
    const fontSizeHeader = 10;
    const lineHeight = 10;

    console.log(`[TicketGen] Looking for font at: ${fontPath}`);

    // 2. Read font as Buffer REQUIRED
    // We MUST use a custom font buffer to avoid PDFKit looking for StandardAFM fonts which are missing in serverless/nextjs bundles
    let fontBuffer: Buffer;
    try {
        if (fs.existsSync(fontPath)) {
            fontBuffer = fs.readFileSync(fontPath);
            console.log(`[TicketGen] Font loaded. Size: ${fontBuffer.length} bytes`);
        } else {
            console.error(`[TicketGen] Font NOT FOUND at ${fontPath}`);
            throw new Error(`Font file missing: ${fontPath}`);
        }
    } catch (e) {
        console.error('[TicketGen] Error reading font file:', e);
        throw e; // Fail hard if no font, otherwise PDFKit crashes obscurely later
    }

    // 1. Calculate height dynamically with a generous buffer to prevent page breaks
    // Thermal printers cut the paper, so extra white space at the bottom is better than splitting content
    // Header(8 lines) + Info(6) + Separators(3) + Products(buffer 3 lines each) + Totals(8) + Footer(4) + Delivery(6)
    const estimatedLines = 35 + (productos.length * 3) + (pedido.cliente ? 8 : 0);
    const height = (estimatedLines * lineHeight) + 60; // Extra padding


    // 3. Create the PDF Document
    // Use autoFirstPage: false to prevent loading default font (Helvetica) immediately
    // CRITICAL: Pass 'font' option with buffer to prevent PDFKit from loading standard fonts from disk
    const doc = new PDFDocument({
        size: [width, height],
        margins: { top: margin, bottom: margin, left: margin, right: margin },
        autoFirstPage: false,
        font: fontBuffer as any
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // 4. Assign font IMMEDIATELY before adding page
    // Using the buffer directly avoids any FS lookups for .afm files
    doc.font(fontBuffer);

    // 5. Add the page manually now that font is set
    doc.addPage({
        size: [width, height],
        margins: { top: margin, bottom: margin, left: margin, right: margin }
    });

    // Re-assert font for the page context just in case
    doc.font(fontBuffer);

    let currentY = margin;

    const textLine = (text: string, options: { align?: 'left' | 'center' | 'right', bold?: boolean, size?: number } = {}) => {
        const { align = 'left', size = fontSizeNormal } = options;

        // Always set font buffer
        doc.font(fontBuffer).fontSize(size);

        if (align === 'center') {
            doc.text(text, margin, currentY, { width: usableWidth, align: 'center' });
        } else if (align === 'right') {
            doc.text(text, margin, currentY, { width: usableWidth, align: 'right' });
        } else {
            doc.text(text, margin, currentY);
        }
        currentY += lineHeight;
    };

    const drawSeparator = () => {
        doc.moveTo(margin, currentY + (lineHeight / 2))
            .lineTo(width - margin, currentY + (lineHeight / 2))
            .dash(1, { space: 1 })
            .stroke();
        doc.undash();
        currentY += lineHeight;
    };

    // --- SECCIÓN: ENCABEZADO ---
    textLine(comercio.nombre.toUpperCase(), { size: fontSizeHeader, align: 'center', bold: true });
    textLine(`Tel: ${comercio.telefono}`, { align: 'center' });
    textLine(comercio.direccion, { align: 'center' });

    drawSeparator();

    // --- SECCIÓN: INFO PEDIDO ---
    const now = new Date();
    textLine(`FECHA: ${now.toLocaleDateString('es-MX')}`);
    textLine(`HORA:  ${now.toLocaleTimeString('es-MX')}`);
    textLine(`TICKET: ${pedido.id}`, { bold: true });

    if (pedido.tipo) {
        textLine(`MODO: ${pedido.tipo.toUpperCase()}`, { bold: true });
    }
    if (pedido.mesa) {
        textLine(`MESA: ${pedido.mesa}`, { bold: true });
    }

    drawSeparator();

    // --- SECCIÓN: PRODUCTOS ---
    // Column Headers
    doc.font(fontBuffer).fontSize(fontSizeNormal);
    doc.text('Cant', margin, currentY);
    doc.text('Producto', margin + (10 * mmToPoints), currentY);
    doc.text('Total', margin, currentY, { width: usableWidth, align: 'right' });
    currentY += lineHeight;

    doc.font(fontBuffer).fontSize(fontSizeNormal);
    productos.forEach(p => {
        const nombre = (p.nombre || 'Producto').substring(0, 18);
        doc.text((p.cantidad || 1).toString(), margin, currentY);
        doc.text(nombre, margin + (10 * mmToPoints), currentY);
        doc.text(`$${(p.precio || 0).toFixed(2)}`, margin, currentY, { width: usableWidth, align: 'right' });
        currentY += lineHeight;

        if (p.detalle) {
            textLine(`  *${p.detalle}`, { size: fontSizeNormal - 1 });
        }
    });

    drawSeparator();

    // --- SECCIÓN: TOTALES ---
    doc.font(fontBuffer).fontSize(fontSizeNormal);
    doc.text('SUBTOTAL:', margin, currentY);
    doc.text(`$${pedido.subtotal.toFixed(2)}`, margin, currentY, { width: usableWidth, align: 'right' });
    currentY += lineHeight;

    doc.font(fontBuffer).fontSize(fontSizeNormal);
    doc.text('TOTAL:', margin, currentY);
    doc.text(`$${pedido.total.toFixed(2)}`, margin, currentY, { width: usableWidth, align: 'right' });
    currentY += lineHeight;

    textLine(`PAGO: ${pedido.metodo_pago.toUpperCase()}`);

    if (pedido.metodo_pago.toUpperCase() === 'EFECTIVO' || pedido.pago_con) {
        const pago = pedido.pago_con || pedido.total;
        const cambio = pedido.cambio || 0;
        textLine(`RECIBIDO: $${pago.toFixed(2)}`);
        textLine(`CAMBIO:   $${cambio.toFixed(2)}`, { bold: true });
    }

    drawSeparator();

    // --- SECCIÓN: CLIENTE (SI ES DOMICILIO) ---
    if (pedido.cliente) {
        textLine("CLIENTE:", { bold: true });
        textLine(pedido.cliente.nombre);
        textLine(pedido.cliente.telefono);

        const address = pedido.cliente.direccion;
        const chunkSize = 25;
        for (let i = 0; i < address.length; i += chunkSize) {
            textLine(address.substring(i, i + chunkSize));
        }
        drawSeparator();
    }

    // --- SECCIÓN: PIE ---
    textLine("¡GRACIAS POR SU COMPRA!", { align: 'center', bold: true });
    textLine("Vuelva pronto", { align: 'center' });

    // Finalize
    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
    });
}
