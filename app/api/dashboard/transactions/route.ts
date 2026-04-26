import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Short cache — transactions update frequently but don't need to be instant
export const revalidate = 30;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50); // cap at 50

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id,
                total_amount,
                status,
                payment_method,
                created_at,
                order_items (
                    quantity,
                    product_name
                )
            `)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        const transactions = orders?.map(order => {
            const items = order.order_items?.map(item =>
                `${item.quantity}x ${item.product_name}`
            ).join(', ') || 'Sin items';

            return {
                id: `#${order.id}`,
                time: new Date(order.created_at).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                items,
                amount: `${parseFloat(order.total_amount || '0').toFixed(2)}`,
                status: order.status,
                paymentMethod: order.payment_method
            };
        }) || [];

        return NextResponse.json(transactions);

    } catch (error: any) {
        console.error('Transactions error:', error);
        return NextResponse.json(
            { error: 'Error al obtener transacciones' },
            { status: 500 }
        );
    }
}
