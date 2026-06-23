import { NextResponse } from 'next/server';
import { handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const RESTAURANT_WHATSAPP = process.env.RESTAURANT_WHATSAPP || '527411011595';

const itemSchema = z.object({
    product_id: z.coerce.number().int().positive(),
    product_name: z.string().min(1).max(255),
    quantity: z.coerce.number().int().positive().max(100),
    unit_price: z.coerce.number().positive(),
    selected_size: z.string().max(50).optional().nullable(),
    extras: z.any().optional().nullable()
});

const orderSchema = z.object({
    customerName: z.string().min(1).max(255),
    customerPhone: z.string().min(10).max(20),
    orderType: z.enum(['delivery', 'pickup']),
    deliveryAddress: z.string().max(500).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    items: z.array(itemSchema).min(1)
});

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const parsed = orderSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Faltan datos obligatorios o son inválidos' }, { status: 400 });
        }

        const { customerName, customerPhone, orderType, deliveryAddress, notes, items } = parsed.data;

        // 1. Calculate total
        const totalAmount = items.reduce((sum: number, item: any) => {
            return sum + (item.unit_price * item.quantity);
        }, 0);

        // 2. Insert order
        const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
                status: 'pendiente',
                order_type: orderType || 'pickup',
                customer_name: customerName,
                phone_number: customerPhone,
                delivery_address: orderType === 'delivery' ? deliveryAddress : null,
                notes: notes || null,
                total_amount: totalAmount,
                tax_amount: 0,
                payment_method: 'pendiente',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 3. Insert order items
        const orderItems = items.map((item: any) => ({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            selected_size: item.selected_size || null,
            extras: item.extras ? (typeof item.extras === 'string' ? item.extras : JSON.stringify(item.extras)) : null,
        }));

        const { error: itemsError } = await supabaseAdmin
            .from('order_items')
            .insert(orderItems);

        if (itemsError) {
            // Rollback order if items fail
            await supabaseAdmin.from('orders').delete().eq('id', order.id);
            throw itemsError;
        }

        // 4. Build WhatsApp message for the RESTAURANT
        const itemsList = items.map((i: any) =>
            `  • ${i.quantity}x ${i.product_name}${i.selected_size ? ` (${i.selected_size})` : ''} — $${(i.unit_price * i.quantity).toFixed(2)}`
        ).join('\n');

        const typeLabel = orderType === 'delivery' ? '🛵 DOMICILIO' : '🏃 PICK UP';

        // Create tracking link
        const host = request.headers.get('host') || 'casalenapizza.com';
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const trackingLink = `${protocol}://${host}/tracking?id=${order.id}`;

        const restaurantMsg = [
            `🔔 *NUEVO PEDIDO ONLINE #${order.id}*`,
            ``,
            `👤 *Cliente:* ${customerName}`,
            `📞 *Teléfono:* ${customerPhone}`,
            `📦 *Tipo:* ${typeLabel}`,
            orderType === 'delivery' ? `📍 *Dirección:* ${deliveryAddress}` : '',
            notes ? `📝 *Notas:* ${notes}` : '',
            ``,
            `🍕 *Productos:*`,
            itemsList,
            ``,
            `💰 *TOTAL: $${totalAmount.toFixed(2)}*`,
            ``,
            orderType === 'delivery' ? `📍 *Link Rastreo en Vivo:*\n${trackingLink}\n` : '',
            `_Pedido realizado desde el menú web_`,
        ].filter(Boolean).join('\n');

        // 5. Build confirmation WhatsApp message for the CUSTOMER
        const customerMsg = [
            `✅ *¡Tu pedido en Casaleña fue recibido!*`,
            ``,
            `Hola *${customerName}*, gracias por tu orden 🍕`,
            `Tu número de pedido es *#${order.id}*`,
            ``,
            `📦 *${typeLabel}*`,
            notes ? `📝 Nota: ${notes}` : '',
            ``,
            `🍕 *Tu orden:*`,
            itemsList,
            `💰 *Total: $${totalAmount.toFixed(2)}*`,
            ``,
            orderType === 'delivery' ? `📍 *Sigue tu pedido en vivo (Mapeo Rapido):*\n${trackingLink}\n` : '',
            `En breve nos ponemos en contacto contigo para confirmarlo. ¡Gracias! 🔥`,
        ].filter(Boolean).join('\n');

        // Return WhatsApp URLs for client to open
        const restaurantWAUrl = `https://wa.me/${RESTAURANT_WHATSAPP}?text=${encodeURIComponent(restaurantMsg)}`;
        const customerCleanPhone = customerPhone.replace(/\D/g, '');
        const customerWAUrl = customerCleanPhone.length >= 10
            ? `https://wa.me/52${customerCleanPhone.slice(-10)}?text=${encodeURIComponent(customerMsg)}`
            : null;

        return NextResponse.json({
            success: true,
            orderId: order.id,
            whatsappRestaurantUrl: restaurantWAUrl,
            whatsappCustomerUrl: customerWAUrl,
            total: totalAmount,
        });

    } catch (error: any) {
        return handleServerError(error, 'Online Order API Error');
    }
}

