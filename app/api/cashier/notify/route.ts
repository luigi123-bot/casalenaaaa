import { NextRequest, NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = "force-dynamic";

const inputSchema = z.object({
    type: z.string(),
    customerName: z.string(),
    orderType: z.enum(['local', 'takeout', 'delivery']),
    total: z.number().nonnegative(),
    items: z.array(z.object({
        quantity: z.number(),
        name: z.string(),
        size: z.string().nullable().optional()
    }))
});

export async function POST(request: NextRequest) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de notificación inválidos' }, { status: 400 });
        }

        const { type, customerName, orderType, total, items } = parsed.data;

        // Format notification message
        let title = '';
        let message = '';

        if (type === 'new_order_whatsapp') {
            title = '📱 Nuevo Pedido por WhatsApp';

            const orderTypeText = orderType === 'delivery' ? 'Domicilio' :
                orderType === 'takeout' ? 'Para Llevar' : 'Comedor';

            const itemsList = items.slice(0, 2).map((item: any) =>
                `${item.quantity}x ${item.name}${item.size ? ` (${item.size})` : ''}`
            ).join(', ');

            const moreItems = items.length > 2 ? ` +${items.length - 2} más` : '';

            message = `${customerName} - ${orderTypeText}\n${itemsList}${moreItems}\nTotal: $${total.toFixed(2)}`;
        }

        try {
            await supabaseAdmin.from('cashier_notifications').insert({
                type: 'order',
                title,
                message,
                metadata: {
                    customerName,
                    orderType,
                    total,
                    items,
                    source: 'whatsapp'
                },
                read: false,
                created_at: new Date().toISOString()
            });
        } catch (dbError) {
            // Safe ignore if notification table does not exist
        }

        return NextResponse.json({
            success: true,
            message: 'Notificación enviada al cajero'
        });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Notify API Error');
    }
}

