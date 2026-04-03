import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/api/auth'];

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

async function verifySupabaseJWT(token: string): Promise<boolean> {
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.sub) return false;
    if (payload.role === 'anon' || payload.role === 'service_role') return false;
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

function extractTokenFromCookies(request: NextRequest): string | null {
  const steinzCookie = request.cookies.get('steinz_session')?.value;
  if (steinzCookie) return steinzCookie;

  // Check Supabase SSR auth token cookies (sb-<ref>-auth-token)
  const sbCookie = request.cookies.getAll().find(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  );
  if (sbCookie?.value) {
    try {
      // Supabase SSR stores as JSON array or object
      const parsed = JSON.parse(sbCookie.value);
      if (Array.isArray(parsed) && parsed[0]) return parsed[0];
      if (parsed?.access_token) return parsed.access_token;
    } catch {
      return sbCookie.value;
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isProtected = path.startsWith('/dashboard');
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));

  if (isProtected && !isPublic) {
    const token = extractTokenFromCookies(request);
    const isValid = await verifySupabaseJWT(token ?? '');

    if (!isValid) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('from', path);
      return applyHeaders(NextResponse.redirect(url));
    }
  }

  if (path === '/auth') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return applyHeaders(NextResponse.redirect(url));
  }

  return applyHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|steinz-logo-128.png|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
