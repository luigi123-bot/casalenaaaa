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

export async function PUT(request: Request) {
    try {
        const { id, role, fullName, isActive } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 1. Update Profile (Role & Full Name)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                role,
                full_name: fullName,
                // Add status column if you have it in profiles, otherwise we might need to handle 'isActive' via auth.admin.updateUser ban/unban
            })
            .eq('id', id);

        if (profileError) {
            console.error('Error updating profile:', profileError);
            throw new Error(profileError.message);
        }

        // 2. Update Auth Metadata (to keep it in sync, optional but recommended)
        const authUpdates: any = {
            user_metadata: { full_name: fullName },
            ban_duration: isActive ? 'none' : '876000h'
        };

        // Allow Admin to force-reset password if provided
        // This is useful if users hit email rate limits
        const { password } = await request.json().catch(() => ({}));
        if (password && password.length >= 6) {
            authUpdates.password = password;
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

        // Delete from Supabase Auth (this usually cascades to public.users/profiles if configured, 
        // but we'll let Supabase handle the foreign key cascade if it exists, or just auth deletion)
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
