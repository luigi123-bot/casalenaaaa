
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Configuración de Supabase con Service Role para asegurar la escritura
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
        let body;
        try {
            body = await req.json();
        } catch (e) {
            console.error('[API-Shift] Error parseando body JSON:', e);
            return NextResponse.json({ error: "Cuerpo de petición inválido" }, { status: 400 });
        }

        const { cashier_name, user_id, initial_fund, notes } = body;

        if (!cashier_name) {
            return NextResponse.json({ error: "El nombre del cajero es obligatorio" }, { status: 400 });
        }

        console.log(`[API-Shift] Intento de apertura: ${cashier_name} (User: ${user_id || 'N/A'}) fund: ${initial_fund}`);

        // 1. Verificar si ya existe una sesión abierta para este usuario
        if (user_id) {
            try {
                const { data: existingSession, error: checkError } = await supabase
                    .from('cashier_sessions')
                    .select('id')
                    .eq('user_id', user_id)
                    .eq('status', 'open')
                    .maybeSingle();
                
                if (checkError) {
                    console.warn('[API-Shift] Error no crítico verificando sesión existente:', checkError);
                }

                if (existingSession) {
                    console.log(`[API-Shift] Usuario ${user_id} ya tiene sesión abierta: ${existingSession.id}`);
                    return NextResponse.json({ 
                        success: true, 
                        message: "Ya existe una sesión abierta", 
                        session: existingSession 
                    });
                }
            } catch (err) {
                console.error('[API-Shift] Error inesperado en verificación:', err);
                // Continuamos intentando la apertura si falla la verificación
            }
        }

        // 2. Insertar nueva sesión
        const fundValue = parseFloat(initial_fund) || 0;
        
        const payload = {
            cashier_name: cashier_name,
            user_id: user_id || null,
            initial_fund: fundValue,
            notes: notes || 'EMPTY',
            status: 'open',
            opened_at: new Date().toISOString(),
            total_sales: 0,
            total_orders: 0
        };

        const { data, error: insertError } = await supabase
            .from('cashier_sessions')
            .insert([payload])
            .select()
            .single();

        if (insertError) {
            console.error('[API-Shift] Error de inserción en Supabase:', insertError);
            return NextResponse.json({ 
                error: "Error al guardar en base de datos", 
                details: insertError.message 
            }, { status: 500 });
        }

        if (!data) {
            console.error('[API-Shift] No se devolvieron datos tras la inserción');
            return NextResponse.json({ error: "No se recibieron datos de la sesión creada" }, { status: 500 });
        }

        console.log(`✅ [API-Shift] Sesión abierta con ID: ${data.id}`);

        return NextResponse.json({
            success: true,
            session: data
        });

    } catch (error: any) {
        console.error('[API-Shift] Error catastrófico en el handler:', error);
        return NextResponse.json({ 
            error: error.message || "Error interno del servidor",
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}

