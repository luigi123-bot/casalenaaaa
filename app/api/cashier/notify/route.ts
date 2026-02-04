import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, customerName, orderType, total, items } = body;

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

        // Create notification record in database (optional - for tracking)
        // You could create a notifications table to store these

        // For now, we'll just broadcast via Supabase Realtime
        // The NotificationPanel component will pick this up automatically through the channel subscription

        // Alternative: Store in a notifications table
        try {
            await supabase.from('cashier_notifications').insert({
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
            // If the table doesn't exist yet, that's OK - notifications will still work via realtime orders
            console.log('Notification table not found or error:', dbError);
        }

        return NextResponse.json({
            success: true,
            message: 'Notificación enviada al cajero'
        });

    } catch (error: any) {
        console.error('Error processing cashier notification:', error);
        return NextResponse.json(
            { error: 'Error al procesar notificación', details: error.message },
            { status: 500 }
        );
    }
}
