import jsPDF from 'jspdf';

interface TicketData {
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
        cliente?: {
            nombre: string;
            telefono: string;
            direccion: string;
        } | null;
    };
    productos: Array<{
        cantidad: number;
        nombre: string;
        precio: number;
        detalle?: string;
    }>;
}

export function generateTicketPDFClient(data: TicketData): string {
    const { comercio, pedido, productos } = data;

    // 58mm width in points
    const width = 164.4;

    // Calculate height dynamically
    let contentHeight = 85; // Header + date
    if (pedido.mesa) contentHeight += 55;
    contentHeight += 55; // Order number section
    contentHeight += 20; // Product header
    contentHeight += productos.length * 16;
    productos.forEach(p => { if (p.detalle) contentHeight += 12; });
    contentHeight += 65; // Totals
    contentHeight += 55; // Notes
    if (pedido.cliente) contentHeight += 50;
    contentHeight += 35; // Footer

    const height = contentHeight;

    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: [width, height]
    });

    let y = 10;
    const margin = 12; // Increased to 12 to prevent cutoff and center content
    const contentWidth = width - (margin * 2);

    // Helper to draw dashed line
    const drawDashedLine = (yPos: number) => {
        doc.setLineWidth(0.3);
        const dashLength = 2;
        const gapLength = 2;
        let x = margin;
        while (x < width - margin) {
            doc.line(x, yPos, Math.min(x + dashLength, width - margin), yPos);
            x += dashLength + gapLength;
        }
    };

    // ==================== HEADER ====================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('CASALEÑA', width / 2, y, { align: 'center', charSpace: 2 });
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Blvd. Juan N Alvarez, CP 41706', width / 2, y, { align: 'center' });
    y += 8;
    doc.text('Tel: 741-101-1595', width / 2, y, { align: 'center' });
    y += 10;

    // Dashed separator
    drawDashedLine(y);
    y += 8;

    // ==================== DATE & TIME ====================
    const now = new Date();
    const fecha = now.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });

    doc.setFontSize(7);
    doc.text(`Fecha: ${fecha}`, margin, y);
    doc.text(hora, width - margin, y, { align: 'right' });
    y += 10;

    // ==================== ORDER TYPE ====================
    if (pedido.tipo) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(pedido.tipo.toUpperCase(), width / 2, y, { align: 'center' });
        y += 12;
        doc.setFont('helvetica', 'normal');
    }

    // ==================== TABLE NUMBER ====================
    if (pedido.mesa) {
        drawDashedLine(y);
        y += 10;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(34);
        doc.text(pedido.mesa, width / 2, y, { align: 'center' });
        y += 12;
        doc.setFont('helvetica', 'normal');

        drawDashedLine(y);
        y += 8;
    }

    // ==================== ORDER NUMBER ====================
    const orderId = pedido.id.toString().padStart(5, '0');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text(orderId, width / 2, y, { align: 'center' });
    y += 12;
    doc.setFont('helvetica', 'normal');

    drawDashedLine(y);
    y += 10;

    // ==================== PRODUCTS ====================
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('Ct', margin, y);
    doc.text('Producto', margin + 15, y);
    doc.text('Total', width - margin, y, { align: 'right' });
    y += 9;
    doc.setFont('helvetica', 'normal');

    doc.setFontSize(8);
    productos.forEach((p) => {
        const cant = p.cantidad.toString();
        let nombre = p.nombre;
        if (nombre.length > 18) nombre = nombre.substring(0, 18);
        const precio = `$${p.precio.toFixed(2)}`;

        doc.text(cant, margin + 2, y);
        doc.text(nombre, margin + 15, y);
        doc.text(precio, width - margin, y, { align: 'right' });
        y += 9;

        if (p.detalle) {
            doc.setFontSize(7);
            doc.setTextColor(80);
            doc.text(`  (${p.detalle})`, margin + 15, y);
            doc.setTextColor(0);
            doc.setFontSize(8);
            y += 8;
        }
    });

    y += 3;
    drawDashedLine(y);
    y += 10;

    // ==================== TOTALS ====================
    doc.setFontSize(8);
    doc.text('SUBTOTAL:', margin, y);
    doc.text(`$${pedido.subtotal.toFixed(2)}`, width - margin, y, { align: 'right' });
    y += 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('TOTAL:', margin, y);
    doc.text(`$${pedido.total.toFixed(2)}`, width - margin, y, { align: 'right' });
    y += 12;
    doc.setFont('helvetica', 'normal');

    doc.setFontSize(8);
    doc.text(`PAGO: ${pedido.metodo_pago.toUpperCase()}`, margin, y);
    y += 10;

    if (pedido.metodo_pago.toUpperCase() === 'EFECTIVO' && pedido.pago_con) {
        doc.setFontSize(7);
        doc.text('Pago con:', margin, y);
        doc.text(`$${pedido.pago_con.toFixed(2)}`, width - margin, y, { align: 'right' });
        y += 9;

        doc.text('Cambio:', margin, y);
        doc.text(`$${(pedido.cambio || 0).toFixed(2)}`, width - margin, y, { align: 'right' });
        y += 10;
    }

    drawDashedLine(y);
    y += 10;

    // ==================== CUSTOMER INFO ====================
    if (pedido.cliente) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('DATOS CLIENTE:', margin, y);
        y += 9;
        doc.setFont('helvetica', 'normal');

        doc.text(pedido.cliente.nombre, margin, y);
        y += 8;
        doc.text(pedido.cliente.telefono, margin, y);
        y += 8;

        const direccionLines = doc.splitTextToSize(pedido.cliente.direccion, contentWidth);
        doc.text(direccionLines, margin, y);
        y += direccionLines.length * 8 + 5;

        drawDashedLine(y);
        y += 10;
    }

    // ==================== NOTES ====================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('NOTAS:', margin, y);
    y += 9;
    doc.setFont('helvetica', 'normal');

    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(margin + 2, y, contentWidth - 4, 28);
    y += 33;

    drawDashedLine(y);
    y += 12;

    // ==================== FOOTER ====================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('¡GRACIAS POR SU COMPRA!', width / 2, y, { align: 'center', charSpace: 1 });
    y += 9;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Vuelva pronto', width / 2, y, { align: 'center' });

    return doc.output('dataurlstring');
}
