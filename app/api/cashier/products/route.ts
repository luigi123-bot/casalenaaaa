import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";

export const dynamic = 'force-dynamic';
// Revalidate every 60s — menu changes are infrequent; this prevents repeated round-trips
export const revalidate = 60;

export async function GET() {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        // Single query with join — avoids two round-trips to the DB
        const { data: products, error: prodError } = await supabaseAdmin
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
        return handleServerError(error, 'Cashier Products API Error');
    }
}

