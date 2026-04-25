
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function GET() {
    try {

        // 1. Calcular rango de fecha (Hoy Local 00:00)
        // Nota: El servidor corre en UTC, pero queremos el "Hoy" del restaurante (MX -6h)
        // Para simplificar y ser precisos, usamos el desplazamiento de México
        const now = new Date();
        const mxOffset = -6; // UTC-6
        const mxTime = new Date(now.getTime() + mxOffset * 3600 * 1000);
        
        const startOfDay = new Date(mxTime);
        startOfDay.setUTCHours(0, 0, 0, 0);
        
        // Ajustar de vuelta a UTC para la base de datos
        const utcStart = new Date(startOfDay.getTime() - mxOffset * 3600 * 1000).toISOString();

        console.log(`[API-Cierre] Consultando ventas desde (UTC): ${utcStart}`);

        // 2. Consultar pedidos
        const validStatuses = ['entregado', 'completado', 'listo', 'finalizado', 'confirmado'];
        
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, total_amount, payment_method, order_type, created_at, order_items(product_name, quantity)')
            .gte('created_at', utcStart)
            .in('status', validStatuses);

        if (error) throw error;

        // 3. Procesar cálculos en el servidor
        const summary = {
            totalVentas: 0,
            totalOrdenes: orders?.length || 0,
            ventasEfectivo: 0,
            ventasTarjeta: 0,
            ventasOtro: 0,
            totalProductos: 0,
            ordenesPorTipo: [] as any[],
            topProductos: [] as any[],
            ticketPromedio: 0,
            fechaTurno: now.toLocaleDateString('es-MX', { day: '2-digit', month: 'long' })
        };

        const productMap: Record<string, number> = {};
        const tipoMap: Record<string, { count: number, total: number }> = {};

        orders?.forEach((order: any) => {
            const total = parseFloat(order.total_amount) || 0;
            summary.totalVentas += total;

            // Por método de pago
            const method = (order.payment_method || '').toLowerCase();
            if (method.includes('efectivo')) summary.ventasEfectivo += total;
            else if (method.includes('tarjeta')) summary.ventasTarjeta += total;
            else if (method.includes('transfer')) summary.ventasOtro += total;
            else summary.ventasEfectivo += total; // Fallback

            // Por tipo
            const tipo = order.order_type || 'comedor';
            if (!tipoMap[tipo]) tipoMap[tipo] = { count: 0, total: 0 };
            tipoMap[tipo].count += 1;
            tipoMap[tipo].total += total;

            // Productos
            (order.order_items as any[])?.forEach((item: any) => {
                const name = item.product_name || 'Producto';
                const qty = item.quantity || 1;
                productMap[name] = (productMap[name] || 0) + qty;
                summary.totalProductos += qty;
            });
        });

        // Formatear mapas a arrays
        summary.topProductos = Object.entries(productMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, qty]) => ({ name, qty }));

        summary.ordenesPorTipo = Object.entries(tipoMap)
            .map(([tipo, v]) => ({ tipo, count: v.count, total: v.total }));

        summary.ticketPromedio = summary.totalOrdenes > 0 
            ? summary.totalVentas / summary.totalOrdenes : 0;

        return NextResponse.json(summary);

    } catch (error: any) {
        console.error('[API-Cierre] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
