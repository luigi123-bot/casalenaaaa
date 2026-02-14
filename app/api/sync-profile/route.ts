import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();



        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        cookieStore.set({ name, value, ...options });
                    },
                    remove(name: string, options: CookieOptions) {
                        cookieStore.set({ name, value: '', ...options });
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get info from request body or metadata
        const { fullName, phone, address } = await request.json().catch(() => ({}));

        const userName = fullName || user.user_metadata.full_name || 'Cliente';
        const userPhone = phone || user.user_metadata.phone_number || '';
        const userAddress = address || user.user_metadata.address || '';
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
            console.log(`🔒 [Sync-Profile] Preserving existing role: ${currentRole} for ${userEmail}`);
        } else {
            console.log(`🆕 [Sync-Profile] New user or no role, defaulting to: ${currentRole}`);
        }

        // 2. Upsert PROFILE (Preserving Role)
        const profileData = {
            id: user.id,
            full_name: userName,
            email: userEmail,
            role: currentRole // Use preserved role
        };

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert(profileData, { onConflict: 'id' });

        if (profileError) console.error('Error syncing profile:', profileError);

        // 3. Upsert USUARIOS (Legacy - Preserving Role)
        const usuariosData = {
            id: user.id,
            full_name: userName,
            email: userEmail,
            role: currentRole // Use preserved role
        };

        const { error: usuariosError } = await supabaseAdmin
            .from('usuarios')
            .upsert(usuariosData, { onConflict: 'id' });

        if (usuariosError) console.error('Error syncing usuarios:', usuariosError);

        return NextResponse.json({ success: true, role: currentRole });

    } catch (error: any) {
        console.error('Sync error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
