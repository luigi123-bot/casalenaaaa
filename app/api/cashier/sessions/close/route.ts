import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

const closeSessionSchema = z.object({
    activeSessionId: z.string().uuid(),
    metrics: z.object({
        status: z.enum(['open', 'closed']),
        closed_at: z.string(),
        total_sales: z.number().nonnegative(),
        total_orders: z.number().int().nonnegative(),
        notes: z.string().optional().default('')
    }).passthrough(),
    legacyPayload: z.object({
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
    }).passthrough()
});

export async function POST(req: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const body = await req.json().catch(() => ({}));
        const parsed = closeSessionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Datos de cierre de sesión inválidos" }, { status: 400 });
        }

        const { activeSessionId, metrics, legacyPayload } = parsed.data;

        // 1. Actualizar la sesión en cashier_sessions
        const { error: updateErr } = await supabaseAdmin
            .from('cashier_sessions')
            .update(metrics)
            .eq('id', activeSessionId)
            .select()
            .single();

        if (updateErr) throw updateErr;

        // 2. Insertar en cash_closures (legacy)
        const { error: insertErr } = await supabaseAdmin
            .from('cash_closures')
            .insert([legacyPayload])
            .select();

        if (insertErr) throw insertErr;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Close Session Error');
    }
}

