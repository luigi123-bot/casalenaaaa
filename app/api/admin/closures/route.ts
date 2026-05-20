import { NextRequest, NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const closureInsertSchema = z.object({
    fecha_turno: z.string(),
    cajero: z.string(),
    total_ordenes: z.number().int().nonnegative(),
    total_productos: z.number().int().nonnegative(),
    total_ventas: z.number().nonnegative(),
    ventas_efectivo: z.number().nonnegative(),
    ventas_tarjeta: z.number().nonnegative(),
    ventas_otro: z.number().nonnegative().optional().default(0),
    ticket_promedio: z.number().nonnegative(),
    fondo_inicial: z.number().nonnegative(),
    efectivo_esperado: z.number(),
    efectivo_contado: z.number().nonnegative(),
    diferencia: z.number(),
    top_productos: z.array(z.any()).optional().default([]),
    gastos_combustible: z.number().nonnegative().optional().default(0),
    gastos_insumo_cocina: z.number().nonnegative().optional().default(0),
    gastos_insumo_limpieza: z.number().nonnegative().optional().default(0),
    total_gastos: z.number().nonnegative().optional().default(0)
}).passthrough();

export async function POST(request: NextRequest) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = closureInsertSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de cierre de caja inválidos' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('cash_closures')
            .insert([parsed.data])
            .select();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        return handleServerError(err, 'Admin closures POST error');
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('cash_closures')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return handleServerError(err, 'Admin closures DELETE error');
    }
}

export async function GET() {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const { data, error } = await supabaseAdmin
            .from('cash_closures')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (err: any) {
        return handleServerError(err, 'Admin closures GET error');
    }
}

