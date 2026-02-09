import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const range = searchParams.get('range') || 'week'; // 'week', 'month', 'year'

        console.log(`=== FETCHING DASHBOARD STATS (Range: ${range}) ===`);

        // Obtener TODAS las órdenes (para poder filtrar en memoria rápidamente)
        // En producción con miles de datos, esto debería filtrarse en DB.
        const { data: allOrders, error: ordersError } = await supabase
            .from('orders')
            .select('id, total_amount, tax_amount, created_at, status');

        if (ordersError) {
            console.error('Error fetching orders:', ordersError);
            throw ordersError;
        }

        // Definir rangos de fecha
        const now = new Date();
        let startDate = new Date();
        let prevStartDate = new Date();
        let prevEndDate = new Date();

        if (range === 'month') {
            // Mes Actual vs Mes Anterior
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        } else if (range === 'year') {
            // Año Actual vs Año Anterior
            startDate = new Date(now.getFullYear(), 0, 1);
            prevStartDate = new Date(now.getFullYear() - 1, 0, 1);
            prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59);
        } else {
            // Semana (Últimos 7 días vs 7 días anteriores)
            startDate.setDate(now.getDate() - 7);
            prevEndDate.setDate(now.getDate() - 8);
            prevStartDate.setDate(now.getDate() - 15);
        }

        // Filtrar órdenes
        const currentOrders = allOrders?.filter(o => {
            const date = new Date(o.created_at);
            return date >= startDate && date <= now;
        }) || [];

        const prevOrders = allOrders?.filter(o => {
            const date = new Date(o.created_at);
            return date >= prevStartDate && date <= prevEndDate;
        }) || [];

        console.log(`Orders: Current ${currentOrders.length} | Prev ${prevOrders.length}`);

        // Calcular Métricas
        const calculateSales = (orders: any[]) => orders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

        const currentSales = calculateSales(currentOrders);
        const prevSales = calculateSales(prevOrders);

        const currentCount = currentOrders.length;
        const currentAvg = currentCount > 0 ? currentSales / currentCount : 0;

        const completedOrders = currentOrders.filter(o => o.status === 'completado').length;

        // Generar datos del gráfico
        let chartData: { day: string; amount: number; date: string }[] = [];

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

        // Obtener Top Product (Global)
        const { data: topProducts, error: productsError } = await supabase
            .from('order_items')
            .select(`quantity, products (name)`)
            .limit(1);

        // Safe top product name helper
        const getProductName = (p: any) => {
            if (!p) return 'N/A';
            const prod = Array.isArray(p.products) ? p.products[0] : p.products;
            return prod?.name || 'N/A';
        };

        const topProductName = Array.isArray(topProducts) && topProducts[0]
            ? getProductName(topProducts[0])
            : 'N/A';

        // Obtener Category Stats (Global)
        const { data: categoryItems, error: catError } = await supabase
            .from('order_items')
            .select(`quantity, products (name, categories (name))`);

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
