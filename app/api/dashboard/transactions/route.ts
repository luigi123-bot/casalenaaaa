import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    limit: z.coerce.number().int().positive().max(50).optional().default(10)
});

export async function GET(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            limit: searchParams.get('limit') || undefined
        });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        const { limit } = parsed.data;

        const { data: orders, error } = await supabaseAdmin
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

        if (error) throw error;

        const transactions = orders?.map(order => {
            const items = order.order_items?.map(item =>
                `${item.quantity}x ${item.product_name}`
            ).join(', ') || 'Sin items';

            return {
                id: `#${order.id}`,
                time: new Date(order.created_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                items,
                amount: `${parseFloat(order.total_amount || '0').toFixed(2)}`,
                status: order.status,
                paymentMethod: order.payment_method
            };
        }) || [];

        return NextResponse.json(transactions);

    } catch (error: any) {
        return handleServerError(error, 'Dashboard Transactions API Error');
    }
}

