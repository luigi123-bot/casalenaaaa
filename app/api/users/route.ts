import { NextResponse } from 'next/server';
import { validateApiAccess, handleServerError, supabaseAdmin } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const userCreateSchema = z.object({
    role: z.enum(['administrador', 'cajero', 'cocina', 'cliente', 'repartidor']),
    fullName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6)
});

const userUpdateSchema = z.object({
    id: z.string().uuid(),
    role: z.enum(['administrador', 'cajero', 'cocina', 'cliente', 'repartidor']),
    fullName: z.string().min(1),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    isActive: z.boolean().optional()
});

export async function GET(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        let { data: profiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        let { data: usuarios, error: usuariosError } = await supabaseAdmin
            .from('usuarios')
            .select('*')
            .order('created_at', { ascending: false });

        if (usuariosError) {
            usuarios = [];
        }

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

        const { data: drivers, error: driversError } = await supabaseAdmin
            .from('delivery_drivers')
            .select('id');
            
        if (driversError) {
            console.warn('[USERS API] delivery_drivers check warning:', driversError);
        }

        const driverIds = new Set((drivers || []).map(d => d.id));

        unifiedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const finalUsers = unifiedUsers.map(u => ({
            ...u,
            role: driverIds.has(u.id) ? 'repartidor' : u.role
        }));

        return NextResponse.json(finalUsers);
    } catch (error: any) {
        return handleServerError(error, 'Get Users API Error');
    }
}

export async function PUT(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = userUpdateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de actualización inválidos' }, { status: 400 });
        }

        const { id, role, fullName, email, password, isActive } = parsed.data;

        // 1. Update Profile (Role & Full Name)
        const profileUpdates: any = {
            role: role === 'repartidor' ? 'cliente' : role,
            full_name: fullName,
        };

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdates)
            .eq('id', id);

        if (profileError) throw profileError;

        // Legacy sync with usuarios table
        try {
            await supabaseAdmin
                .from('usuarios')
                .update({ role: role === 'repartidor' ? 'cliente' : role, full_name: fullName })
                .eq('id', id);
        } catch (e) {
            // Safe fallback
        }

        // Handle delivery driver registration
        if (role === 'repartidor') {
            await supabaseAdmin
                .from('delivery_drivers')
                .upsert({
                    id: id,
                    full_name: fullName,
                    vehicle_type: 'moto',
                    status: 'disponible',
                    is_active: isActive !== false
                }, { onConflict: 'id' });
        }

        // 2. Update Auth User (email, password, metadata)
        const authUpdates: any = {
            user_metadata: {
                full_name: fullName,
                role: role
            },
        };

        if (email) authUpdates.email = email;
        if (password) authUpdates.password = password;
        if (isActive !== undefined) {
            authUpdates.ban_duration = isActive ? 'none' : '876000h';
        }

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            id,
            authUpdates
        );

        if (authError) throw authError;

        return NextResponse.json({ success: true, message: 'User updated successfully' });

    } catch (error: any) {
        return handleServerError(error, 'Update User API Error');
    }
}

export async function DELETE(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id || typeof id !== 'string') {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (error) throw error;

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return handleServerError(error, 'Delete User API Error');
    }
}

export async function POST(request: Request) {
    try {
        const { errorResponse } = await validateApiAccess(['administrador']);
        if (errorResponse) return errorResponse;

        const body = await request.json().catch(() => ({}));
        const parsed = userCreateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Datos de creación inválidos o faltan campos' }, { status: 400 });
        }

        const { role, fullName, email, password } = parsed.data;

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                role: role
            }
        });

        if (authError) throw authError;

        const userId = authData.user.id;

        // Create profile
        const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
            id: userId,
            email: email,
            full_name: fullName,
            role: role === 'repartidor' ? 'cliente' : role
        });

        if (profileError) throw profileError;

        // Delivery driver specific
        if (role === 'repartidor') {
            await supabaseAdmin.from('delivery_drivers').upsert({
                id: userId,
                full_name: fullName,
                vehicle_type: 'moto',
                status: 'disponible',
                is_active: true
            });
        }

        // Legacy Sync
        try {
            await supabaseAdmin.from('usuarios').upsert({
                id: userId,
                email: email,
                full_name: fullName,
                role: role === 'repartidor' ? 'cliente' : role
            });
        } catch (e) {
            // Legacy sync fail ignored safely
        }

        return NextResponse.json({ success: true, message: 'User created successfully', user: authData.user });

    } catch (error: any) {
        return handleServerError(error, 'Create User API Error');
    }
}
