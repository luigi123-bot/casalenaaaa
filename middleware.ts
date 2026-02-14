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
                    request.cookies.set({ name, value, ...options });
                    response = NextResponse.next({ request: { headers: request.headers } });
                    response.cookies.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options });
                    response = NextResponse.next({ request: { headers: request.headers } });
                    response.cookies.set({ name, value: '', ...options });
                },
            },
        }
    );

    // 1. Get user session securely
    const { data: { user } } = await supabase.auth.getUser();
    const { pathname } = request.nextUrl;

    // 2. SKIP ASSETS AND APIs
    if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.')) {
        return response;
    }

    // 3. GET ROLE FROM METADATA (FASTEST & SAFEST)
    // We trust the JWT token metadata. If it's stale, the user must re-login.
    const role = (user?.user_metadata?.role || 'cliente').toLowerCase();

    if (user) {
        console.log(`👤 [Middleware] User: ${user.email} | Role: ${role} | Path: ${pathname}`);
    }

    // 4. PUBLIC ROUTES
    const publicRoutes = ['/login', '/register', '/tienda', '/forgot-password', '/update-password'];
    const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || pathname === '/';

    if (isPublicRoute) {
        // If logged in and trying to access auth pages, redirect to dashboard
        if (user && (pathname === '/login' || pathname === '/register' || pathname === '/')) {
            const dashboard = getDashboardLink(role);
            console.log(`🔄 [Middleware] Redirecting logged in user to: ${dashboard}`);
            return NextResponse.redirect(new URL(dashboard, request.url));
        }

        // Prevent Cashier/Admin from browsing store as client (optional)
        if (user && role !== 'cliente' && pathname.startsWith('/tienda')) {
            const dashboard = getDashboardLink(role);
            return NextResponse.redirect(new URL(dashboard, request.url));
        }

        return response;
    }

    // 5. PROTECTED ROUTES - Require Login
    if (!user) {
        console.log('🔒 [Middleware] No session, redirecting to login');
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // 6. ROLE ACCESS CONTROL
    // Admin
    if (pathname.startsWith('/admin')) {
        if (role !== 'administrador' && role !== 'cajero') { // Admin and Cashier (for some parts)
            return NextResponse.redirect(new URL(getDashboardLink(role), request.url));
        }
    }

    // Cashier
    if (pathname.startsWith('/cashier')) {
        if (role !== 'cajero' && role !== 'administrador') {
            return NextResponse.redirect(new URL(getDashboardLink(role), request.url));
        }
    }

    // Kitchen
    if (pathname.startsWith('/cocina')) {
        if (role !== 'cocina' && role !== 'administrador') {
            return NextResponse.redirect(new URL(getDashboardLink(role), request.url));
        }
    }

    return response;
}

// Simple helper for dashboard links
function getDashboardLink(role: string): string {
    switch (role) {
        case 'administrador': return '/admin';
        case 'cajero': return '/cashier/dashboard';
        case 'cocina': return '/cocina';
        default: return '/tienda';
    }
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
