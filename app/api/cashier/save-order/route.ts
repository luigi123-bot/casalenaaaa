import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const orderItemSchema = z.object({
    product_name: z.string(),
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    selected_size: z.string().nullable().optional(),
    extras: z.array(z.any()).nullable().optional(),
    notes: z.string().nullable().optional()
});

const orderSchema = z.object({
    id: z.string().uuid().nullable().optional(),
    customer_name: z.string().nullable().optional(),
    phone_number: z.string().nullable().optional(),
    order_type: z.enum(['local', 'takeout', 'delivery']),
    table_number: z.coerce.number().int().nullable().optional(),
    delivery_address: z.string().nullable().optional(),
    delivery_zone: z.string().nullable().optional(),
    delivery_cost: z.number().nonnegative().optional().default(0),
    total_amount: z.number().nonnegative(),
    payment_method: z.string().optional().default('efectivo'),
    payment_status: z.enum(['pending', 'paid', 'partially_paid']).optional().default('pending'),
    status: z.enum(['pendiente', 'confirmado', 'preparando', 'listo', 'entregado', 'cancelado', 'completado']).optional().default('pendiente'),
    user_id: z.string().uuid().nullable().optional()
}).passthrough();

const inputSchema = z.object({
    order: orderSchema,
    items: z.array(orderItemSchema)
});

export async function POST(req: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const body = await req.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de orden o items inválidos' }, { status: 400 });
        }

        const { order, items } = parsed.data;

        // 1. GESTIÓN AUTOMÁTICA DE CLIENTE (Upsert)
        if ((order.order_type === 'delivery' || order.order_type === 'takeout') && order.phone_number) {
            try {
                const phoneClean = order.phone_number.replace(/\D/g, '');
                if (phoneClean.length >= 7) {
                    await supabaseAdmin
                        .from('customers')
                        .upsert({
                            phone: phoneClean,
                            full_name: order.customer_name || 'Cliente Nuevo',
                            address: order.delivery_address || '',
                            last_order_at: new Date().toISOString()
                        }, { onConflict: 'phone' });
                }
            } catch (err) {
                // Ignore silent non-critical client upsert fail
            }
        }

        // 2. GUARDAR LA ORDEN
        let orderId = order.id;
        let createdOrder = null;

        if (orderId) {
            // Actualizar orden existente
            const { data, error } = await supabaseAdmin
                .from('orders')
                .update({
                    ...order,
                    updated_at: new Date().toISOString()
                })
                .eq('id', orderId)
                .select()
                .single();

            if (error) throw error;
            createdOrder = data;

            // Limpiar items anteriores para re-insertar
            await supabaseAdmin.from('order_items').delete().eq('order_id', orderId);
        } else {
            // Nueva orden
            let lastSessionStart = new Date().toLocaleDateString('en-CA') + 'T00:00:00';
            
            try {
                const { data: lastSession } = await supabaseAdmin
                    .from('cashier_sessions')
                    .select('opened_at')
                    .order('opened_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                if (lastSession?.opened_at) {
                    lastSessionStart = lastSession.opened_at;
                }
            } catch (err) {
                // Silent catch
            }

            const { data: ticketData } = await supabaseAdmin
                .from('orders')
                .select('ticket_number')
                .gte('created_at', lastSessionStart)
                .order('ticket_number', { ascending: true });

            let dailySequence = 1;
            if (ticketData && ticketData.length > 0) {
                const usedNumbers = new Set(ticketData.map(o => Number(o.ticket_number)));
                while (usedNumbers.has(dailySequence)) {
                    dailySequence++;
                }
            }

            const { data, error } = await supabaseAdmin
                .from('orders')
                .insert({
                    ...order,
                    ticket_number: dailySequence,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;
            createdOrder = data;
            orderId = data.id;
        }

        // 3. GUARDAR ITEMS
        const itemsWithOrderId = items.map((it: any) => ({
            ...it,
            order_id: orderId
        }));

        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .insert(itemsWithOrderId);

        if (itemsError) throw itemsError;

        return NextResponse.json({
            success: true,
            order: createdOrder
        });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Save Order API Error');
    }
}

