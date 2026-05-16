import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-static';
import { NextResponse } from 'next/server';

// Initialize Supabase Admin Client
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

export async function GET(request: Request) {
    try {
        // Fetch from profiles
        let { data: profiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (profilesError) {
            console.warn('Error fetching profiles:', profilesError);
            profiles = [];
        }

        // Fetch from usuarios (legacy)
        let { data: usuarios, error: usuariosError } = await supabaseAdmin
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });

        if (usuariosError) {
            console.warn('Error fetching usuarios:', usuariosError);
            usuarios = [];
        }

        // Merge logic: use profiles, fallback to usuarios if not in profiles
        const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        const unifiedUsers = [...(profiles || [])];

        (usuarios || []).forEach((u: any) => {
            if (!profilesMap.has(u.id)) {
                unifiedUsers.push({
                    ...u,
                    full_name: u.full_name || u.email || 'Usuario',
                    role: u.role || 'cliente'
                });
            }
        });

        // Fetch delivery drivers to map their role properly in the UI
        const { data: drivers } = await supabaseAdmin
            .from('delivery_drivers')
            .select('id');
            
        const driverIds = new Set((drivers || []).map(d => d.id));

        // Sort by creation date
        unifiedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Override role to 'repartidor' if they exist in delivery_drivers
        const finalUsers = unifiedUsers.map(u => ({
            ...u,
            role: driverIds.has(u.id) ? 'repartidor' : u.role
        }));

        return NextResponse.json(finalUsers);
    } catch (error: any) {
        console.error('Get users error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const { id, role, fullName, email, password, isActive } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        console.log(`📝 [API Update User] Updating user: ${id}, Role: ${role}, Name: ${fullName}`);

        // 1. Update Profile (Role & Full Name)
        const profileUpdates: any = {
            role: role === 'repartidor' ? 'cliente' : role,
            full_name: fullName,
        };

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdates)
            .eq('id', id);

        if (profileError) {
            console.error('Error updating profile:', profileError);
            throw new Error(profileError.message);
        } else {
            console.log('✅ [API Update User] Profile updated successfully');
        }

        // 1a. Update USUARIOS table (Legacy Sync)
        // To ensure consistency if any part of the app still relies on this table
        try {
            const { error: usuariosError } = await supabaseAdmin
                .from('usuarios')
                .update({ role: role === 'repartidor' ? 'cliente' : role, full_name: fullName })
                .eq('id', id);

            if (usuariosError) {
                console.warn('⚠️ [API Update User] Warning: Could not update usuarios table', usuariosError);
            } else {
                console.log('✅ [API Update User] Legacy usuarios table updated successfully');
            }
        } catch (e) {
            console.log('⚠️ [API Update User] Usuarios table might not exist or other error', e);
        }

        // Si el rol nuevo es repartidor, asegúrate de que exista en delivery_drivers
        if (role === 'repartidor') {
            try {
                const { error: driverError } = await supabaseAdmin
                    .from('delivery_drivers')
                    .upsert({
                        id: id,
                        full_name: fullName,
                        vehicle_type: 'moto',
                        status: 'disponible',
                        is_active: isActive !== false
                    }, { onConflict: 'id' });
                if (driverError) {
                    console.warn('⚠️ [API Update User] Could not sync delivery_drivers', driverError);
                }
            } catch (e) {
                console.error('Error syncing delivery_drivers', e);
            }
        }

        // 2. Update Auth User (email, password, metadata)
        const authUpdates: any = {
            user_metadata: {
                full_name: fullName,
                role: role // <--- CRITICAL: Sync role to metadata for Middleware
            },
        };

        // Update email if provided
        if (email) {
            authUpdates.email = email;
        }

        // Update password if provided
        if (password && password.length >= 6) {
            authUpdates.password = password;
        }

        // Handle active/inactive status
        if (isActive !== undefined) {
            authUpdates.ban_duration = isActive ? 'none' : '876000h';
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            id,
            authUpdates
        );

        if (authError) {
            console.error('Error updating auth:', authError);
            throw new Error(authError.message);
        }

        return NextResponse.json({ success: true, message: 'User updated successfully (DB + Auth Metadata)' });

    } catch (error: any) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Delete from Supabase Auth (cascades to profiles if configured)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { role, fullName, email, password } = await request.json();

        if (!email || !password || !fullName) {
            return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
        }

        console.log(`📝 [API Create User] Creating user: ${email}, Role: ${role}, Name: ${fullName}`);

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                role: role
            }
        });

        if (authError) {
            console.error('Error creating auth user:', authError);
            throw new Error(authError.message);
        }

        const userId = authData.user.id;

        // Create profile
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            id: userId,
            email: email,
            full_name: fullName,
            role: role === 'repartidor' ? 'cliente' : role
        });

        if (profileError) {
            console.warn('Error creating profile:', profileError);
        }

        // Si es repartidor, añadirlo a delivery_drivers
        if (role === 'repartidor') {
            await supabaseAdmin.from('delivery_drivers').upsert({
                id: userId,
                full_name: fullName,
                vehicle_type: 'moto',
                status: 'disponible',
                is_active: true
            });
        }

        // Sincronización Legacy con usuarios
        try {
            await supabaseAdmin.from('usuarios').upsert({
                id: userId,
                email: email,
                full_name: fullName,
                role: role === 'repartidor' ? 'cliente' : role
            });
        } catch (e) {
            console.warn('Error en sync legacy usuarios', e);
        }

        return NextResponse.json({ success: true, message: 'User created successfully', user: authData.user });

    } catch (error: any) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
