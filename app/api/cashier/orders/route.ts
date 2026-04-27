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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const timeFilter = searchParams.get('timeFilter') || 'today';
        
        let query = supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    id,
                    quantity,
                    unit_price,
                    product_name,
                    selected_size,
                    extras
                )
            `)
            .order('created_at', { ascending: false });

        // Apply time filter
        if (timeFilter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query = query.gte('created_at', today.toISOString());
        } else if (timeFilter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('created_at', weekAgo.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;
        
        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error('Error in orders API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
