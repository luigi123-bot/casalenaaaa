import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

const inputSchema = z.object({
    cashier_name: z.string().min(1),
    initial_fund: z.union([z.number(), z.string()]).transform(val => parseFloat(val as string) || 0).optional().default(0),
    notes: z.string().optional().default('')
});

export async function POST(req: Request) {
    try {
        const { errorResponse, user } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const body = await req.json().catch(() => ({}));
        const parsed = inputSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: "Datos de sesión inválidos" }, { status: 400 });
        }

        const { cashier_name, initial_fund, notes } = parsed.data;
        const resolvedUserId = user!.id; // IDOR fix: always use active session's user ID!

        // 1. Verificar si ya existe una sesión abierta para este usuario
        const { data: existingSession, error: checkError } = await supabaseAdmin
            .from('cashier_sessions')
            .select('id')
            .eq('user_id', resolvedUserId)
            .eq('status', 'open')
            .maybeSingle();
        
        if (checkError) {
            console.warn('[API-Shift] Session check warning:', checkError);
        }

        if (existingSession) {
            return NextResponse.json({ 
                success: true, 
                message: "Ya existe una sesión abierta", 
                session: existingSession 
            });
        }

        // 2. Insertar nueva sesión
        const payload = {
            cashier_name: cashier_name,
            user_id: resolvedUserId,
            initial_fund: initial_fund,
            notes: notes || 'EMPTY',
            status: 'open',
            opened_at: new Date().toISOString(),
            total_sales: 0,
            total_orders: 0
        };

        const { data, error: insertError } = await supabaseAdmin
            .from('cashier_sessions')
            .insert([payload])
            .select()
            .single();

        if (insertError) throw insertError;
        if (!data) throw new Error("No data returned on cashier session insert");

        return NextResponse.json({
            success: true,
            session: data
        });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Open Session Error');
    }
}


