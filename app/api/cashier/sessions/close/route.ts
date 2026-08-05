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

        // 1. Leer initial_fund directamente de la BD (fuente de verdad)
        const { data: existingSession, error: readErr } = await supabaseAdmin
            .from('cashier_sessions')
            .select('id, initial_fund, opened_at, status')
            .eq('id', activeSessionId)
            .single();

        if (readErr || !existingSession) {
            return NextResponse.json(
                { error: 'No se encontró la sesión de caja activa.' },
                { status: 404 }
            );
        }

        if (existingSession.status === 'closed') {
            return NextResponse.json(
                { error: 'Esta sesión ya fue cerrada previamente.' },
                { status: 409 }
            );
        }

        // 2. Construir payload de cierre — NUNCA incluir initial_fund ni opened_at.
        //    El trigger en la BD es la segunda línea de defensa.
        const {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            initial_fund: _ignoredFund,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            opened_at: _ignoredOpened,
            ...safeMetrics
        } = metrics as any;

        const closureUpdate = {
            ...safeMetrics,
            status: 'closed',
            closed_at: metrics.closed_at || new Date().toISOString(),
            // Campos de cierre explícitos
            total_sales:            legacyPayload.total_ventas,
            total_orders:           legacyPayload.total_ordenes,
            total_products:         legacyPayload.total_productos,
            ventas_efectivo:        legacyPayload.ventas_efectivo,
            ventas_tarjeta:         legacyPayload.ventas_tarjeta,
            ventas_otro:            legacyPayload.ventas_otro ?? 0,
            expected_cash:          legacyPayload.efectivo_esperado,
            final_cash:             legacyPayload.efectivo_contado,
            difference:             legacyPayload.diferencia,
            gastos_combustible:     legacyPayload.gastos_combustible ?? 0,
            gastos_insumo_cocina:   legacyPayload.gastos_insumo_cocina ?? 0,
            gastos_insumo_limpieza: legacyPayload.gastos_insumo_limpieza ?? 0,
            total_gastos:           legacyPayload.total_gastos ?? 0,
            top_products:           legacyPayload.top_productos ?? [],
            // initial_fund_snapshot se establece automáticamente por el trigger de la BD
        };

        // 3. Actualizar la sesión — el trigger en BD protege initial_fund y opened_at
        const { error: updateErr } = await supabaseAdmin
            .from('cashier_sessions')
            .update(closureUpdate)
            .eq('id', activeSessionId)
            .select()
            .single();

        if (updateErr) throw updateErr;

        // 4. Insertar en cash_closures (legacy) usando el fondo_inicial de la BD
        const legacyRecord = {
            ...legacyPayload,
            fondo_inicial: existingSession.initial_fund, // fuente de verdad: la BD
        };

        const { error: insertErr } = await supabaseAdmin
            .from('cash_closures')
            .insert([legacyRecord])
            .select();

        if (insertErr) throw insertErr;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Close Session Error');
    }
}

