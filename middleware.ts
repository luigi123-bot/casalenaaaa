import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    // Get user session securely
    const { data: { user } } = await supabase.auth.getUser();
    const { pathname } = request.nextUrl;

    console.log('🚧 [Middleware] Request:', request.method, pathname);

    // SKIP MIDDLEWARE FOR API ROUTES
    if (pathname.startsWith('/api/')) {
        console.log('⏩ [Middleware] Skipping API route:', pathname);
        return response;
    }

    // EXPLICIT BYPASS FOR PASSWORD UPDATE
    if (pathname === '/update-password') {
        console.log('🔓 [Middleware] Explicitly allowing /update-password');
        return response;
    }

    // PUBLIC ROUTES
    const publicRoutes = ['/login', '/register', '/tienda', '/forgot-password', '/update-password'];

    // Handle public routes
    if (publicRoutes.includes(pathname) || pathname.startsWith('/tienda')) {
        console.log('✅ [Middleware] Public route - allowing access to:', pathname);

        // If user is authenticated and trying to access login/register, redirect to their dashboard
        if (user && (pathname === '/login' || pathname === '/register')) {
            const role = await getUserRole(supabase, user.id);
            const redirectUrl = getRoleBasedRedirect(role);
            console.log('🔄 [Middleware] Authenticated user on login/register, redirecting to:', redirectUrl);
            return NextResponse.redirect(new URL(redirectUrl, request.url));
        }

        return response;
    }

    // PROTECTED ROUTES - Require authentication
    if (!user) {
        console.log('🔒 [Middleware] No user session, redirecting to login');
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Get user role
    const role = await getUserRole(supabase, user.id);
    console.log('👤 [Middleware] User role:', role, 'accessing:', pathname);

    // ROOT PATH - Redirect to role-based dashboard
    if (pathname === '/') {
        const redirectUrl = getRoleBasedRedirect(role);
        console.log('🏠 [Middleware] Root path, redirecting to:', redirectUrl);
        return NextResponse.redirect(new URL(redirectUrl, request.url));
    }

    // ROLE-BASED ACCESS CONTROL
    // Admin routes - accessible by admin and cajero
    if (pathname.startsWith('/admin')) {
        if (role !== 'administrador' && role !== 'cajero') {
            console.log('⛔ [Middleware] Unauthorized access to /admin, redirecting');
            return NextResponse.redirect(new URL(getRoleBasedRedirect(role), request.url));
        }
    }

    // Cashier routes - accessible by cajero and admin
    if (pathname.startsWith('/cashier')) {
        if (role !== 'cajero' && role !== 'administrador') {
            console.log('⛔ [Middleware] Unauthorized access to /cashier, redirecting');
            return NextResponse.redirect(new URL(getRoleBasedRedirect(role), request.url));
        }
    }

    // Kitchen routes - only for cocina role
    if (pathname.startsWith('/cocina')) {
        if (role !== 'cocina') {
            console.log('⛔ [Middleware] Unauthorized access to /cocina, redirecting');
            return NextResponse.redirect(new URL(getRoleBasedRedirect(role), request.url));
        }
    }

    console.log('✅ [Middleware] Access granted to:', pathname);
    return response;
}

// Helper function to get user role
async function getUserRole(supabase: any, userId: string): Promise<string | undefined> {
    // Try profiles table first
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    if (profile?.role) {
        return profile.role;
    }

    // Fallback to usuarios table
    const { data: usuario } = await supabase
        .from('usuarios')
        .select('role')
        .eq('id', userId)
        .single();

    return usuario?.role;
}

function getRoleBasedRedirect(role: string | undefined): string {
    console.log('🎯 [getRoleBasedRedirect] Role:', role);

    switch (role) {
        case 'administrador':
            return '/admin/users';
        case 'cajero':
            return '/cashier';
        case 'cocina':
            return '/cocina';
        case 'cliente':
            return '/tienda';
        default:
            console.log('⚠️ [getRoleBasedRedirect] Unknown role, defaulting to /login');
            return '/login';
    }
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
