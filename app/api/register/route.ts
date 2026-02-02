import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Crear cliente de Supabase con la service role key (solo del lado del servidor)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Esta key tiene permisos de admin
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function POST(request: Request) {
    try {
        const { email, password, fullName, role } = await request.json();

        // Validaciones
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email y contraseña son requeridos' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 6 caracteres' },
                { status: 400 }
            );
        }

        // Crear usuario en Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirmar email
            user_metadata: {
                full_name: fullName || ''
            }
        });

        if (authError) {
            console.error('Error creating user:', authError);
            return NextResponse.json(
                { error: authError.message },
                { status: 400 }
            );
        }

        // Actualizar el perfil con el rol
        if (authData.user && role) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({
                    role: role,
                    full_name: fullName || ''
                })
                .eq('id', authData.user.id);

            if (profileError) {
                console.error('Error updating profile:', profileError);
            }
        }

        return NextResponse.json({
            success: true,
            user: {
                id: authData.user?.id,
                email: authData.user?.email,
                role: role || 'cajero'
            }
        });

    } catch (error: any) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { error: 'Error al crear usuario' },
            { status: 500 }
        );
    }
}
