import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-static';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with service role for admin access (bypasses RLS)
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
        console.log('📋 [PRODUCTS API] Fetching all products...');

        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                categories (
                    name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ [PRODUCTS API] Fetch error:', error);
            throw error;
        }

        console.log(`✅ [PRODUCTS API] Fetched ${data?.length || 0} products`);
        return NextResponse.json({ products: data || [] });

    } catch (error) {
        console.error('💥 [PRODUCTS API] GET error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch products' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log('➕ [PRODUCTS API] Creating new product...');

        const body = await request.json();
        console.log('📦 [PRODUCTS API] Product data:', body);

        const { data, error } = await supabase
            .from('products')
            .insert([body])
            .select();

        if (error) {
            console.error('❌ [PRODUCTS API] Insert error:', error);
            return NextResponse.json(
                { error: error.message || 'Failed to create product', details: error },
                { status: 500 }
            );
        }

        console.log('✅ [PRODUCTS API] Product created:', data);
        return NextResponse.json({ product: data[0] });

    } catch (error: any) {
        console.error('💥 [PRODUCTS API] POST error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create product' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        console.log('✏️ [PRODUCTS API] Updating product...');

        const body = await request.json();
        const { id, ...productData } = body;

        console.log('📦 [PRODUCTS API] Update data:', { id, productData });

        const { data, error } = await supabase
            .from('products')
            .update(productData)
            .eq('id', id)
            .select();

        if (error) {
            console.error('❌ [PRODUCTS API] Update error:', error);
            return NextResponse.json(
                { error: error.message || 'Failed to update product', details: error },
                { status: 500 }
            );
        }

        console.log('✅ [PRODUCTS API] Product updated:', data);
        return NextResponse.json({ product: data[0] });

    } catch (error: any) {
        console.error('💥 [PRODUCTS API] PUT error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update product' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        console.log('🗑️ [PRODUCTS API] Deleting product...');

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Product ID required' },
                { status: 400 }
            );
        }

        console.log('🗑️ [PRODUCTS API] Deleting product ID:', id);

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('❌ [PRODUCTS API] Delete error:', error);
            throw error;
        }

        console.log('✅ [PRODUCTS API] Product deleted');
        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('💥 [PRODUCTS API] DELETE error:', error);
        return NextResponse.json(
            { error: 'Failed to delete product' },
            { status: 500 }
        );
    }
}
