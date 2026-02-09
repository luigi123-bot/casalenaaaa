import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const cashierId = searchParams.get('cashierId');
        const categoryId = searchParams.get('categoryId');
        const paymentMethods = searchParams.get('paymentMethods');

        console.log('=== GENERATING SALES REPORT ===');
        console.log({ startDate, endDate, cashierId, categoryId, paymentMethods });

        // Base query with necessary joins
        // We use !inner for filtering by category content if needed
        let selectQuery = `
            id,
            total_amount,
            status,
            payment_method,
            created_at,
            user_id,
            order_items (
                quantity,
                products (
                    name,
                    category_id
                )
            )
        `;

        // If category is selected, we need to enforce the join to filter orders
        if (categoryId && categoryId !== 'all') {
            selectQuery = `
                id,
                total_amount,
                status,
                payment_method,
                created_at,
                user_id,
                order_items!inner (
                    quantity,
                    products!inner (
                        name,
                        category_id
                    )
                )
            `;
        }

        let query = supabase
            .from('orders')
            .select(selectQuery)
            .order('created_at', { ascending: false });

        // Filter by Date
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`);

        // Filter by Cashier
        if (cashierId && cashierId !== 'all') {
            query = query.eq('user_id', cashierId);
        }

        // Filter by Payment Methods
        if (paymentMethods) {
            const methods = paymentMethods.split(',').filter(Boolean);
            if (methods.length > 0) {
                query = query.in('payment_method', methods);
            }
        }

        // Filter by Category
        if (categoryId && categoryId !== 'all') {
            query = query.eq('order_items.products.category_id', categoryId);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Error fetching report data:', error);
            throw error;
        }

        // Formatear datos para el reporte
        const reportData = (orders as any[])?.map(order => {
            // Calcular detalle de items
            // Note: If filtering by category with !inner, accessing order.order_items might only show the matched items or all depending on Supabase version
            const items = order.order_items?.map((item: any) =>
                `${item.quantity}x ${item.products?.name || 'Item'}`
            ).join(', ') || 'Sin items';

            return {
                id: order.id,
                date: new Date(order.created_at).toLocaleDateString('es-ES'),
                time: new Date(order.created_at).toLocaleTimeString('es-ES'),
                items: items,
                amount: parseFloat(order.total_amount || '0'),
                status: order.status,
                payment_method: order.payment_method || 'N/A'
            };
        }) || [];

        return NextResponse.json(reportData);

    } catch (error: any) {
        console.error('Report generation error:', error);
        return NextResponse.json(
            { error: 'Error al generar el reporte' },
            { status: 500 }
        );
    }
}
