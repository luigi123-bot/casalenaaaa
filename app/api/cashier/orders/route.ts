import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    timeFilter: z.enum(['today', 'week', 'all']).optional().default('today'),
    userId: z.string().uuid().nullable().optional()
});

export async function GET(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            timeFilter: searchParams.get('timeFilter') || undefined,
            userId: searchParams.get('userId') || null
        });

        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        const { timeFilter, userId } = parsed.data;
        
        let query = supabaseAdmin
            .from('orders')
            .select(`
                *,
                order_items (
                    id,
                    quantity,
                    unit_price,
                    product_name,
                    selected_size,
                    extras
                )
            `);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        query = query.order('created_at', { ascending: false });

        // Apply time filter
        if (timeFilter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query = query.gte('created_at', today.toISOString());
        } else if (timeFilter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('created_at', weekAgo.toISOString());
        }

        const { data, error } = await query;

        if (error) throw error;
        
        return NextResponse.json(data || []);
    } catch (error: any) {
        return handleServerError(error, 'Cashier Orders API Error');
    }
}

