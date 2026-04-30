import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const searchTerm = searchParams.get('search');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        console.log(`[API-Admin-Orders] 📋 Consultando pedidos | status=${status} | search=${searchTerm}`);

        let query = supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    products (
                        name,
                        price
                    )
                )
            `, { count: 'exact' });

        // Ordenar por fecha descendente
        query = query.order('created_at', { ascending: false });

        // Aplicar filtros
        if (status && status !== 'Todos') {
            // Manejar mapeo de estados si es necesario
            const statusMap: { [key: string]: string[] } = {
                'Pendiente': ['pendiente'],
                'Preparando': ['confirmado', 'preparando'],
                'Listo': ['listo'],
                'Finalizado': ['entregado', 'completado'],
                'Cancelado': ['cancelado']
            };
            const possibleStatuses = statusMap[status] || [status.toLowerCase()];
            query = query.in('status', possibleStatuses);
        }

        if (searchTerm) {
            // Buscar por ticket_number (si es número) o por nombre de cliente
            if (!isNaN(Number(searchTerm))) {
                query = query.eq('ticket_number', Number(searchTerm));
            } else {
                query = query.ilike('customer_name', `%${searchTerm}%`);
            }
        }

        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        // Paginación
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        return NextResponse.json({
            orders: data || [],
            total: count || 0,
            limit,
            offset
        });

    } catch (error: any) {
        console.error('Error in Admin Orders API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
