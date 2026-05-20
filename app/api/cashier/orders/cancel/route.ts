import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
    orderId: z.string().uuid()
});

export async function POST(req: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const body = await req.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de orden inválidos' }, { status: 400 });
        }

        const { orderId } = parsed.data;

        // 1. Eliminar items primero (Foreign Key constraint)
        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .delete()
            .eq('order_id', orderId);

        if (itemsError) throw itemsError;

        // 2. Eliminar la orden
        const { error: orderError } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (orderError) throw orderError;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Cancel Order Error');
    }
}

