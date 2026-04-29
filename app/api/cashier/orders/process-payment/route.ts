import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(request: Request) {
    try {
        const { orderId, amountPaid, totalAmount, paymentMethod } = await request.json();
        
        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        const paid = parseFloat(amountPaid) || totalAmount;
        const change = Math.max(0, paid - totalAmount);

        const { data, error } = await supabase
            .from('orders')
            .update({ 
                status: 'entregado',
                payment_status: 'paid',
                payment_method: paymentMethod || 'efectivo',
                pago_con: paid,
                cambio: change,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select();

        if (error) throw error;
        
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Error processing quick payment:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
