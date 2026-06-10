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

        // ── Calcular el rango de fecha si se solicita ────────────────────────
        const now = new Date();
        let startDate: Date | null = null;

        if (range === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        } else if (range === 'week') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
        } else if (range === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (range === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
        }
        // range === 'all' → sin filtro de fecha

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

        if (startDate) {
            query = query.gte('created_at', startDate.toISOString());
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
