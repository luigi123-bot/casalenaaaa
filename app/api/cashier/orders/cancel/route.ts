
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

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Falta orderId' }, { status: 400 });
        }

        console.log(`🗑️ [API-CancelOrder] Cancelando orden: ${orderId}`);

        // 1. Eliminar items primero (Foreign Key constraint)
        const { error: itemsError } = await supabase
            .from('order_items')
            .delete()
            .eq('order_id', orderId);

        if (itemsError) throw itemsError;

        // 2. Eliminar la orden
        const { error: orderError } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (orderError) throw orderError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('❌ [API-CancelOrder] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
