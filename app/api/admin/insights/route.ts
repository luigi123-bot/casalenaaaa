import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Category keyword maps — adjust these to match your actual category names in Supabase
const PIZZA_KEYWORDS = ['pizza', 'tradicional', 'especialidad', 'gourmet', 'orilla', 'snack'];
const DRINK_KEYWORDS = ['bebida', 'bebidas', 'drink', 'refresco', 'agua', 'malteada', 'jugo', 'limonada'];
const COMBO_KEYWORDS = ['combo', 'paquete'];
const BURGER_KEYWORDS = ['hamburguesa', 'burger'];
const DESSERT_KEYWORDS = ['postre', 'dessert'];

function detectCategory(catName: string): string {
    const c = catName.toLowerCase();
    if (PIZZA_KEYWORDS.some(k => c.includes(k))) return 'pizza';
    if (DRINK_KEYWORDS.some(k => c.includes(k))) return 'bebida';
    if (COMBO_KEYWORDS.some(k => c.includes(k))) return 'combo';
    if (BURGER_KEYWORDS.some(k => c.includes(k))) return 'hamburguesa';
    if (DESSERT_KEYWORDS.some(k => c.includes(k))) return 'postre';
    return 'otro';
}

function getPeriodStart(period: string): string {
    const now = new Date();
    if (period === 'week') {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d.toISOString();
    }
    if (period === 'month') {
        const d = new Date(now);
        d.setMonth(d.getMonth() - 1);
        return d.toISOString();
    }
    if (period === 'year') {
        const d = new Date(now);
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString();
    }
    // 'all' or default: no restriction
    return '';
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'month'; // week | month | year | all
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let query = supabaseAdmin
            .from('orders')
            .select(`
                id,
                created_at,
                total_amount,
                status,
                order_items (
                    id,
                    quantity,
                    unit_price,
                    selected_size,
                    product_id,
                    product_name,
                    products (
                        name,
                        categories (
                            name
                        )
                    )
                )
            `)
            .neq('status', 'cancelado')
            .neq('status', 'abierta');

        // Date filtering: explicit dates override period
        if (startDate) {
            query = query.gte('created_at', startDate);
        } else {
            const periodStart = getPeriodStart(period);
            if (periodStart) query = query.gte('created_at', periodStart);
        }
        if (endDate) query = query.lte('created_at', endDate + 'T23:59:59');

        const { data: orders, error } = await query;
        if (error) throw error;

        // ---- Aggregation structures ----
        let totalSales = 0;
        const totalOrders = orders?.length || 0;

        // Pizza: { "Hawaiana": { total: N, chica: N, grande: N, familiar: N } }
        const pizzaDetail: Record<string, { total: number; chica: number; grande: number; familiar: number; otro: number }> = {};
        let pizzaTotal = 0;
        const pizzaBySize = { chica: 0, grande: 0, familiar: 0, otro: 0 };

        // Drinks: { "Malteada de Vainilla": N }
        const drinkDetail: Record<string, number> = {};
        let drinkTotal = 0;

        // Other categories: { "Hamburguesa BBQ": N }
        const burgerDetail: Record<string, number> = {};
        const comboDetail: Record<string, number> = {};
        const dessertDetail: Record<string, number> = {};
        const otherDetail: Record<string, number> = {};

        // All products combined for global top
        const allProducts: Record<string, number> = {};

        orders?.forEach(order => {
            totalSales += order.total_amount ?? 0;

            (order.order_items as any[])?.forEach((item: any) => {
                const productName: string = item.product_name || item.products?.name || 'Desconocido';
                const rawCategoryName: string = item.products?.categories?.name || '';
                const catType = detectCategory(rawCategoryName);
                const size: string = (item.selected_size || '').toLowerCase();
                const qty: number = item.quantity || 1;

                // Global tally
                allProducts[productName] = (allProducts[productName] || 0) + qty;

                if (catType === 'pizza') {
                    pizzaTotal += qty;
                    if (!pizzaDetail[productName]) {
                        pizzaDetail[productName] = { total: 0, chica: 0, grande: 0, familiar: 0, otro: 0 };
                    }
                    pizzaDetail[productName].total += qty;

                    if (size.includes('chica') || size.includes('pequeña') || size.includes('personal')) {
                        pizzaDetail[productName].chica += qty;
                        pizzaBySize.chica += qty;
                    } else if (size.includes('grande') || size.includes('mediana')) {
                        pizzaDetail[productName].grande += qty;
                        pizzaBySize.grande += qty;
                    } else if (size.includes('familiar') || size.includes('extra')) {
                        pizzaDetail[productName].familiar += qty;
                        pizzaBySize.familiar += qty;
                    } else {
                        pizzaDetail[productName].otro += qty;
                        pizzaBySize.otro += qty;
                    }
                } else if (catType === 'bebida') {
                    drinkTotal += qty;
                    drinkDetail[productName] = (drinkDetail[productName] || 0) + qty;
                } else if (catType === 'hamburguesa') {
                    burgerDetail[productName] = (burgerDetail[productName] || 0) + qty;
                } else if (catType === 'combo') {
                    comboDetail[productName] = (comboDetail[productName] || 0) + qty;
                } else if (catType === 'postre') {
                    dessertDetail[productName] = (dessertDetail[productName] || 0) + qty;
                } else {
                    otherDetail[productName] = (otherDetail[productName] || 0) + qty;
                }
            });
        });

        // Sort helpers
        const sortedEntries = (obj: Record<string, number>) =>
            Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

        const sortedPizzas = Object.entries(pizzaDetail)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([name, sizes]) => ({ name, ...sizes }));

        const top10Overall = Object.entries(allProducts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        return NextResponse.json({
            period,
            totalSales,
            totalOrders,
            // Pizzas
            pizzaTotal,
            pizzaBySize,
            pizzas: sortedPizzas,            // [ { name, total, chica, grande, familiar, otro } ]
            // Drinks
            drinkTotal,
            drinks: sortedEntries(drinkDetail),
            // Others
            burgers: sortedEntries(burgerDetail),
            combos: sortedEntries(comboDetail),
            desserts: sortedEntries(dessertDetail),
            others: sortedEntries(otherDetail),
            // Global
            top10: top10Overall,
        });

    } catch (error: any) {
        console.error('[Insights API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
