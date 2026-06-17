import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const orderItemSchema = z.object({
    product_name: z.string(),
    product_id: z.coerce.number().int().nonnegative().nullable().optional(),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    selected_size: z.string().nullable().optional(),
    extras: z.array(z.any()).nullable().optional(),
    notes: z.string().nullable().optional(),
    total_price: z.number().nonnegative().nullable().optional()
});

const orderSchema = z.object({
    id: z.coerce.number().int().nullable().optional(),
    customer_name: z.string().nullable().optional(),
    phone_number: z.string().nullable().optional(),
    order_type: z.enum(['local', 'takeout', 'delivery', 'dine-in', 'pickup']),
    table_number: z.coerce.number().int().nullable().optional(),
    delivery_address: z.string().nullable().optional(),
    delivery_zone: z.string().nullable().optional(),
    delivery_cost: z.number().nonnegative().optional().default(0),
    total_amount: z.number().nonnegative(),
    payment_method: z.string().optional().default('efectivo'),
    payment_status: z.enum(['pending', 'paid', 'partially_paid']).optional().default('pending'),
    status: z.enum(['pendiente', 'confirmado', 'preparando', 'listo', 'entregado', 'cancelado', 'completado', 'en_camino']).optional().default('pendiente'),
    user_id: z.string().uuid().nullable().optional(),
    cashier_name: z.string().nullable().optional()
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
                    const { error: upsertError } = await supabaseAdmin
                        .from('customers')
                        .upsert({
                            phone: phoneClean,
                            full_name: order.customer_name || 'Cliente Nuevo',
                            address: order.delivery_address || '',
                            last_order_at: new Date().toISOString()
                        }, { onConflict: 'phone' });

                    // ✅ FIX: Antes el catch era silencioso — ahora se registra para diagnóstico.
                    // El error más común es que la columna `phone` no tiene restricción UNIQUE
                    // en Supabase, lo que hace fallar el upsert con onConflict.
                    if (upsertError) {
                        console.error('[SaveOrder] ⚠️ Error al guardar cliente (no crítico):', {
                            message: upsertError.message,
                            code: upsertError.code,
                            hint: upsertError.hint,
                            phone: phoneClean.slice(0, 3) + '***' // Parcialmente enmascarado por privacidad
                        });
                    }
                }
            } catch (err: any) {
                // ✅ FIX: Registrar errores inesperados (red, permisos, etc.)
                console.error('[SaveOrder] ⚠️ Excepción al guardar cliente (no crítico):', err?.message);
            }
        }

        // 2. GUARDAR LA ORDEN
        let orderId = order.id;
        let createdOrder = null;

        // Omitir columnas que podrían no existir en la base de datos de órdenes
        const { delivery_cost, delivery_zone, ...orderPayloadToDb } = order;

        if (orderId) {
            // Actualizar orden existente
            const { data, error } = await supabaseAdmin
                .from('orders')
                .update({
                    ...orderPayloadToDb,
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
            // Nueva orden — número de ticket DIARIO
            // ✅ Contador basado en el día actual en zona horaria de México (UTC-6 permanente).
            // Desde 2023 México no tiene cambio de horario, por lo que UTC-6 es fijo.
            // Esto garantiza que el contador se reinicia a las 12:00am hora local cada día,
            // independientemente de cuántas sesiones de caja se abran durante el turno.
            const now = new Date();
            const mexicoDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
            // Medianoche México (UTC-6) = 06:00 UTC del mismo día
            const dayStartISO = new Date(mexicoDateStr + 'T06:00:00.000Z').toISOString();

            const { data: todayOrders } = await supabaseAdmin
                .from('orders')
                .select('ticket_number')
                .gte('created_at', dayStartISO)
                .not('ticket_number', 'is', null)
                .order('ticket_number', { ascending: true });

            let dailySequence = 1;
            if (todayOrders && todayOrders.length > 0) {
                const usedNumbers = new Set(todayOrders.map(o => Number(o.ticket_number)));
                while (usedNumbers.has(dailySequence)) {
                    dailySequence++;
                }
            }

            const { data, error } = await supabaseAdmin
                .from('orders')
                .insert({
                    ...orderPayloadToDb,
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
        console.error("🛑 [SaveOrder API Error]:", error);
        return NextResponse.json({ error: error.message || error.details || String(error) }, { status: 500 });
    }
}

