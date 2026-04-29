import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { activeSessionId, metrics, legacyPayload } = body;

        if (!activeSessionId) {
            return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
        }

        console.log(`[API-Close-Session] Cerrando sesión ${activeSessionId}...`);

        // 1. Actualizar la sesión en cashier_sessions
        const { error: updateErr } = await supabase
            .from('cashier_sessions')
            .update(metrics)
            .eq('id', activeSessionId)
            .select()
            .single();

        if (updateErr) {
            console.error('[API-Close-Session] Error actualizando cashier_sessions:', updateErr);
            throw new Error(`Fallo al actualizar cashier_sessions: ${updateErr.message}`);
        }

        // 2. Insertar en cash_closures (legacy)
        const { error: insertErr } = await supabase
            .from('cash_closures')
            .insert([legacyPayload])
            .select();

        if (insertErr) {
            console.error('[API-Close-Session] Error insertando en cash_closures:', insertErr);
            throw new Error(`Fallo al insertar en cash_closures: ${insertErr.message}`);
        }

        console.log(`[API-Close-Session] Sesión ${activeSessionId} cerrada exitosamente.`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[API-Close-Session] Error catastrófico:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
