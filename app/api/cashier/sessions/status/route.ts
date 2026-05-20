import { NextResponse } from "next/server";
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const querySchema = z.object({
    userId: z.string().uuid().nullable().optional()
});

export async function GET(req: Request) {
    try {
        const { errorResponse, user } = await validateApiAccess(['administrador', 'cajero']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(req.url);
        const parsed = querySchema.safeParse({
            userId: searchParams.get('userId') || null
        });

        if (!parsed.success) {
            return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
        }

        // IDOR Prevention: Only admins can query another user's session status
        const resolvedUserId = (parsed.data.userId && user!.role === 'administrador') 
            ? parsed.data.userId 
            : user!.id;

        const { data: activeSession, error } = await supabaseAdmin
            .from('cashier_sessions')
            .select('id, opened_at, initial_fund')
            .eq('status', 'open')
            .eq('user_id', resolvedUserId)
            .order('opened_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        return NextResponse.json({
            isOpen: !!activeSession,
            session: activeSession || null
        });

    } catch (error: any) {
        return handleServerError(error, 'Cashier Session Status Error');
    }
}

