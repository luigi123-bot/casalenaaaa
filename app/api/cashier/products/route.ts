
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Usamos el Service Role para saltar RLS y asegurar que el cajero siempre vea los productos
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

export async function GET() {
    try {
        console.log('🚀 [API-Products] Cargando menú completo para caja...');

        // 1. Cargar todas las categorías
        const { data: categories, error: catError } = await supabase
            .from('categories')
            .select('*')
            .order('name');

        if (catError) throw catError;

        // 2. Cargar todos los productos disponibles
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('*, categories(name)')
            .eq('available', true)
            .order('name');

        if (prodError) throw prodError;

        // 3. Filtrar categorías que no tienen productos (Opcional, para limpiar la UI)
        const activeCategoryIds = new Set(products?.map(p => p.category_id));
        const filteredCategories = categories?.filter(c => activeCategoryIds.has(c.id)) || [];

        console.log(`✅ [API-Products] ${products?.length} productos y ${filteredCategories.length} categorías enviadas.`);

        return NextResponse.json({
            categories: filteredCategories,
            products: products || []
        });

    } catch (error: any) {
        console.error('❌ [API-Products] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
