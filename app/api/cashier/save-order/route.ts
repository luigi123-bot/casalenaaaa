import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, requireSupabaseAdminConfig, supabaseAdmin } from "@/utils/supabase/server";
import { upsertCustomerSafe } from "@/utils/cashier/customers";
import { getMexicoDayStartISO } from "@/utils/timezone";
import { z } from "zod";

export const dynamic = "force-dynamic";

const optionalPositiveInt = z.preprocess(
    (val) => (val === '' || val === undefined ? null : val),
    z.coerce.number().int().positive().nullable().optional()
);

const orderItemSchema = z.object({
    product_name: z.string().min(1),
    product_id: z.preprocess(
        (val) => (val === '' || val === undefined ? null : val),
        z.coerce.number().int().nonnegative().nullable().optional()
    ),
    quantity: z.number().int().positive(),
    unit_price: z.number().nonnegative(),
    selected_size: z.string().nullable().optional(),
    extras: z.array(z.unknown()).nullable().optional(),
    notes: z.string().nullable().optional(),
    total_price: z.number().nonnegative().nullable().optional(),
});

const orderSchema = z.object({
    id: optionalPositiveInt,
    customer_name: z.string().nullable().optional(),
    phone_number: z.string().nullable().optional(),
    order_type: z.enum(['local', 'takeout', 'delivery', 'dine-in', 'pickup']),
    table_number: z.preprocess(
        (val) => (val === '' || val === undefined ? null : val),
        z.coerce.number().int().nonnegative().nullable().optional()
    ),
    delivery_address: z.string().nullable().optional(),
    total_amount: z.number().nonnegative(),
    tax_amount: z.number().nonnegative().optional().default(0),
    payment_method: z.string().optional().default('efectivo'),
    payment_status: z.enum(['pending', 'paid', 'partially_paid']).optional().default('pending'),
    status: z.enum(['pendiente', 'confirmado', 'preparando', 'listo', 'entregado', 'cancelado', 'completado', 'en_camino']).optional().default('pendiente'),
    user_id: z.string().uuid().nullable().optional(),
    cashier_name: z.string().nullable().optional(),
    pago_con: z.number().nonnegative().nullable().optional(),
    cambio: z.number().nonnegative().nullable().optional(),
});

const inputSchema = z.object({
    order: orderSchema,
    items: z.array(orderItemSchema).min(1),
});

