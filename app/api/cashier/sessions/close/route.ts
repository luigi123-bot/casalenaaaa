import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, requireSupabaseAdminConfig, supabaseAdmin } from "@/utils/supabase/server";
import { roundCurrency } from "@/utils/timezone";
import { z } from "zod";

const topProductSchema = z.object({
    name: z.string(),
    qty: z.number().nonnegative(),
});

const closeSessionSchema = z.object({
    activeSessionId: z.string().uuid(),
    metrics: z.object({
        status: z.enum(['open', 'closed']).optional(),
        closed_at: z.string().optional(),
        total_sales: z.number().nonnegative().optional(),
        total_orders: z.number().int().nonnegative().optional(),
        total_products: z.number().int().nonnegative().optional(),
        ventas_efectivo: z.number().nonnegative().optional(),
        ventas_tarjeta: z.number().nonnegative().optional(),
        initial_fund: z.number().nonnegative().optional(),
        expected_cash: z.number().optional(),
        final_cash: z.number().nonnegative().optional(),
        difference: z.number().optional(),
        notes: z.string().optional().default(''),
        top_products: z.array(topProductSchema).optional(),
        gastos_combustible: z.number().nonnegative().optional(),
        gastos_insumo_cocina: z.number().nonnegative().optional(),
        gastos_insumo_limpieza: z.number().nonnegative().optional(),
        total_gastos: z.number().nonnegative().optional(),
    }),
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
        top_productos: z.array(topProductSchema).optional().default([]),
        gastos_combustible: z.number().nonnegative().optional().default(0),
        gastos_insumo_cocina: z.number().nonnegative().optional().default(0),
        gastos_insumo_limpieza: z.number().nonnegative().optional().default(0),
        total_gastos: z.number().nonnegative().optional().default(0),
    }),
});

export async function POST(req: Request) {
    try {
        const { errorResponse, user } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse || !user) return errorResponse;

        const configError = requireSupabaseAdminConfig();
        if (configError) return configError;

        const body = await req.json().catch(() => ({}));
        const parsed = closeSessionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Datos de cierre de sesión inválidos" }, { status: 400 });
        }

        const { activeSessionId, metrics, legacyPayload } = parsed.data;

        // 1. Leer la sesión activa directamente de la BD (fuente de verdad para user_id, status e initial_fund)
        const { data: existingSession, error: readErr } = await supabaseAdmin
            .from('cashier_sessions')
            .select('id, user_id, initial_fund, opened_at, status')
            .eq('id', activeSessionId)
            .maybeSingle();

        if (readErr) throw readErr;

        if (!existingSession) {
            return NextResponse.json(
                { error: 'No se encontró la sesión de caja activa.' },
                { status: 404 }
            );
        }

        // Anti-IDOR: solo el dueño de la sesión o un administrador puede cerrarla
        if (user.role !== 'administrador' && existingSession.user_id !== user.id) {
            return NextResponse.json(
                { error: 'No autorizado para cerrar esta sesión.' },
                { status: 403 }
            );
        }

        if (existingSession.status === 'closed') {
            return NextResponse.json(
                { error: 'Esta sesión ya fue cerrada previamente.' },
                { status: 409 }
            );
        }

        // 2. Recalcular el cuadre en el servidor usando initial_fund de la BD como fuente de verdad
        const initialFund = roundCurrency(Number(existingSession.initial_fund) || 0);
        const gastosCombustible = roundCurrency(legacyPayload.gastos_combustible ?? 0);
        const gastosInsumoCocina = roundCurrency(legacyPayload.gastos_insumo_cocina ?? 0);
        const gastosInsumoLimpieza = roundCurrency(legacyPayload.gastos_insumo_limpieza ?? 0);
        const totalGastos = roundCurrency(gastosCombustible + gastosInsumoCocina + gastosInsumoLimpieza);
        const ventasEfectivo = roundCurrency(legacyPayload.ventas_efectivo);
        const ventasTarjeta = roundCurrency(legacyPayload.ventas_tarjeta);
        const ventasOtro = roundCurrency(legacyPayload.ventas_otro ?? 0);
        const efectivoContado = roundCurrency(legacyPayload.efectivo_contado);
        const expectedCash = roundCurrency(initialFund + ventasEfectivo - totalGastos);
        const difference = roundCurrency(efectivoContado - expectedCash);

        const parsedClosedAt = metrics.closed_at && !Number.isNaN(Date.parse(metrics.closed_at))
            ? new Date(metrics.closed_at).toISOString()
            : new Date().toISOString();

        // Nunca incluir initial_fund ni opened_at; el trigger en BD también los protege.
        const closureUpdate = {
            status: 'closed' as const,
            closed_at: parsedClosedAt,
            notes: metrics.notes ?? '',
            total_sales: roundCurrency(legacyPayload.total_ventas),
            total_orders: legacyPayload.total_ordenes,
            total_products: legacyPayload.total_productos,
            ventas_efectivo: ventasEfectivo,
            ventas_tarjeta: ventasTarjeta,
            ventas_otro: ventasOtro,
            expected_cash: expectedCash,
            final_cash: efectivoContado,
            difference,
            gastos_combustible: gastosCombustible,
            gastos_insumo_cocina: gastosInsumoCocina,
            gastos_insumo_limpieza: gastosInsumoLimpieza,
            total_gastos: totalGastos,
            top_products: legacyPayload.top_productos ?? [],
        };

        // 3. Transición atómica open -> closed para evitar cierres duplicados concurrentes
        const { data: updatedSession, error: updateErr } = await supabaseAdmin
            .from('cashier_sessions')
            .update(closureUpdate)
            .eq('id', activeSessionId)
            .eq('status', 'open')
            .select('id')
            .maybeSingle();

        if (updateErr) throw updateErr;

        if (!updatedSession) {
            return NextResponse.json(
                { error: 'Esta sesión ya fue cerrada previamente.' },
                { status: 409 }
            );
        }

        // 4. Insertar en cash_closures (legacy) con valores consistentes con la BD
        const legacyRecord = {
            fecha_turno: legacyPayload.fecha_turno,
            cajero: legacyPayload.cajero,
            total_ordenes: legacyPayload.total_ordenes,
            total_productos: legacyPayload.total_productos,
            total_ventas: roundCurrency(legacyPayload.total_ventas),
            ventas_efectivo: ventasEfectivo,
            ventas_tarjeta: ventasTarjeta,
            ventas_otro: ventasOtro,
            ticket_promedio: roundCurrency(legacyPayload.ticket_promedio),
            fondo_inicial: initialFund,
            efectivo_esperado: expectedCash,
            efectivo_contado: efectivoContado,
            diferencia: difference,
            top_productos: legacyPayload.top_productos ?? [],
            gastos_combustible: gastosCombustible,
            gastos_insumo_cocina: gastosInsumoCocina,
            gastos_insumo_limpieza: gastosInsumoLimpieza,
            total_gastos: totalGastos,
        };

        const { error: insertErr } = await supabaseAdmin
            .from('cash_closures')
            .insert([legacyRecord]);

        if (insertErr) {
            // Compensación: reabrir la sesión si falla el registro legacy para permitir reintento
            const { error: rollbackErr } = await supabaseAdmin
                .from('cashier_sessions')
                .update({ status: 'open', closed_at: null })
                .eq('id', activeSessionId);
            if (rollbackErr) {
                console.error('[CloseSession] Error en rollback de sesión:', rollbackErr);
            }
            throw insertErr;
        }

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        return handleServerError(error, 'Cashier Close Session Error');
    }
}
