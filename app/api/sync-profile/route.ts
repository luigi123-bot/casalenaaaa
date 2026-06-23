import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from "@/utils/supabase/server";
import { z } from "zod";

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
    fullName: z.string().max(255).optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable()
});

export async function POST(request: Request) {
    try {
        const { user, errorResponse } = await validateApiAccess(['administrador', 'cajero', 'cocina', 'cliente', 'repartidor']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
        }

        const { fullName, phone, address } = parsed.data;

        const userName = fullName || user.user_metadata?.full_name || 'Cliente';
        const userPhone = phone || user.user_metadata?.phone_number || '';
        const userAddress = address || user.user_metadata?.address || '';
        const userEmail = user.email;

        // 1. Check existing profile to PREVENT ROLE OVERWRITE
        let currentRole = 'cliente';

        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (existingProfile && existingProfile.role) {
            currentRole = existingProfile.role;
        }

        // 2. Upsert PROFILE (Preserving Role)
        const profileData = {
            id: user.id,
            full_name: userName,
            email: userEmail,
            role: currentRole
        };

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' });

        if (profileError) throw profileError;

        // 3. Upsert USUARIOS (Legacy - Preserving Role)
        const usuariosData = {
            id: user.id,
            full_name: userName,
            email: userEmail,
            role: currentRole
        };

        const { error: usuariosError } = await supabaseAdmin
            .from('usuarios')
            .upsert(usuariosData, { onConflict: 'id' });

        if (usuariosError) throw usuariosError;

        return NextResponse.json({ success: true, role: currentRole });

    } catch (error: any) {
        return handleServerError(error, 'Sync Profile API Error');
    }
}

