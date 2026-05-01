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

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const timeFilter = searchParams.get('timeFilter') || 'all';
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000;
        
        const now = new Date();
        const localDate = now.toLocaleDateString('sv-SE');
        
        console.log(`[API-Orders] 📋 Consultando pedidos | timeFilter=${timeFilter} | limit=${limit} | localDate=${localDate}`);

        let query = supabase
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

        // ⚠️ NO filtramos por user_id — los pedidos se crean con user_id: null
        // Todos los pedidos pertenecen a la operación del restaurante.

        // Apply time filters
        if (timeFilter === 'today') {
            // Usamos la fecha local del servidor (que coincide con la del usuario)
            // para evitar que los pedidos desaparezcan cuando UTC pasa de medianoche.
            const localDate = new Date().toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD
            query = query.gte('created_at', `${localDate}T00:00:00`);
        } else if (timeFilter === 'week') {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            query = query.gte('created_at', weekAgo.toISOString());
        }

        // Ordenar y limitar al final para asegurar que se aplique sobre el conjunto filtrado
        query = query.order('created_at', { ascending: false }).limit(limit);

        const { data, error } = await query;

        if (error) throw error;
        
        console.log(`[API-Orders] ✅ ${data?.length || 0} pedidos encontrados`);
        return NextResponse.json(data || []);
    } catch (error: any) {
        console.error('Error in unified orders API:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
