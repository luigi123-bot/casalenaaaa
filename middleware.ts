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

    // DEBUG LOGS - FORCE VISIBILITY
    console.log('🚧 [Middleware] Request:', request.method, pathname);

    // SKIP MIDDLEWARE FOR API ROUTES
    if (pathname.startsWith('/api/')) {
        console.log('⏩ [Middleware] Skipping API route:', pathname);
        return response;
    }

    // 1. ROOT PATH HANDLING - ABSOLUTE PRIORITY
    if (pathname === '/') {
        if (!user) {
            console.log('🚀 [Middleware] ROOT -> /tienda (No session detected)');
            const url = request.nextUrl.clone();
            url.pathname = '/tienda';
            return NextResponse.redirect(url);
        }
        console.log('👤 [Middleware] ROOT with session -> Proceeding to role check');
    }

    // 2. PUBLIC ROUTES
    const publicRoutes = ['/login', '/register', '/tienda', '/forgot-password', '/update-password'];

    // Logic for public routes
    if (publicRoutes.includes(pathname) || pathname.startsWith('/tienda')) {
        console.log('✅ [Middleware] Public route - allowing access to:', pathname);
        if (user) {
            // Only redirect if trying to access login/register
            if (pathname === '/login' || pathname === '/register') {
                // Fetch role to redirect
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();

                // If profile not found, try 'usuarios' table or default to something safe
                let role = profile?.role;
                if (!role) {
                    const { data: usuario } = await supabase
                        .from('usuarios')
                        .select('role')
                        .eq('id', user.id)
                        .single();
                    role = usuario?.role;
                }

                const redirectUrl = getRoleBasedRedirect(role);
                console.log('🔄 [Middleware] Redirecting authenticated user from', pathname, 'to', redirectUrl);
                return NextResponse.redirect(new URL(redirectUrl, request.url));
            }
        }
        // Allow access to /tienda without auth
        console.log('✅ [Middleware] Allowing access to /tienda');
        return response;
    }

    // Protected routes
    if (!user) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Role checks
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    let role = profile?.role;
    // Fallback if not in profiles
    if (!role) {
        const { data: usuario } = await supabase
            .from('usuarios')
            .select('role')
            .eq('id', user.id)
            .single();
        role = usuario?.role;
    }

    // Redirect logic
    if (pathname.startsWith('/admin')) {
        if (role !== 'administrador' && role !== 'cajero') {
            return NextResponse.redirect(new URL(getRoleBasedRedirect(role), request.url));
        }
    }

    if (pathname.startsWith('/cocina')) {
        if (role !== 'cocina') {
            return NextResponse.redirect(new URL(getRoleBasedRedirect(role), request.url));
        }
    }

    if (pathname === '/') {
        return NextResponse.redirect(new URL(getRoleBasedRedirect(role), request.url));
    }

    return response;
}

function getRoleBasedRedirect(role: string | undefined): string {
    switch (role) {
        case 'administrador':
        case 'cajero':
            return '/admin/users';
        case 'cocina':
            return '/cocina';
        case 'cliente':
            return '/tienda';
        default:
            return '/login';
    }
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
