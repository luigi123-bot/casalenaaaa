
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

export async function GET(req: Request) {
    try {
        // Siempre usamos el inicio del día actual en horario México (UTC-6)
        // Esto garantiza que se incluyan TODOS los pedidos del día, 
        // independientemente de la hora exacta de apertura de caja.
        const now = new Date();
        const mxOffset = -6; // UTC-6
        const mxNow = new Date(now.getTime() + mxOffset * 3600 * 1000);
        const startOfDayMx = new Date(mxNow);
        startOfDayMx.setUTCHours(0, 0, 0, 0);
        // Convertir de vuelta a UTC para la query
        const filterStart = new Date(startOfDayMx.getTime() - mxOffset * 3600 * 1000).toISOString();

        console.log(`[API-Cierre] Consultando TODOS los pedidos desde: ${filterStart}`);

        // ⚠️ NO filtramos por user_id porque los pedidos se crean con user_id: null.
        // Se incluyen todos los pedidos desde la apertura de caja hasta ahora.
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, ticket_number, total_amount, payment_method, order_type, status, created_at, order_items(product_name, quantity)')
            .gte('created_at', filterStart)
            .neq('status', 'cancelado'); // Excluimos cancelados del total, pero los contamos aparte

        if (error) throw error;

        console.log(`[API-Cierre] 📦 Pedidos encontrados para el cierre: ${orders?.length || 0}`);
        if (orders && orders.length > 0) {
            const statusSummary = orders.reduce((acc: any, o: any) => {
                acc[o.status] = (acc[o.status] || 0) + 1;
                return acc;
            }, {});
            console.log(`[API-Cierre] Resumen de estados encontrados:`, statusSummary);
        }

        const summary = {
            totalVentas: 0,
            totalOrdenes: 0,
            ventasEfectivo: 0,
            ventasTarjeta: 0,
            ventasOtro: 0,
            totalProductos: 0,
            ordenesPorTipo: [] as any[],
            topProductos: [] as any[],
            ticketPromedio: 0,
            fechaTurno: now.toLocaleDateString('es-MX', { day: '2-digit', month: 'long' }),
            ordenesList: [] as any[],
            canceladas: { count: 0, total: 0 },
            ventasPorHora: Array(24).fill(0).map((_, i) => ({ hora: i, total: 0, count: 0 }))
        };

        const productMap: Record<string, number> = {};
        const tipoMap: Record<string, { count: number, total: number }> = {};

        orders?.forEach((order: any) => {
            const total = parseFloat(order.total_amount) || 0;
            const hour = new Date(order.created_at).getHours();

            // Los pedidos cancelados se cuentan aparte y no suman a la venta total
            if (order.status === 'cancelado') {
                summary.canceladas.count += 1;
                summary.canceladas.total += total;
            } else {
                // Incluimos TODO lo demás (entregado, listo, preparando, pendiente, etc.)
                // tal como solicitó el usuario ("independiente si se pagaron o siguen en cocina")
                summary.totalVentas += total;
                summary.totalOrdenes += 1;

                // Ventas por hora
                summary.ventasPorHora[hour].total += total;
                summary.ventasPorHora[hour].count += 1;

                // Por método de pago
                const method = (order.payment_method || 'efectivo').toLowerCase();
                if (method.includes('efectivo')) summary.ventasEfectivo += total;
                else if (method.includes('tarjeta')) summary.ventasTarjeta += total;
                else if (method.includes('transfer')) summary.ventasOtro += total;
                else summary.ventasEfectivo += total;

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
            }

            // Agregar a la lista de órdenes (incluyendo cancelados para transparencia)
            summary.ordenesList.push({
                id: order.id,
                ticket: order.ticket_number,
                total: total,
                metodo: order.payment_method || 'N/A',
                tipo: order.order_type,
                status: order.status,
                hora: new Date(order.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
            });
        });

        // Formatear mapas a arrays
        summary.topProductos = Object.entries(productMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
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
