import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const inputSchema = z.object({
    orderId: z.coerce.number().int().positive(),
    amountPaid: z.union([z.number(), z.string()]).transform(val => parseFloat(val as string) || 0).optional(),
    totalAmount: z.number().nonnegative(),
    paymentMethod: z.string().optional().default('efectivo')
});

export async function POST(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de pago inválidos' }, { status: 400 });
        }

        const { orderId, amountPaid, totalAmount, paymentMethod } = parsed.data;

        const paid = amountPaid || totalAmount;
        const change = Math.max(0, paid - totalAmount);

        const { data, error } = await supabaseAdmin
            .from('orders')
            .update({ 
                status: 'entregado',
                payment_status: 'paid',
                payment_method: paymentMethod,
                pago_con: paid,
                cambio: change,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select();

        if (error) throw error;
        
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return handleServerError(error, 'Cashier Process Payment Error');
    }
}

