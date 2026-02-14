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

    // Dimensions for 58mm thermal printer
    const mmToPoints = 2.83465;
    const width = 58 * mmToPoints;
    const margin = 2 * mmToPoints;
    const usableWidth = width - (margin * 2);

    // Font and spacing constants
    const fontSizeNormal = 12;
    const fontSizeHeader = 16;
    const lineHeight = 22; // Increased for better spacing

    console.log('[TicketGen] Using built-in Helvetica font for serverless compatibility');

    // Calculate height with extra padding
    const estimatedLines = 40 + (productos.length * 4) + (pedido.cliente ? 10 : 0);
    const height = (estimatedLines * lineHeight) + 100;

    // Create PDF with built-in font (works in serverless)
    const doc = new PDFDocument({
        size: [width, height],
        margins: { top: margin, bottom: margin, left: margin, right: margin },
        autoFirstPage: false
    });

    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Use built-in Helvetica font (always available)
    doc.font('Helvetica');

    doc.addPage({
        size: [width, height],
        margins: { top: margin, bottom: margin, left: margin, right: margin }
    });

    doc.font('Helvetica');

    let currentY = margin;

    const textLine = (text: string, options: { align?: 'left' | 'center' | 'right', bold?: boolean, size?: number } = {}) => {
        const { align = 'left', size = fontSizeNormal } = options;
        doc.font('Helvetica').fontSize(size);

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

    // --- HEADER ---
    // Title with character spacing for better readability
    doc.font('Helvetica').fontSize(16);
    doc.text("CASALEÑA", margin, currentY, {
        width: usableWidth,
        align: 'center',
        characterSpacing: 2 // Separate letters
    });
    currentY += lineHeight + 15; // Extra space after title (increased separation)

    // Address
    textLine("Blvd. Juan N Alvarez, CP 41706", { size: 10, align: 'center' });
    currentY += 3; // Small gap

    // Phone
    textLine("Tel: 741-101-1595", { size: 10, align: 'center' });
    currentY += 5; // Space before separator

    drawSeparator();
    currentY += 8;

    // --- ORDER INFO ---
    const now = new Date();
    textLine(`FECHA: ${now.toLocaleDateString('es-MX')}`);
    textLine(`HORA:  ${now.toLocaleTimeString('es-MX')}`);

    currentY += 5;
    if (pedido.tipo) {
        textLine(pedido.tipo.toUpperCase(), { align: 'center', bold: true, size: 14 });
    }

    // BIG TABLE NUMBER - Very visible for kitchen
    if (pedido.mesa) {
        currentY += 5;
        doc.font('Helvetica').fontSize(10);
        doc.text("MESA:", margin, currentY, { width: usableWidth, align: 'center' });
        currentY += lineHeight;

        doc.font('Helvetica').fontSize(28);
        doc.text(pedido.mesa, margin, currentY, {
            width: usableWidth,
            align: 'center',
            characterSpacing: 3 // Separate digits
        });
        currentY += lineHeight + 10;
    } else {
        currentY += 5;
    }

    // --- NOTES SECTION - Blank space for handwritten notes ---
    drawSeparator();
    currentY += 5;

    textLine("NOTAS:", { bold: true, size: 10 });
    currentY += 5;

    // Draw empty rectangle for notes
    const notesHeight = 60; // Height for writing notes
    doc.rect(margin + 5, currentY, usableWidth - 10, notesHeight)
        .stroke();
    currentY += notesHeight + 10;

    drawSeparator();
    currentY += 10;

    // --- BIG ORDER ID with leading zeros ---
    const formattedId = pedido.id.toString().padStart(5, '0');
    textLine('NOTA DE PEDIDO', { size: 10, align: 'center', bold: true });
    textLine(formattedId, { size: 32, align: 'center', bold: true });

    currentY += 10;
    drawSeparator();
    currentY += 8;

    // --- PRODUCTS TABLE ---
    const xQty = margin;
    const xName = margin + 15;

    doc.font('Helvetica').fontSize(10);
    doc.text('Ct', xQty, currentY);
    doc.text('Producto', xName, currentY);
    doc.text('Total', margin, currentY, { width: usableWidth, align: 'right' });
    currentY += lineHeight;
    currentY += 3;

    doc.font('Helvetica').fontSize(12);
    productos.forEach(p => {
        const cleanName = (p.nombre || 'Producto').substring(0, 10);

        doc.text((p.cantidad || 1).toString(), xQty, currentY);
        doc.text(cleanName, xName, currentY);
        doc.text(`$${(p.precio || 0).toFixed(2)}`, margin, currentY, { width: usableWidth, align: 'right' });
        currentY += lineHeight;

        if (p.detalle) {
            doc.fontSize(10);
            doc.text(` *${p.detalle}`, xName, currentY);
            doc.fontSize(12);
            currentY += lineHeight;
        }
        currentY += 4;
    });

    drawSeparator();
    currentY += 8;

    // --- TOTALS ---
    doc.font('Helvetica').fontSize(12);

    const totalLine = (label: string, value: string) => {
        doc.text(label, margin, currentY);
        doc.text(value, margin, currentY, { width: usableWidth, align: 'right' });
        currentY += lineHeight;
    };

    totalLine('SUBTOTAL:', `$${pedido.subtotal.toFixed(2)}`);
    totalLine('TOTAL:', `$${pedido.total.toFixed(2)}`);
    currentY += 3;
    textLine(`PAGO: ${pedido.metodo_pago.toUpperCase()}`);

    if (pedido.metodo_pago.toUpperCase() === 'EFECTIVO' || pedido.pago_con) {
        const pago = pedido.pago_con || pedido.total;
        const cambio = pedido.cambio || 0;
        totalLine('RECIBIDO:', `$${pago.toFixed(2)}`);
        totalLine('CAMBIO:', `$${cambio.toFixed(2)}`);
    }

    drawSeparator();
    currentY += 8;

    // --- CUSTOMER INFO ---
    if (pedido.cliente) {
        textLine("DATOS CLIENTE:", { bold: true });
        textLine(pedido.cliente.nombre);
        textLine(pedido.cliente.telefono);
        textLine(pedido.cliente.direccion, { size: 10 });
        drawSeparator();
        currentY += 8;
    }



    // --- FOOTER ---
    currentY += 20; // More space before footer

    // Thank you message with character spacing
    doc.font('Helvetica').fontSize(12);
    doc.text("¡GRACIAS POR SU COMPRA!", margin, currentY, {
        width: usableWidth,
        align: 'center',
        characterSpacing: 1.5 // Separate letters
    });
    currentY += lineHeight + 5; // Extra space between lines

    textLine("Vuelva pronto", { align: 'center', size: 11 });

    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
    });
}
