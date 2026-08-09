import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
    orderId: z.coerce.number().int().positive(),
    status: z.string().optional(),
    payment_status: z.string().optional(),
    payment_method: z.string().optional(),
    driver_id: z.coerce.number().int().nullable().optional(),
    delivery_status: z.string().optional(),
    cashier_name: z.string().nullable().optional(),
    user_id: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
    try {
        const { errorResponse, user } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;


        const body = await request.json().catch(() => ({}));
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de actualización inválidos' }, { status: 400 });
        }

        const { orderId, ...updates } = parsed.data;

        // Fetch old order details to check for driver updates
        const { data: oldOrder, error: oldOrderErr } = await supabaseAdmin
            .from('orders')
            .select('driver_id')
            .eq('id', orderId)
            .maybeSingle();

        if (oldOrderErr) throw oldOrderErr;

        // If status is entregado, payment_status should be paid
        if (updates.status === 'entregado') {
            updates.payment_status = 'paid';
        }

        // Si la actualización no trae user_id, vincular al cajero activo que realiza el cambio
        if (!updates.user_id && user?.id) {
            updates.user_id = user.id;
        }

        const { data, error } = await supabaseAdmin
            .from('orders')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select();

        if (error) throw error;

        // Handle driver status updates automatically
        if (updates.driver_id !== undefined) {
            const oldDriverId = oldOrder?.driver_id;
            const newDriverId = updates.driver_id;

            if (oldDriverId && oldDriverId !== newDriverId) {
                // Mark old driver as disponible
                await supabaseAdmin
                    .from('delivery_drivers')
                    .update({ status: 'disponible' })
                    .eq('id', oldDriverId);
            }

            if (newDriverId) {
                // Mark new driver as ocupado
                await supabaseAdmin
                    .from('delivery_drivers')
                    .update({ status: 'ocupado' })
                    .eq('id', newDriverId);
            }
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return handleServerError(error, 'Update Order API Error');
    }
}
