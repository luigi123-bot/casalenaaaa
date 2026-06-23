import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    limit: z.coerce.number().int().positive().max(50).optional().default(10),
    range: z.enum(['today', 'week', 'month', 'year', 'all']).optional().default('all'),
});

export async function GET(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            limit: searchParams.get('limit') || undefined,
            range: searchParams.get('range') || undefined,
        });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        const { limit, range } = parsed.data;

        // ── Calcular el rango de fecha con soporte de Zona Horaria (tz) ──────
        const tz = searchParams.get('tz') || '-05:00';
        
        // Parsear offset para cálculos en hora local (ej. -05:00 -> -5 horas)
        const sign = tz.startsWith('+') ? 1 : -1;
        const offsetParts = tz.substring(1).split(':');
        const offsetHours = parseInt(offsetParts[0], 10) || 0;
        const offsetMinutes = parseInt(offsetParts[1], 10) || 0;
        const offsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;

        const now = new Date();
        const nowLocal = new Date(now.getTime() + offsetMs);
        const nowYear = nowLocal.getUTCFullYear();
        const nowMonth = nowLocal.getUTCMonth(); // 0-indexed
        const nowDate = nowLocal.getUTCDate();

        let startDateISO: string | null = null;

        if (range === 'today') {
            startDateISO = `${nowYear}-${String(nowMonth + 1).padStart(2, '0')}-${String(nowDate).padStart(2, '0')}T00:00:00${tz}`;
        } else if (range === 'week') {
            const startLocal = new Date(now.getTime() - 7 * 24 * 3600 * 1000 + offsetMs);
            startDateISO = `${startLocal.getUTCFullYear()}-${String(startLocal.getUTCMonth() + 1).padStart(2, '0')}-${String(startLocal.getUTCDate()).padStart(2, '0')}T00:00:00${tz}`;
        } else if (range === 'month') {
            startDateISO = `${nowYear}-${String(nowMonth + 1).padStart(2, '0')}-01T00:00:00${tz}`;
        } else if (range === 'year') {
            startDateISO = `${nowYear}-01-01T00:00:00${tz}`;
        }

        // ── Query con o sin filtro de fecha ──────────────────────────────────
        let query = supabaseAdmin
            .from('orders')
            .select(`
                id,
                total_amount,
                status,
                payment_method,
                created_at,
                order_items (
                    quantity,
                    product_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (startDateISO) {
            query = query.gte('created_at', startDateISO);
        }

        const { data: orders, error } = await query;

        if (error) throw error;

        const transactions = orders?.map(order => {
            const items = order.order_items?.map(item =>
                `${item.quantity}x ${item.product_name}`
            ).join(', ') || 'Sin items';

            const orderDate = new Date(order.created_at);

            // Mostrar fecha y hora para contexto temporal
            const isToday = orderDate.toDateString() === now.toDateString();
            const timeStr = orderDate.toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
            const dateStr = orderDate.toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'short',
            });

            return {
                id: `#${order.id}`,
                time: timeStr,
                date: isToday ? 'Hoy' : dateStr,
                datetime: order.created_at,
                items,
                amount: `${parseFloat(order.total_amount || '0').toFixed(2)}`,
                status: order.status,
                paymentMethod: order.payment_method,
            };
        }) || [];

        return NextResponse.json(transactions);

    } catch (error: any) {
        return handleServerError(error, 'Dashboard Transactions API Error');
    }
}