export async function POST(req: Request) {
    try {
        const { errorResponse, user } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse || !user) return errorResponse;

        const configError = requireSupabaseAdminConfig();
        if (configError) return configError;

        const body = await req.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de orden o items inválidos' }, { status: 400 });
        }

        const { order, items } = parsed.data;

        // 1. GESTIÓN AUTOMÁTICA DE CLIENTE (no crítica si falla)
        if ((order.order_type === 'delivery' || order.order_type === 'takeout') && order.phone_number) {
            try {
                await upsertCustomerSafe(supabaseAdmin, {
                    phone: order.phone_number,
                    fullName: order.customer_name,
                    address: order.delivery_address,
                    minDigits: 7,
                });
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error('[SaveOrder] ⚠️ Excepción al guardar cliente (no crítico):', msg);
            }
        }

        // 2. CONSTRUIR PAYLOAD PERMITIDO PARA LA ORDEN
        const resolvedUserId = order.user_id || user.id;
        const nowISO = new Date().toISOString();

        const baseOrderColumns = {
            customer_name: order.customer_name ?? null,
            phone_number: order.phone_number ?? null,
            order_type: order.order_type,
            table_number: order.table_number ?? null,
            delivery_address: order.delivery_address ?? null,
            total_amount: order.total_amount,
            tax_amount: order.tax_amount,
            payment_method: order.payment_method,
            payment_status: order.payment_status,
            status: order.status,
            user_id: resolvedUserId,
            cashier_name: order.cashier_name ?? null,
            ...(order.pago_con !== undefined ? { pago_con: order.pago_con } : {}),
            ...(order.cambio !== undefined ? { cambio: order.cambio } : {}),
        };

        let orderId = order.id ?? null;
        let createdOrder = null;

        const buildItemsPayload = (targetOrderId: number) =>
            items.map((it) => ({
                ...it,
                total_price: it.total_price ?? it.quantity * it.unit_price,
                order_id: targetOrderId,
            }));

        if (orderId) {
            const { data: existingOrder, error: existingErr } = await supabaseAdmin
                .from('orders')
                .select('id')
                .eq('id', orderId)
                .maybeSingle();

            if (existingErr) throw existingErr;
            if (!existingOrder) {
                return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
            }

            const { data, error } = await supabaseAdmin
                .from('orders')
                .update({
                    ...baseOrderColumns,
                    updated_at: nowISO,
                })
                .eq('id', orderId)
                .select()
                .single();

            if (error) throw error;
            createdOrder = data;

            // Respaldar items previos por si falla la inserción de los nuevos
            const { data: previousItems } = await supabaseAdmin
                .from('order_items')
                .select('product_name, product_id, quantity, unit_price, selected_size, extras, notes, total_price')
                .eq('order_id', orderId);

            const { error: deleteItemsErr } = await supabaseAdmin
                .from('order_items')
                .delete()
                .eq('order_id', orderId);

            if (deleteItemsErr) throw deleteItemsErr;

            const { error: itemsError } = await supabaseAdmin
                .from('order_items')
                .insert(buildItemsPayload(orderId));

            if (itemsError) {
                if (previousItems && previousItems.length > 0) {
                    await supabaseAdmin
                        .from('order_items')
                        .insert(previousItems.map((it) => ({ ...it, order_id: orderId })));
                }
                throw itemsError;
            }
        } else {
            const dayStartISO = getMexicoDayStartISO();

            // ─── PROTECCIÓN ANTI-DUPLICADO (idempotencia 3s) ────────────────
            const threeSecondsAgo = new Date(Date.now() - 3000).toISOString();
            const { data: recentDuplicate } = await supabaseAdmin
                .from('orders')
                .select('*')
                .eq('user_id', resolvedUserId)
                .eq('total_amount', baseOrderColumns.total_amount)
                .gte('created_at', threeSecondsAgo)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (recentDuplicate) {
                console.warn(`[SaveOrder] ⚠️ Posible duplicado detectado — devolviendo orden existente ID: ${recentDuplicate.id}`);
                return NextResponse.json({ success: true, order: recentDuplicate, duplicate: true });
            }

            const { data: todayOrders, error: ticketErr } = await supabaseAdmin
                .from('orders')
                .select('ticket_number')
                .gte('created_at', dayStartISO)
                .not('ticket_number', 'is', null)
                .order('ticket_number', { ascending: true });

            if (ticketErr) throw ticketErr;

            let dailySequence = 1;
            if (todayOrders && todayOrders.length > 0) {
                const usedNumbers = new Set(todayOrders.map((o) => Number(o.ticket_number)));
                while (usedNumbers.has(dailySequence)) {
                    dailySequence++;
                }
            }

            const { data, error } = await supabaseAdmin
                .from('orders')
                .insert({
                    ...baseOrderColumns,
                    ticket_number: dailySequence,
                    created_at: nowISO,
                    updated_at: nowISO,
                })
                .select()
                .single();

            if (error) throw error;
            createdOrder = data;
            orderId = data.id;

            // 3. GUARDAR ITEMS — si falla, revertir la orden recién creada para evitar órdenes huérfanas
            const { error: itemsError } = await supabaseAdmin
                .from('order_items')
                .insert(buildItemsPayload(data.id));

            if (itemsError) {
                await supabaseAdmin.from('orders').delete().eq('id', data.id);
                throw itemsError;
            }
        }

        return NextResponse.json({
            success: true,
            order: createdOrder,
        });
    } catch (error: unknown) {
        return handleServerError(error, 'SaveOrder API Error');
    }
}
