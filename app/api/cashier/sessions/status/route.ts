import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

// Configuramos Supabase con Service Role para asegurar que pueda leer sin importar el RLS
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

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: "Falta el userId" }, { status: 400 });
        }

        const { data: activeSession, error } = await supabase
            .from('cashier_sessions')
            .select('id, opened_at, initial_fund')
            .eq('status', 'open')
            .eq('user_id', userId)
            .order('opened_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // Ignoramos el error "0 rows"
            console.error('[API-Session-Status] Error Supabase:', error);
            throw error;
        }

        return NextResponse.json({
            isOpen: !!activeSession,
            session: activeSession || null
        });

    } catch (error: any) {
        console.error('[API-Session-Status] Error:', error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
