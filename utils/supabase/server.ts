import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Centralized Supabase Admin Client for database operations requiring bypass of RLS or secure validation
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

/**
 * Creates a server-side Supabase client using cookies from the headers.
 */
export async function getServerSupabase() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value, ...options });
                    } catch (e) {
                        // ignore cookie mutation inside read-only route contexts
                    }
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.set({ name, value: '', ...options });
                    } catch (e) {
                        // ignore cookie mutation inside read-only route contexts
                    }
                },
            },
        }
    );
}

/**
 * Authenticates the user based on the request's cookies.
 * Returns the authenticated user object or null if unauthorized.
 */
export async function getAuthenticatedUser() {
    try {
        const supabase = await getServerSupabase();
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) return null;
        return user;
    } catch (e) {
        return null;
    }
}

/**
 * Authenticates the user and returns their database-verified role.
 */
export async function getAuthenticatedUserWithRole() {
    const user = await getAuthenticatedUser();
    if (!user) return null;

    try {
        // Retrieve actual role from database profiles table for security
        const { data: profile, error } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const resolvedRole = (profile?.role || user.user_metadata?.role || 'cliente').toLowerCase();

        return {
            ...user,
            role: resolvedRole
        };
    } catch (e) {
        return {
            ...user,
            role: (user.user_metadata?.role || 'cliente').toLowerCase()
        };
    }
}

/**
 * Validates if the current requester is authenticated and has one of the required roles.
 * Returns the user with role if successful, or a NextResponse error if failed.
 */
export async function validateApiAccess(requiredRoles?: string[]) {
    const userWithRole = await getAuthenticatedUserWithRole();
    
    if (!userWithRole) {
        return {
            errorResponse: NextResponse.json({ error: 'No autorizado: Inicie sesión' }, { status: 401 }),
            user: null
        };
    }

    if (requiredRoles && requiredRoles.length > 0) {
        const hasRole = requiredRoles.some(role => userWithRole.role === role.toLowerCase());
        if (!hasRole) {
            return {
                errorResponse: NextResponse.json({ error: 'Prohibido: Permisos insuficientes' }, { status: 403 }),
                user: null
            };
        }
    }

    return {
        errorResponse: null,
        user: userWithRole
    };
}

/**
 * Wraps server operations in a standardized try/catch to return generic, opaque error messages
 * while logging the real technical errors to the server console.
 */
export function handleServerError(error: any, contextMessage: string = 'Error de servidor') {
    // ⚠️ Security Log: we log the actual database details safely to server console,
    // but we NEVER leak raw errors or error.message back to the client.
    console.error(`[SERVER-ERROR] ${contextMessage}:`, {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack
    });

    return NextResponse.json(
        { error: 'Error interno del servidor. Por favor intente más tarde.' },
        { status: 500 }
    );
}
