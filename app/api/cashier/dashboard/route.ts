import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, requireSupabaseAdminConfig, supabaseAdmin } from '@/utils/supabase/server';
import { getMexicoDayStartISO } from '@/utils/timezone';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const configError = requireSupabaseAdminConfig();
        if (configError) return configError;

        const dayStartISO = getMexicoDayStartISO();

        const [todayRes, recentRes] = await Promise.all([
            supabaseAdmin
                .from('orders')
                .select('id, total_amount, status')
                .gte('created_at', dayStartISO),

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

        const todayOrders = orders.length;
        const todayRevenue = orders
            .filter(o => o.status !== 'cancelado')
            .reduce((sum, o) => sum + (o.total_amount || 0), 0);

        const pendingOrders = orders.filter(o =>
            ['pendiente', 'confirmado', 'preparando'].includes(o.status)
        ).length;

        const readyOrders = orders.filter(o => o.status === 'listo').length;

        return NextResponse.json({
            stats: {
                todayOrders,
                todayRevenue,
                pendingOrders,
                readyOrders
            },
            recentOrders
        });

    } catch (error: unknown) {
        return handleServerError(error, 'Cashier Dashboard API Error');
    }
}
