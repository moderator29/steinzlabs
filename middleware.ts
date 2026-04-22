import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/api/auth', '/auth/callback', '/auth/clear'];

// Vercel's edge rejects requests with >32KB total headers with a 494 before
// this middleware even runs. The usual cause is accumulated Supabase auth
// cookies (the SSR client chunks large JWTs into .0 / .1 parts and stale
// pairs from multiple projects / auth attempts pile up). We pre-emptively
// nuke the auth cookies when the Cookie header climbs past 24KB so we never
// reach the edge's ceiling — affected users get bounced to /login with a
// one-shot "session reset" signal instead of the 494 wall.
const COOKIE_BUDGET_BYTES = 24 * 1024;

function isAuthCookie(name: string): boolean {
  return (
    name.startsWith('sb-') ||
    name === 'supabase-auth-token' ||
    name === '__stripe_mid' ||
    name === '__stripe_sid'
  );
}

function clearBloatedAuthCookies(request: NextRequest, response: NextResponse) {
  for (const c of request.cookies.getAll()) {
    if (isAuthCookie(c.name)) {
      response.cookies.set({ name: c.name, value: '', path: '/', maxAge: 0 });
    }
  }
}

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function applyHeaders(response: NextResponse) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isProtectedDashboard = path.startsWith('/dashboard');
  const isAdminRoute = path.startsWith('/admin');
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));

  // Pre-flight: if the cookie header is approaching the Vercel edge limit,
  // strip auth cookies now and redirect to /auth/clear. This saves users
  // stuck in the 494 REQUEST_HEADER_TOO_LARGE loop where every subsequent
  // request also fails at the edge — we intercept BEFORE that point.
  const cookieHeader = request.headers.get('cookie') || '';
  if (cookieHeader.length > COOKIE_BUDGET_BYTES) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/clear';
    url.searchParams.set('reason', 'cookie-overflow');
    url.searchParams.set('from', path);
    const resp = NextResponse.redirect(url);
    clearBloatedAuthCookies(request, resp);
    return applyHeaders(resp);
  }

  if (path === '/auth') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return applyHeaders(NextResponse.redirect(url));
  }

  if ((isProtectedDashboard || isAdminRoute) && !isPublic) {
    const response = NextResponse.next();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user || error) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('from', path);
      return applyHeaders(NextResponse.redirect(url));
    }

    return applyHeaders(response);
  }

  return applyHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|steinz-logo-128.png|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
