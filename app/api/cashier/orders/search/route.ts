import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(req.url);
        const tableNumber = searchParams.get('table_number');

        if (!tableNumber || isNaN(Number(tableNumber))) {
            return NextResponse.json({ error: 'Falta número de mesa válido' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('orders')
            .select('*, order_items(*)')
            .eq('table_number', tableNumber)
            .in('status', ['pendiente', 'preparando', 'listo'])
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;

        return NextResponse.json({ orders: data || [] });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Search Order API Error');
    }
}

