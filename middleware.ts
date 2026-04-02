import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Security Headers Firewall
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 1. Protection against clickjacking
  response.headers.set('X-Frame-Options', 'DENY');

  // 2. Protection against XSS
  response.headers.set('X-XSS-Protection', '1; mode=block');

  // 3. Protection against MIME-sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // 4. Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 5. Strict Transport Security (HSTS)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // 6. Basic Content Security Policy (Adjust as needed)
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co;"
  );

  // 7. Request Throttling / Bulk Data Protection (Basic implementation)
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const path = request.nextUrl.pathname;
  
  // Example: Prevent massive POST requests to API routes
  if (request.method === 'POST' && path.startsWith('/api')) {
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    if (contentLength > 1000000) { // 1MB limit for safety
      return new NextResponse(
        JSON.stringify({ error: 'Payload too large' }),
        { status: 413, headers: { 'content-type': 'application/json' } }
      );
    }
  }

  // 8. SQL Injection Sanitization (Heuristic check for common patterns in query params)
  const url = request.nextUrl;
  const maliciousPatterns = [
    /select\s+.*\s+from/i,
    /union\s+all\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /--/,
    /xp_cmdshell/i
  ];

  const searchParams = url.searchParams.toString();
  if (maliciousPatterns.some(pattern => pattern.test(searchParams))) {
    console.warn(`[Firewall] Blocked malicious query pattern from ${ip}`);
    return new NextResponse(
      JSON.stringify({ error: 'Security violation detected' }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
    '/api/:path*',
  ],
};
