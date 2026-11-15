import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, requireSupabaseAdminConfig, supabaseAdmin } from "@/utils/supabase/server";
import { formatMexicoDate, formatMexicoTime, getMexicoDayStartISO, getMexicoHour, roundCurrency } from "@/utils/timezone";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
    sessionId: z.string().uuid().optional(),
    userId: z.string().uuid().nullable().optional(),
});

interface OrderItemRow {
    product_name?: string | null;
    quantity?: number | null;
}

interface OrderRow {
    id: number | string;
    ticket_number?: number | null;
    total_amount: number | string | null;
    payment_method?: string | null;
    order_type?: string | null;
    status?: string | null;
    created_at: string;
    order_items?: OrderItemRow[] | null;
}

export async function GET(req: Request) {
    try {
        const { errorResponse, user } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse || !user) return errorResponse;

        const configError = requireSupabaseAdminConfig();
        if (configError) return configError;

        const { searchParams } = new URL(req.url);
        const parsed = querySchema.safeParse({
            sessionId: searchParams.get('sessionId') || undefined,
            userId: searchParams.get('userId') || null,
        });

        if (!parsed.success) {
            return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
        }

        const { sessionId } = parsed.data;

        // IDOR: cajero solo puede ver su propia sesión. Admin puede ver cualquiera.
        let resolvedUserId = user.role === 'administrador'
            ? (parsed.data.userId || user.id)
            : user.id;

        // ─── Obtener la sesión activa para conocer opened_at y user_id ────
        let sessionOpenedAt: string | null = null;
        let sessionClosedAt: string | null = null;

        if (sessionId) {
            const { data: session, error: sessErr } = await supabaseAdmin
                .from('cashier_sessions')
                .select('id, opened_at, closed_at, user_id')
                .eq('id', sessionId)
                .maybeSingle();

            if (sessErr) throw sessErr;

            if (!session) {
                return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
            }

            if (user.role !== 'administrador' && session.user_id !== user.id) {
                return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
            }

            // Usar el dueño real de la sesión para evitar cruzar órdenes cuando un admin inspecciona otro turno
            resolvedUserId = session.user_id;
            sessionOpenedAt = session.opened_at;
            sessionClosedAt = session.closed_at || null;
        }

        // ─── Filtro de tiempo ─────────────────────────────────────────────────────
        const now = new Date();
        const filterStart = sessionOpenedAt || getMexicoDayStartISO(now);

        // ─── Query de órdenes ─────────────────────────────────────────────────────
        // Filtrado estricto por user_id del cajero para evitar mezcla entre terminales/cajas.
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
            ordenesPorTipo: [] as { tipo: string; count: number; total: number }[],
            topProductos: [] as { name: string; qty: number }[],
            ticketPromedio: 0,
            fechaTurno: formatMexicoDate(now),
            ordenesList: [] as {
                id: number | string;
                ticket: number | null | undefined;
                total: number;
                metodo: string;
                tipo: string | null | undefined;
                status: string | null | undefined;
                hora: string;
            }[],
            canceladas: { count: 0, total: 0 },
            ventasPorHora: Array.from({ length: 24 }, (_, i) => ({ hora: i, total: 0, count: 0 })),
        };

        const productMap: Record<string, number> = {};
        const tipoMap: Record<string, { count: number; total: number }> = {};

        (orders as OrderRow[] | null)?.forEach((order) => {
            const total = roundCurrency(Number(order.total_amount) || 0);
            const createdAt = new Date(order.created_at);
            const hour = getMexicoHour(createdAt);

            summary.totalVentas = roundCurrency(summary.totalVentas + total);
            summary.totalOrdenes += 1;

            if (hour !== null) {
                summary.ventasPorHora[hour].total = roundCurrency(summary.ventasPorHora[hour].total + total);
                summary.ventasPorHora[hour].count += 1;
            }

            const rawMethod = (order.payment_method || '').toLowerCase().trim();
            if (rawMethod.includes('efectivo') || rawMethod === 'cash') {
                summary.ventasEfectivo = roundCurrency(summary.ventasEfectivo + total);
            } else if (rawMethod.includes('tarjeta') || rawMethod === 'card') {
                summary.ventasTarjeta = roundCurrency(summary.ventasTarjeta + total);
            } else {
                // Transferencia o método no registrado — no afecta el cuadre de efectivo
                summary.ventasOtro = roundCurrency(summary.ventasOtro + total);
            }

            const tipo = order.order_type || 'comedor';
            if (!tipoMap[tipo]) tipoMap[tipo] = { count: 0, total: 0 };
            tipoMap[tipo].count += 1;
            tipoMap[tipo].total = roundCurrency(tipoMap[tipo].total + total);

            order.order_items?.forEach((item) => {
                const name = item.product_name || 'Producto';
                const qty = Number(item.quantity ?? 0);
                if (qty > 0) {
                    productMap[name] = (productMap[name] || 0) + qty;
                    summary.totalProductos += qty;
                }
            });

            summary.ordenesList.push({
                id: order.id,
                ticket: order.ticket_number,
                total,
                metodo: order.payment_method || 'N/A',
                tipo: order.order_type,
                status: order.status,
                hora: formatMexicoTime(createdAt),
            });
        });

        summary.topProductos = Object.entries(productMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, qty]) => ({ name, qty }));

        summary.ordenesPorTipo = Object.entries(tipoMap)
            .map(([tipo, v]) => ({ tipo, count: v.count, total: v.total }));

        summary.ticketPromedio = summary.totalOrdenes > 0
            ? roundCurrency(summary.totalVentas / summary.totalOrdenes)
            : 0;

        return NextResponse.json(summary);
    } catch (error: unknown) {
        return handleServerError(error, 'Cashier Closure Summary Error');
    }
}
