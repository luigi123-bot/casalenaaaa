import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
    try {
        console.log('=== FETCHING DASHBOARD STATS ===');

        // Obtener ventas totales
        const { data: ordersData, error: ordersError } = await supabase
            .from('orders')
            .select('total_amount, tax_amount, created_at, status');

        if (ordersError) {
            console.error('Error fetching orders:', ordersError);
            throw ordersError;
        }

        console.log('Orders fetched:', ordersData?.length);

        // Calcular estadísticas
        const totalSales = ordersData?.reduce((sum, order) => sum + parseFloat(order.total_amount || '0'), 0) || 0;
        const totalOrders = ordersData?.length || 0;
        const completedOrders = ordersData?.filter(o => o.status === 'completado').length || 0;
        const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

        // Obtener productos más vendidos
        const { data: topProducts, error: productsError } = await supabase
            .from('order_items')
            .select(`
        product_id,
        quantity,
        products (name)
      `)
            .limit(1);

        if (productsError) {
            console.error('Error fetching top products:', productsError);
        }

        console.log('Top products:', topProducts);

        // Calcular ventas de la última semana
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const weeklyOrders = ordersData?.filter(order =>
            new Date(order.created_at) >= oneWeekAgo
        ) || [];

        const weeklySales = weeklyOrders.reduce((sum, order) =>
            sum + parseFloat(order.total_amount || '0'), 0
        );

        console.log('Weekly sales:', weeklySales);

        // Calcular historial de ventas (últimos 7 días)
        const dailyStats = [];
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });

            const dayOrders = ordersData?.filter(o =>
                o.created_at.startsWith(dateStr)
            ) || [];

            const dayTotal = dayOrders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

            dailyStats.push({
                date: dateStr,
                day: dayName,
                amount: dayTotal
            });
        }

        console.log('Daily stats:', dailyStats);

        // Obtener estadísticas por categoría
        const { data: categoryItems, error: catError } = await supabase
            .from('order_items')
            .select(`
                quantity,
                products (
                    name,
                    categories (name)
                )
            `);

        interface CategoryStat {
            name: string;
            count: number;
            percentage: number;
        }

        let categoryStats: CategoryStat[] = [];
        if (!catError && categoryItems) {
            const catMap = new Map<string, number>();
            let totalItems = 0;

            categoryItems.forEach((item: any) => {
                let catName = 'Uncategorized';

                // Determine category name safely handling potential array/object discrepancies
                const product = Array.isArray(item.products) ? item.products[0] : item.products;

                if (product?.categories) {
                    catName = Array.isArray(product.categories)
                        ? product.categories[0]?.name
                        : product.categories.name;
                }

                if (!catName) catName = 'Uncategorized';

                const qty = item.quantity || 0;

                catMap.set(catName, (catMap.get(catName) || 0) + qty);
                totalItems += qty;
            });

            categoryStats = Array.from(catMap.entries()).map(([name, count]) => ({
                name,
                count,
                percentage: totalItems > 0 ? (count / totalItems) * 100 : 0
            })).sort((a, b) => b.count - a.count).slice(0, 4);
        }

        // Safe top product name extraction
        const getProductName = (p: any) => {
            if (!p) return 'N/A';
            const prod = Array.isArray(p.products) ? p.products[0] : p.products;
            return prod?.name || 'N/A';
        };

        const topProductName = Array.isArray(topProducts) && topProducts[0]
            ? getProductName(topProducts[0])
            : 'N/A';

        const stats = {
            totalSales: totalSales.toFixed(2),
            totalOrders,
            avgOrderValue: avgOrderValue.toFixed(2),
            completedOrders,
            weeklySales: weeklySales.toFixed(2),
            topProduct: topProductName,
            chartData: dailyStats,
            categoryStats
        };

        console.log('Dashboard stats:', stats);

        return NextResponse.json(stats);

    } catch (error: any) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json(
            { error: 'Error al obtener estadísticas' },
            { status: 500 }
        );
    }
}
