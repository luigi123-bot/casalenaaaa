
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

export async function GET() {
    try {
        // 1. Obtener Cuentas Abiertas (Pendientes, Preparando, Listo)
        const { data: openData, error: openErr } = await supabase
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
            .order('created_at', { ascending: false });

        if (openErr) throw openErr;

        // 2. Obtener Historial Reciente (Entregado, Cancelado, Confirmado)
        const { data: historyData, error: historyErr } = await supabase
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
            .in('status', ['entregado', 'cancelado', 'confirmado'])
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
