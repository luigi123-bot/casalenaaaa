
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Products change infrequently — cache for 60 seconds
export const revalidate = 60;

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
        // Single query with join — avoids two round-trips to the DB
        const { data: products, error: prodError } = await supabase
            .from('products')
            .select('*, categories(id, name)')
            .eq('available', true)
            .order('name');

        if (prodError) throw prodError;

        // Derive active categories from the products result — no extra query needed
        const categoryMap = new Map<number, { id: number; name: string }>();
        products?.forEach(p => {
            if (p.categories && !categoryMap.has(p.category_id)) {
                categoryMap.set(p.category_id, p.categories);
            }
        });

        const filteredCategories = Array.from(categoryMap.values())
            .sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({
            categories: filteredCategories,
            products: products || []
        });

    } catch (error: any) {
        console.error('❌ [API-Products] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
