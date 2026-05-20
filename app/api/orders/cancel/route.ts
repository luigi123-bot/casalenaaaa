import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    orderId: z.string().uuid()
});

export async function POST(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Order ID es inválido' }, { status: 400 });
        }

        const { orderId } = parsed.data;

        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return handleServerError(error, 'Cancel Order API Error');
    }
}

