import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Admin privileges for deletion
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(request: Request) {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        // Permanently delete order from database
        // Assuming ON DELETE CASCADE is set up in DB for order_items. 
        // If not, we might need to delete items first, but Supabase usually handles this.
        const { error } = await supabaseAdmin
            .from('orders')
            .delete()
            .eq('id', orderId);

        if (error) {
            console.error('Error erasing order:', error);
            throw error;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Cancel API Error:', error);
        return NextResponse.json(
            { error: error.message || 'Error deleting order' },
            { status: 500 }
        );
    }
}
