import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic';
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
        const tz = searchParams.get('tz') || '-05:00'; // Default timezone offset

        console.log('=== GENERATING SALES REPORT ===');
        console.log({ startDate, endDate, cashierId, categoryId, paymentMethods });

        // Base query with necessary joins
        // We use !inner for filtering by category content if needed
        let selectQuery = `
            id,
            ticket_number,
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
                ticket_number,
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

        // Filter by Date (applying timezone offset)
        if (startDate) query = query.gte('created_at', `${startDate}T00:00:00${tz}`);
        if (endDate) query = query.lte('created_at', `${endDate}T23:59:59${tz}`);

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

        // Parsear offset para conversión de fecha (ej. -05:00)
        const sign = tz.startsWith('+') ? 1 : -1;
        const offsetParts = tz.substring(1).split(':');
        const offsetHours = parseInt(offsetParts[0], 10) || 0;
        const offsetMinutes = parseInt(offsetParts[1], 10) || 0;
        const offsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60 * 1000;

        // Formatear datos para el reporte
        const reportData = (orders as any[])?.map(order => {
            // Calcular detalle de items
            const items = order.order_items?.map((item: any) =>
                `${item.quantity}x ${item.products?.name || 'Item'}`
            ).join(', ') || 'Sin items';

            // Ajustar la fecha usando el offset del cliente para formateo consistente
            const utcTime = new Date(order.created_at).getTime();
            const localDate = new Date(utcTime + offsetMs);

            const day = String(localDate.getUTCDate()).padStart(2, '0');
            const month = String(localDate.getUTCMonth() + 1).padStart(2, '0');
            const year = localDate.getUTCFullYear();
            const formattedDate = `${day}/${month}/${year}`;

            const hours = String(localDate.getUTCHours()).padStart(2, '0');
            const minutes = String(localDate.getUTCMinutes()).padStart(2, '0');
            const formattedTime = `${hours}:${minutes}`;

            return {
                id: order.ticket_number || order.id,
                date: formattedDate,
                time: formattedTime,
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
