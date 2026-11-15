import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// Public endpoints exempted from authentication (informational/protocol standards only)
const PUBLIC_PATHS = [
  '/.well-known/security.txt',
  '/robots.txt',
  '/login',
  '/api/auth/login',
  '/privacy',
  '/terms',
  '/gdpr',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIp(request.headers);

  // 1. Allow static Next.js assets
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 2. Check if path is public informational
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + '/'));

  // 3. Authenticate private routes
  if (!isPublicPath) {
    const auth = validateRequest(request);

    if (!auth.authenticated) {
      // If API route: return JSON 401
      if (pathname.startsWith('/api/')) {
        const response = NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
            message: 'Autentificare necesară. Accesul este strict rezervat personalului autorizat.',
            status: 401,
          },
          { status: 401 }
        );
        applySecurityHeaders(response);
        return response;
      }

      // If browser page route: redirect to /login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      applySecurityHeaders(redirectResponse);
      return redirectResponse;
    }

    // Rate Limiting for authenticated API routes
    if (pathname.startsWith('/api/')) {
      const rateLimit = checkRateLimit({
        windowMs: 60 * 1000,
        maxRequests: 60,
        identifier: `api:${ip}:${auth.user || 'anon'}`,
      });

      if (!rateLimit.allowed) {
        const response = NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded. Too many requests.',
            status: 429,
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(rateLimit.retryAfterSeconds || 60),
            },
          }
        );
        applySecurityHeaders(response);
        return response;
      }
    }
  }

  // Pass request forward and apply security headers to the response
  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

function applySecurityHeaders(response: NextResponse) {
  // HSTS (1 year)
  response.headers.set('Strict-Transport-Security', 'max-age=31536000');

  // Restrictive Content Security Policy (CSP)
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // Clickjacking & framing protection
  response.headers.set('X-Frame-Options', 'DENY');

  // MIME type sniffing protection
  response.headers.set('X-Content-Type-Options', 'nosniff');

  // Referrer Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions Policy: disable all non-essential browser hardware APIs
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );

  // Cross-Origin Isolation
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  response.headers.set('Origin-Agent-Cluster', '?1');

  // Search Engine Protection: absolutely no indexing or snippet archiving
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');

  // Private content protection from caching
  response.headers.set(
    'Cache-Control',
    'private, no-cache, no-store, max-age=0, must-revalidate'
  );

  // Remove framework disclosure
  response.headers.delete('x-powered-by');
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
