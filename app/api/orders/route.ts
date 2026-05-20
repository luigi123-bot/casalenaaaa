import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    timeFilter: z.enum(['all', 'today', 'week']).optional().default('all'),
    limit: z.coerce.number().int().positive().max(1000).optional().default(1000)
});

export async function GET(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero', 'cocina']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            timeFilter: searchParams.get('timeFilter') || 'all',
            limit: searchParams.get('limit') || undefined
        });

        if (!parsed.success) {
            return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
        }

        const { timeFilter, limit } = parsed.data;

        let query = supabaseAdmin
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    products (
                        name,
                        description
                    )
                )
            `);

        if (timeFilter === 'today') {
            const localDate = new Date().toLocaleDateString('sv-SE');
            query = query.gte('created_at', `${localDate}T00:00:00`);
        } else if (timeFilter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('created_at', weekAgo.toISOString());
        }

        query = query.order('created_at', { ascending: false }).limit(limit);

        const { data, error } = await query;
        if (error) throw error;
        
        return NextResponse.json(data || []);
    } catch (error: any) {
        return handleServerError(error, 'Unified Orders API Error');
    }
}

