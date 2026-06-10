import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        // FIX: Ejecutar ambas queries en paralelo en lugar de secuencial
        const now = new Date();
        const localDate = now.toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD

        const [todayRes, recentRes] = await Promise.all([
            // Query 1: Órdenes de hoy para estadísticas
            supabaseAdmin
                .from('orders')
                .select('id, total_amount, status')
                .gte('created_at', `${localDate}T00:00:00`),

            // Query 2: Últimas 5 órdenes (sin filtro de fecha)
            supabaseAdmin
                .from('orders')
                .select('id, total_amount, status, order_type, customer_name, created_at, table_number')
                .order('created_at', { ascending: false })
                .limit(5),
        ]);

        if (todayRes.error) throw todayRes.error;
        if (recentRes.error) throw recentRes.error;

        const orders = todayRes.data || [];
        const recentOrders = recentRes.data || [];

        let todayOrders = orders.length;
        let todayRevenue = orders
            .filter(o => o.status !== 'cancelado')
            .reduce((sum, o) => sum + (o.total_amount || 0), 0);

        let pendingOrders = orders.filter(o =>
            ['pendiente', 'confirmado', 'preparando'].includes(o.status)
        ).length;

        let readyOrders = orders.filter(o => o.status === 'listo').length;

        return NextResponse.json({
            stats: {
                todayOrders,
                todayRevenue,
                pendingOrders,
                readyOrders
            },
            recentOrders
        });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Dashboard API Error');
    }
}
