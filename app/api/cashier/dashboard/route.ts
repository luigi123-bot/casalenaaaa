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

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Usamos la fecha local del servidor
        const now = new Date();
        const localDate = now.toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD

        // Fetch stats for today
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*')
            .gte('created_at', `${localDate}T00:00:00`);

        if (ordersError) throw ordersError;

        let todayOrders = 0;
        let todayRevenue = 0;
        let pendingOrders = 0;
        let readyOrders = 0;

        if (orders) {
            todayOrders = orders.length;
            todayRevenue = orders
                .filter(o => o.status !== 'cancelado')
                .reduce((sum, o) => sum + o.total_amount, 0);
            
            pendingOrders = orders.filter(o =>
                ['pendiente', 'confirmado', 'preparando'].includes(o.status)
            ).length;
            
            readyOrders = orders.filter(o => o.status === 'listo').length;
        }

        // Fetch recent orders
        const { data: recentOrders, error: recentError } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentError) throw recentError;

        return NextResponse.json({
            stats: {
                todayOrders,
                todayRevenue,
                pendingOrders,
                readyOrders
            },
            recentOrders: recentOrders || []
        });

    } catch (error: any) {
        console.error('Error fetching cashier dashboard data:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
