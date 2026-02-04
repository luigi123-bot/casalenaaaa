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
        const { email, password, fullName, role, phoneNumber, address } = await request.json();

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
                full_name: fullName || '',
                phone_number: phoneNumber || '',
                address: address || ''
            }
        });

        if (authError) {
            console.error('Error creating user:', authError);
            return NextResponse.json(
                { error: authError.message },
                { status: 400 }
            );
        }

        // Actualizar el perfil con el rol y datos extra
        if (authData.user) {
            const updateData: any = {
                role: role || 'cliente',
                full_name: fullName || '',
                email: email // Force save email
            };

            // Add optional fields if they exist in the schema (ignoring errors if columns don't exist yet but preventing logical errors)
            // We assume profile table might be updated later to include these columns
            // For now, metadata is the safe storage
            if (phoneNumber) updateData.phone_number = phoneNumber;
            if (address) updateData.address = address;

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update(updateData)
                .eq('id', authData.user.id);

            if (profileError) {
                console.error('Error updating profile:', profileError);
            }

            // Ensure exists in USUARIOS (Legacy table support)
            // We now treat 'usuarios' as a mirror of 'profiles' with standardized columns
            try {
                const usuariosUpsertData: any = {
                    id: authData.user.id,
                    email: email,
                    role: updateData.role,
                    full_name: updateData.full_name,
                    phone_number: phoneNumber, // Standardized column
                    address: address // Standardized column
                };

                // Also legacy fields just in case
                // usuariosUpsertData.telefono = phoneNumber;
                // usuariosUpsertData.direccion = address;

                const { error: usuariosError } = await supabaseAdmin
                    .from('usuarios')
                    .upsert(usuariosUpsertData)
                    .select();

                if (usuariosError) {
                    console.warn('Warning: Could not update usuarios table', usuariosError);
                }
            } catch (e) {
                console.log('Usuarios table might not exist or other error', e);
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
