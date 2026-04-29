
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
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        // 1. Obtener Cuentas Abiertas (Pendientes, Preparando, Listo)
        let queryOpen = supabase
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
        let queryHistory = supabase
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
        console.error('❌ [API-ListOrders] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
