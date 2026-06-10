import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    range: z.enum(['week', 'month', 'year']).optional().default('week')
});

export async function GET(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            range: searchParams.get('range') || undefined
        });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        const { range } = parsed.data;

        // ── Calcular rangos de fecha ─────────────────────────────────────────
        // IMPORTANTE: crear objetos independientes para evitar mutación cruzada
        const now = new Date();

        let startDate: Date;
        let prevStartDate: Date;
        let prevEndDate: Date;

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
            // FIX: crear fechas independientes para no mutar el mismo objeto
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);

            prevEndDate = new Date(now);
            prevEndDate.setDate(now.getDate() - 8);
            prevEndDate.setHours(23, 59, 59, 999);

            prevStartDate = new Date(now);
            prevStartDate.setDate(now.getDate() - 15);
            prevStartDate.setHours(0, 0, 0, 0);
        }

        const startISO = startDate.toISOString();
        const nowISO = now.toISOString();
        const prevStartISO = prevStartDate.toISOString();
        const prevEndISO = prevEndDate.toISOString();

        // ── Fetch en paralelo: órdenes del periodo actual, anterior, e items del periodo actual ──
        const [currentRes, prevRes, currentItemsRes] = await Promise.all([
            // Órdenes del periodo actual
            supabaseAdmin
                .from('orders')
                .select('id, total_amount, created_at, status')
                .gte('created_at', startISO)
                .lte('created_at', nowISO),

            // Órdenes del periodo anterior (para comparación)
            supabaseAdmin
                .from('orders')
                .select('id, total_amount, created_at, status')
                .gte('created_at', prevStartISO)
                .lte('created_at', prevEndISO),

            // Items de órdenes del periodo actual (para top product y categorías)
            // FIX: filtrar por fecha usando join con orders
            supabaseAdmin
                .from('order_items')
                .select(`
                    quantity,
                    product_name,
                    products (
                        name,
                        categories ( name )
                    ),
                    orders!inner ( created_at )
                `)
                .gte('orders.created_at', startISO)
                .lte('orders.created_at', nowISO)
                .limit(2000),
        ]);

        if (currentRes.error) throw currentRes.error;
        if (prevRes.error) throw prevRes.error;
        // currentItemsRes error no es fatal — continuamos con datos parciales

        const currentOrders = currentRes.data || [];
        const prevOrders = prevRes.data || [];
        const currentItems = currentItemsRes.data || [];

        // ── Métricas de ventas ───────────────────────────────────────────────
        const calculateSales = (orders: any[]) =>
            orders.reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

        const currentSales = calculateSales(currentOrders);
        const prevSales = calculateSales(prevOrders);

        const currentCount = currentOrders.length;
        const currentAvg = currentCount > 0 ? currentSales / currentCount : 0;

        const completedOrders = currentOrders.filter(o => o.status === 'completado').length;

        // ── Cálculo de variación porcentual vs periodo anterior ──────────────
        const calcChange = (current: number, prev: number): string => {
            if (prev === 0) return current > 0 ? '+100' : '0';
            const pct = ((current - prev) / prev) * 100;
            return (pct >= 0 ? '+' : '') + pct.toFixed(1);
        };

        const salesChange = calcChange(currentSales, prevSales);
        const ordersChange = calcChange(currentCount, prevOrders.length);

        // ── Generar datos del gráfico ────────────────────────────────────────
        const chartData: { day: string; amount: number; date: string }[] = [];

        if (range === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(now.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const dayName = d.toLocaleDateString('es-MX', { weekday: 'short' });

                const dayTotal = currentOrders
                    .filter(o => o.created_at.startsWith(dateStr))
                    .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

                chartData.push({ day: dayName.toUpperCase(), date: dateStr, amount: dayTotal });
            }
        } else if (range === 'month') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) {
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
                if (new Date(dateStr) > now) break;

                const dayTotal = currentOrders
                    .filter(o => o.created_at.startsWith(dateStr))
                    .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

                chartData.push({ day: `${i}`, date: dateStr, amount: dayTotal });
            }
        } else if (range === 'year') {
            const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
            for (let i = 0; i < 12; i++) {
                const monthPrefix = `${now.getFullYear()}-${String(i + 1).padStart(2, '0')}`;
                // Solo mostrar hasta el mes actual
                if (i > now.getMonth()) break;

                const monthTotal = currentOrders
                    .filter(o => o.created_at.startsWith(monthPrefix))
                    .reduce((sum, o) => sum + parseFloat(o.total_amount || '0'), 0);

                chartData.push({ day: monthNames[i], date: monthPrefix, amount: monthTotal });
            }
        }

        // ── Top producto y categorías — filtrados por el periodo actual ───────
        // FIX: ahora currentItems ya viene filtrado por rango de fecha

        // Agrupar por producto para encontrar el más vendido en el periodo
        const productMap = new Map<string, number>();
        const catMap = new Map<string, number>();
        let totalQty = 0;

        currentItems.forEach((item: any) => {
            const qty = item.quantity || 1;
            totalQty += qty;

            // Nombre del producto
            const product = Array.isArray(item.products) ? item.products[0] : item.products;
            const productName = product?.name || item.product_name || 'Sin nombre';
            productMap.set(productName, (productMap.get(productName) || 0) + qty);

            // Categoría
            let catName = 'Otros';
            if (product?.categories) {
                const cat = Array.isArray(product.categories) ? product.categories[0] : product.categories;
                catName = cat?.name || 'Otros';
            }
            catMap.set(catName, (catMap.get(catName) || 0) + qty);
        });

        // Producto más vendido en el periodo
        let topProductName = 'N/A';
        if (productMap.size > 0) {
            const topEntry = Array.from(productMap.entries()).sort((a, b) => b[1] - a[1])[0];
            topProductName = topEntry[0];
        }

        // Estadísticas de categoría ordenadas por volumen
        const categoryStats = Array.from(catMap.entries())
            .map(([name, count]) => ({
                name,
                count,
                percentage: totalQty > 0 ? (count / totalQty) * 100 : 0
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 4);

        // ── Respuesta final ──────────────────────────────────────────────────
        const stats = {
            totalSales: currentSales.toFixed(2),
            totalOrders: currentCount,
            avgOrderValue: currentAvg.toFixed(2),
            completedOrders,
            weeklySales: currentSales.toFixed(2),
            topProduct: topProductName,
            chartData,
            categoryStats,
            // Variaciones vs periodo anterior (para mostrar en las tarjetas)
            changes: {
                sales: salesChange,
                orders: ordersChange,
            }
        };

        return NextResponse.json(stats);

    } catch (error: any) {
        return handleServerError(error, 'Dashboard Stats API Error');
    }
}
