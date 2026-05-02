import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Revalidate every 2 minutes — stats don't need to be real-time
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'week'; // 'week', 'month', 'year'

        // ── Calcular rangos de fecha ANTES de la query ──────────────────────
        const now = new Date();
        let startDate = new Date();
        let prevStartDate = new Date();
        let prevEndDate = new Date();

        if (range === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        } else if (range === 'year') {
            startDate = new Date(now.getFullYear(), 0, 1);
            prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
            prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        } else {
            // Semana: últimos 7 días vs 7 días anteriores
            startDate.setDate(now.getDate() - 7);
            prevEndDate.setDate(now.getDate() - 8);
            prevStartDate.setDate(now.getDate() - 15);
        }

        // ── Fetch solo el rango necesario — NO traer toda la tabla ──────────
        const [currentRes, prevRes] = await Promise.all([
            supabase
                .from('orders')
                .select('id, total_amount, created_at, status')
                .gte('created_at', startDate.toISOString())
                .lte('created_at', now.toISOString()),
            supabase
                .from('orders')
                .select('id, total_amount, created_at, status')
                .gte('created_at', prevStartDate.toISOString())
                .lte('created_at', prevEndDate.toISOString()),
        ]);

        if (currentRes.error) throw new Error(`DB Error: ${currentRes.error.message}`);
        if (prevRes.error) throw new Error(`DB Error: ${prevRes.error.message}`);

        const currentOrders = currentRes.data || [];
        const prevOrders = prevRes.data || [];

        // (removed verbose console.log in production path)

        // Calcular Métricas
        const calculateSales = (orders: any[]) => orders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

        const currentSales = calculateSales(currentOrders);
        const prevSales = calculateSales(prevOrders);

        const currentCount = currentOrders.length;
        const currentAvg = currentCount > 0 ? currentSales / currentCount : 0;

        const completedOrders = currentOrders.filter(o => o.status === 'completado').length;

        // Generar datos del gráfico
        const chartData: { day: string; amount: number; date: string }[] = [];

        if (range === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });

                const dayTotal = currentOrders.filter(o => o.created_at.startsWith(dateStr))
                    .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

                chartData.push({ day: dayName.toUpperCase(), date: dateStr, amount: dayTotal });
            }
        } else if (range === 'month') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                if (new Date(dateStr) > now) break;

                const dayTotal = currentOrders.filter(o => o.created_at.startsWith(dateStr))
                    .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

                chartData.push({ day: `${i}`, date: dateStr, amount: dayTotal });
            }
        } else if (range === 'year') {
            const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
            for (let i = 0; i < 12; i++) {
                const monthPrefix = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                const monthTotal = currentOrders.filter(o => o.created_at.startsWith(monthPrefix))
                    .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

                chartData.push({ day: monthNames[i], date: monthPrefix, amount: monthTotal });
            }
        }

        // ── Top Product y Category Stats en paralelo ────────────────────────
        const [topProductsRes, categoryItemsRes] = await Promise.all([
            supabase
                .from('order_items')
                .select(`quantity, products (name)`)
                .limit(1),
            supabase
                .from('order_items')
                .select(`quantity, products (name, categories (name))`)
                .limit(500), // cap para evitar traer miles de filas
        ]);

        const topProducts = topProductsRes.data;
        const categoryItems = categoryItemsRes.data;
        const catError = categoryItemsRes.error;

        // Safe top product name helper
        const getProductName = (p: any) => {
            if (!p) return 'N/A';
            const prod = Array.isArray(p.products) ? p.products[0] : p.products;
            return prod?.name || 'N/A';
        };

        const topProductName = Array.isArray(topProducts) && topProducts[0]
            ? getProductName(topProducts[0])
            : 'N/A';

        interface CategoryStat { name: string; count: number; percentage: number; }
        let categoryStats: CategoryStat[] = [];

        if (!catError && categoryItems) {
            const catMap = new Map<string, number>();
            let totalItems = 0;
            categoryItems.forEach((item: any) => {
                let catName = 'Uncategorized';
                const product = Array.isArray(item.products) ? item.products[0] : item.products;
                if (product?.categories) {
                    catName = Array.isArray(product.categories) ? product.categories[0]?.name : product.categories.name;
                }
                if (!catName) catName = 'Otros';
                const qty = item.quantity || 0;
                catMap.set(catName, (catMap.get(catName) || 0) + qty);
                totalItems += qty;
            });
            categoryStats = Array.from(catMap.entries()).map(([name, count]) => ({
                name, count, percentage: totalItems > 0 ? (count / totalItems) * 100 : 0
            })).sort((a, b) => b.count - a.count).slice(0, 4);
        }

        // Construct final stats
        const stats = {
            totalSales: currentSales.toFixed(2),
            totalOrders: currentCount,
            avgOrderValue: currentAvg.toFixed(2),
            completedOrders,
            weeklySales: currentSales.toFixed(2),
            topProduct: topProductName,
            chartData,
            categoryStats
        };

        return NextResponse.json(stats);

    } catch (error: any) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json(
            { error: 'Error al obtener estadísticas' },
            { status: 500 }
        );
    }
}
