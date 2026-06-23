import { NextRequest, NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const productInputSchema = z.object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional().nullable(),
    price: z.coerce.number().positive(),
    category_id: z.coerce.number().int().positive(),
    imagen_url: z.string().max(2048).optional().nullable(),
    available: z.boolean().optional().default(true)
});

const productUpdateSchema = productInputSchema.partial().extend({
    id: z.coerce.number().int().positive()
});

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('products')
            .select(`
                *,
                categories (
                    name
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json({ products: data || [] });

    } catch (error) {
        return handleServerError(error, 'GET Products API Error');
    }
}

export async function POST(request: NextRequest) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = productInputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros del producto inválidos' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('products')
            .insert([parsed.data])
            .select();

        if (error) throw error;

        return NextResponse.json({ product: data[0] });

    } catch (error: any) {
        return handleServerError(error, 'POST Products API Error');
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = productUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros del producto inválidos' }, { status: 400 });
        }

        const { id, ...productData } = parsed.data;

        const { data, error } = await supabaseAdmin
            .from('products')
            .update(productData)
            .eq('id', id)
            .select();

        if (error) throw error;

        return NextResponse.json({ product: data[0] });

    } catch (error: any) {
        return handleServerError(error, 'PUT Products API Error');
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const idStr = searchParams.get('id');
        const id = idStr ? parseInt(idStr) : NaN;

        if (isNaN(id)) {
            return NextResponse.json(
                { error: 'ID de producto inválido' },
                { status: 400 }
            );
        }

        const { error } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error) {
        return handleServerError(error, 'DELETE Products API Error');
    }
}

