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

        console.log('=== GENERATING SALES REPORT ===');
        console.log('Range:', startDate, 'to', endDate);

        let query = supabase
            .from('orders')
            .select(`
                id,
                total_amount,
                status,
                payment_method,
                created_at,
                order_items (
                    quantity,
                    products (name)
                )
            `)
            .order('created_at', { ascending: false });

        if (startDate) {
            query = query.gte('created_at', `${startDate}T00:00:00`);
        }
        if (endDate) {
            query = query.lte('created_at', `${endDate}T23:59:59`);
        }

        const { data: orders, error } = await query;

        if (error) {
            console.error('Error fetching report data:', error);
            throw error;
        }

        // Formatear datos para el reporte
        const reportData = orders?.map(order => {
            // Calcular detalle de items
            const items = order.order_items?.map(item =>
                `${item.quantity}x ${item.products?.[0]?.name}`
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
