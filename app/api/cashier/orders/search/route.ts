
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
        const tableNumber = searchParams.get('table_number');

        if (!tableNumber) {
            return NextResponse.json({ error: 'Falta table_number' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('orders')
            .select('*, order_items(*)')
            .eq('table_number', tableNumber)
            .in('status', ['pendiente', 'preparando', 'listo'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        return NextResponse.json({ orders: data || [] });

    } catch (error: any) {
        console.error('❌ [API-SearchOrder] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
