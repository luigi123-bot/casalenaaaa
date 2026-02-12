import { createClient } from '@supabase/supabase-js';
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

        // Sort by creation date
        unifiedUsers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return NextResponse.json(unifiedUsers);
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

        // 1. Update Profile (Role & Full Name)
        const profileUpdates: any = {
            role,
            full_name: fullName,
        };

        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update(profileUpdates)
            .eq('id', id);

        if (profileError) {
            console.error('Error updating profile:', profileError);
            throw new Error(profileError.message);
        }

        // 2. Update Auth User (email, password, metadata)
        const authUpdates: any = {
            user_metadata: { full_name: fullName },
        };

        // Update email if provided
        if (email) {
            authUpdates.email = email;
        }

        // Update password if provided (optional)
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

        return NextResponse.json({ success: true });

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
