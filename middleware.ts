import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/api/auth'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let supabaseDomain = '';
try {
  if (supabaseUrl && supabaseUrl.startsWith('http')) {
    supabaseDomain = new URL(supabaseUrl).hostname;
  }
} catch {}

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://s.tradingview.com https://s3.tradingview.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://s.tradingview.com https://s3.tradingview.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' https://fonts.gstatic.com https://s.tradingview.com",
    `connect-src 'self' https://${supabaseDomain} https://api.coingecko.com https://*.tradingview.com https://*.ethereum.org https://*.infura.io https://*.alchemy.com https://api.dexscreener.com https://io.dexscreener.com wss://*.tradingview.com`,
    "frame-src 'self' https://s.tradingview.com https://s3.tradingview.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

function applyHeaders(response: NextResponse) {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const isProtected = path.startsWith('/dashboard');
  const isPublic = PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'));

  if (isProtected && !isPublic) {
    const hasSession = ['naka_session', 'steinz_session'].some(name => {
      const cookie = request.cookies.get(name)?.value;
      return cookie && cookie.length > 10;
    });

    const hasSupabaseSession = request.cookies.getAll().some(c =>
      c.name.startsWith('sb-') && c.name.endsWith('-auth-token') && c.value.length > 10
    );

    if (!hasSession && !hasSupabaseSession) {
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
