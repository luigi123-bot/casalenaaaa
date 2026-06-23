import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    status: z.string().nullable().optional(),
    search: z.string().nullable().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
});

export async function GET(request: Request) {
    try {
        // 1. Authenticate & Authorize (Admin only)
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        
        // 2. Validate input parameters
        const parsed = querySchema.safeParse({
            status: searchParams.get('status'),
            search: searchParams.get('search'),
            limit: searchParams.get('limit'),
            offset: searchParams.get('offset'),
            startDate: searchParams.get('startDate'),
            endDate: searchParams.get('endDate'),
        });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        const { status, search: searchTerm, limit, offset, startDate, endDate } = parsed.data;

        let query = supabaseAdmin
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
            if (!isNaN(Number(searchTerm))) {
                query = query.eq('ticket_number', Number(searchTerm));
            } else {
                query = query.ilike('customer_name', `%${searchTerm}%`);
            }
        }

        if (startDate) {
            query = query.gte('created_at', `${startDate}T00:00:00`);
        }
        if (endDate) {
            query = query.lte('created_at', `${endDate}T23:59:59`);
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
        return handleServerError(error, 'Admin Orders API Error');
    }
}

