import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
    userId: z.string().uuid().nullable().optional()
});

export async function GET(req: Request) {
    try {
        const { errorResponse, user } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse || !user) return errorResponse;

        // 1. Obtener Cuentas Abiertas (Pendientes, Preparando, Listo) - Filtrado siempre por el cajero actual
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
            .neq('payment_status', 'paid')
            .eq('user_id', user.id);

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

        // Si no es administrador, ver únicamente su propio historial
        if (user.role !== 'administrador') {
            queryHistory = queryHistory.eq('user_id', user.id);
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

