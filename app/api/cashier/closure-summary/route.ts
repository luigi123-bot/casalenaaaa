
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
        const now = new Date();
        const { searchParams } = new URL(req.url);
        const sessionId = searchParams.get('sessionId');
        const userId = searchParams.get('userId');

        let filterStart = "";
        let filterUser = userId;

        // Si tenemos sesión, obtenemos la fecha exacta de apertura
        if (sessionId) {
            const { data: session } = await supabase
                .from('cashier_sessions')
                .select('opened_at, user_id')
                .eq('id', sessionId)
                .single();
            
            if (session) {
                filterStart = session.opened_at;
                if (!filterUser) filterUser = session.user_id;
            }
        }

        // Fallback a inicio del día si no hay sesión
        if (!filterStart) {
            const mxOffset = -6; // UTC-6
            const mxTime = new Date(now.getTime() + mxOffset * 3600 * 1000);
            const startOfDay = new Date(mxTime);
            startOfDay.setUTCHours(0, 0, 0, 0);
            filterStart = new Date(startOfDay.getTime() - mxOffset * 3600 * 1000).toISOString();
        }

        console.log(`[API-Cierre] Consultando ventas para user:${filterUser || 'all'} desde: ${filterStart}`);

        let query = supabase
            .from('orders')
            .select('id, ticket_number, total_amount, payment_method, order_type, status, created_at, order_items(product_name, quantity)')
            .gte('created_at', filterStart);

        if (filterUser) {
            query = query.eq('user_id', filterUser);
        }

        const { data: orders, error } = await query;
        if (error) throw error;

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
        const validStatuses = ['entregado', 'completado', 'listo', 'finalizado', 'confirmado'];

        orders?.forEach((order: any) => {
            const total = parseFloat(order.total_amount) || 0;
            const hour = new Date(order.created_at).getHours();

            if (order.status === 'cancelado') {
                summary.canceladas.count += 1;
                summary.canceladas.total += total;
                return;
            }

            if (!validStatuses.includes(order.status)) return;

            summary.totalVentas += total;
            summary.totalOrdenes += 1;

            // Ventas por hora
            summary.ventasPorHora[hour].total += total;
            summary.ventasPorHora[hour].count += 1;

            // Por método de pago
            const method = (order.payment_method || '').toLowerCase();
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

            // Agregar a la lista simplificada
            summary.ordenesList.push({
                id: order.id,
                ticket: order.ticket_number,
                total: total,
                metodo: order.payment_method,
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
