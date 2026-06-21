import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    timeFilter: z.enum(['all', 'today', 'week']).optional().default('all'),
    limit: z.coerce.number().int().positive().max(1000).optional().default(1000),
    phone: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    orderType: z.string().nullable().optional(),
    excludeStatus: z.string().nullable().optional(),
    cashierNameNull: z.preprocess((val) => val === 'true', z.boolean()).optional()
});

export async function GET(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero', 'cocina']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const parsed = querySchema.safeParse({
            timeFilter: searchParams.get('timeFilter') || 'all',
            limit: searchParams.get('limit') || undefined,
            phone: searchParams.get('phone') || null,
            status: searchParams.get('status') || null,
            orderType: searchParams.get('orderType') || null,
            excludeStatus: searchParams.get('excludeStatus') || null,
            cashierNameNull: searchParams.get('cashierNameNull') || undefined
        });

        if (!parsed.success) {
            return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
        }

        const { timeFilter, limit, phone, status, orderType, excludeStatus, cashierNameNull } = parsed.data;

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
            // Fix timezone: The server runs in UTC but Mexico is UTC-6.
            // We subtract 6 hours to get the correct local "today" start in UTC.
            const MEXICO_OFFSET_HOURS = 6;
            const now = new Date();
            const localMidnight = new Date(now);
            localMidnight.setUTCHours(MEXICO_OFFSET_HOURS, 0, 0, 0); // 00:00 Mexico = 06:00 UTC
            // If current UTC time is before 06:00 UTC, midnight was yesterday UTC
            if (now.getUTCHours() < MEXICO_OFFSET_HOURS) {
                localMidnight.setUTCDate(localMidnight.getUTCDate() - 1);
            }
            query = query.gte('created_at', localMidnight.toISOString());
        } else if (timeFilter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('created_at', weekAgo.toISOString());
        }

        if (phone) {
            query = query.eq('phone_number', phone);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (orderType) {
            const types = orderType.split(',').map(t => t.trim());
            if (types.length > 1) {
                query = query.in('order_type', types);
            } else {
                query = query.eq('order_type', types[0]);
            }
        }

        if (excludeStatus) {
            const statuses = excludeStatus.split(',').map(s => s.trim());
            if (statuses.length > 1) {
                query = query.not('status', 'in', `(${statuses.map(s => `"${s}"`).join(',')})`);
            } else {
                query = query.neq('status', statuses[0]);
            }
        }

        if (cashierNameNull) {
            query = query.is('cashier_name', null);
        }

        query = query.order('created_at', { ascending: false }).limit(limit);

        const { data, error } = await query;
        if (error) throw error;
        
        return NextResponse.json(data || []);
    } catch (error: any) {
        return handleServerError(error, 'Unified Orders API Error');
    }
}

