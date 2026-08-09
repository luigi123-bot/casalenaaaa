import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
    sessionId: z.string().uuid().optional(),
    userId: z.string().uuid().nullable().optional()
});

export async function GET(req: Request) {
    try {
        const { errorResponse, user } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse || !user) return errorResponse;

        const { searchParams } = new URL(req.url);
        const parsed = querySchema.safeParse({
            sessionId: searchParams.get('sessionId') || undefined,
            userId: searchParams.get('userId') || null
        });

        if (!parsed.success) {
            return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
        }

        const { sessionId } = parsed.data;

        // IDOR: cajero solo puede ver su propia sesión. Admin puede ver cualquiera.
        const resolvedUserId = user.role === 'administrador'
            ? (parsed.data.userId || user.id)
            : user.id;

        // ─── Obtener la sesión activa para conocer opened_at (inicio del turno) ────
        let sessionOpenedAt: string | null = null;
        let sessionClosedAt: string | null = null;

        if (sessionId) {
            const { data: session, error: sessErr } = await supabaseAdmin
                .from('cashier_sessions')
                .select('id, opened_at, closed_at, user_id')
                .eq('id', sessionId)
                .single();

            if (sessErr || !session) {
                return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
            }

            // Verificar que la sesión pertenece al usuario (anti-IDOR)
            if (user.role !== 'administrador' && session.user_id !== resolvedUserId) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
            }

            sessionOpenedAt = session.opened_at;
            sessionClosedAt = session.closed_at || null;
        }

        // ─── Filtro de tiempo ─────────────────────────────────────────────────────
        // Si tenemos sessionId: filtrar desde el opened_at de esa sesión.
        // Fallback: inicio del día en horario México (UTC-6).
        const now = new Date();
        let filterStart: string;

        if (sessionOpenedAt) {
            filterStart = sessionOpenedAt; // Solo las ventas de ESTE turno
        } else {
            const mxOffset = -6;
            const mxNow = new Date(now.getTime() + mxOffset * 3600 * 1000);
            const startOfDayMx = new Date(mxNow);
            startOfDayMx.setUTCHours(0, 0, 0, 0);
            filterStart = new Date(startOfDayMx.getTime() - mxOffset * 3600 * 1000).toISOString();
        }

        // ─── Query de órdenes ──────────────────────────────────────────────────────
        // Filtrado estricto por user_id del cajero para evitar mezcla entre diferentes terminales/cajas.
        let ordersQuery = supabaseAdmin
            .from('orders')
            .select('id, ticket_number, total_amount, payment_method, order_type, status, created_at, user_id, order_items(product_name, quantity)')
            .eq('user_id', resolvedUserId)
            .gte('created_at', filterStart)
            .neq('status', 'cancelado');

        if (sessionClosedAt) {
            ordersQuery = ordersQuery.lte('created_at', sessionClosedAt);
        }

        const { data: orders, error } = await ordersQuery;



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

        orders?.forEach((order: any) => {
            const total = parseFloat(order.total_amount) || 0;
            const hour = new Date(order.created_at).getHours();

            if (order.status === 'cancelado') {
                summary.canceladas.count += 1;
                summary.canceladas.total += total;
            } else {
                summary.totalVentas += total;
                summary.totalOrdenes += 1;

                summary.ventasPorHora[hour].total += total;
                summary.ventasPorHora[hour].count += 1;

                const rawMethod = (order.payment_method || '').toLowerCase().trim();
                if (rawMethod.includes('efectivo') || rawMethod === 'cash') {
                    summary.ventasEfectivo += total;
                } else if (rawMethod.includes('tarjeta') || rawMethod === 'card') {
                    summary.ventasTarjeta += total;
                } else if (rawMethod.includes('transfer') || rawMethod.includes('transf')) {
                    summary.ventasOtro += total;
                } else {
                    // Método no registrado o desconocido — no afecta el cuadre de efectivo
                    summary.ventasOtro += total;
                }

                const tipo = order.order_type || 'comedor';
                if (!tipoMap[tipo]) tipoMap[tipo] = { count: 0, total: 0 };
                tipoMap[tipo].count += 1;
                tipoMap[tipo].total += total;

                (order.order_items as any[])?.forEach((item: any) => {
                    const name = item.product_name || 'Producto';
                    const qty = item.quantity || 1;
                    productMap[name] = (productMap[name] || 0) + qty;
                    summary.totalProductos += qty;
                });
            }

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
        return handleServerError(error, 'Cashier Closure Summary Error');
    }
}

