import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
    userId: z.string().uuid().nullable().optional()
});

export async function GET(req: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(req.url);
        const parsed = querySchema.safeParse({
            userId: searchParams.get('userId') || null
        });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        const { userId } = parsed.data;

        // 1. Obtener Cuentas Abiertas (Pendientes, Preparando, Listo)
        let queryOpen = supabaseAdmin
            .from('orders')
            .select(`
                *,
                order_items (
                    product_name,
                    product_id,
                    quantity,
                    unit_price,
                    selected_size,
                    extras,
                    notes
                )
            `)
            .in('status', ['pendiente', 'preparando', 'listo'])
            .neq('payment_status', 'paid');

        if (userId) {
            queryOpen = queryOpen.eq('user_id', userId);
        }

        const { data: openData, error: openErr } = await queryOpen.order('created_at', { ascending: false });

        if (openErr) throw openErr;

        // 2. Obtener Historial Reciente (Entregado, Cancelado, Confirmado o cualquier Pagado)
        let queryHistory = supabaseAdmin
            .from('orders')
            .select(`
                *,
                order_items (
                    product_name,
                    product_id,
                    quantity,
                    unit_price,
                    selected_size,
                    extras,
                    notes
                )
            `)
            .or('status.in.(entregado,cancelado,confirmado),payment_status.eq.paid');

        if (userId) {
            queryHistory = queryHistory.eq('user_id', userId);
        }

        const { data: historyData, error: historyErr } = await queryHistory
            .order('created_at', { ascending: false })
            .limit(30);

        if (historyErr) throw historyErr;

        return NextResponse.json({
            success: true,
            openOrders: openData || [],
            history: historyData || []
        });

    } catch (error: any) {
        return handleServerError(error, 'Cashier List Orders API Error');
    }
}

