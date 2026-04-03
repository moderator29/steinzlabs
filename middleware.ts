import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIES = ['naka_session', 'steinz_session'];

const PUBLIC_PATHS = ['/', '/auth', '/api/auth'];

const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://s.tradingview.com https://s3.tradingview.com https://auth.privy.io https://*.privy.io",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://s.tradingview.com https://s3.tradingview.com",
    "img-src 'self' data: blob: https: http:",
    "font-src 'self' https://fonts.gstatic.com https://s.tradingview.com",
    "connect-src 'self' https://auth.privy.io https://*.privy.io https://api.coingecko.com https://*.tradingview.com https://*.ethereum.org https://*.infura.io https://*.alchemy.com https://*.walletconnect.com https://*.walletconnect.org https://rpc.walletconnect.com https://rpc.walletconnect.org https://api.dexscreener.com https://io.dexscreener.com wss://*.tradingview.com wss://*.walletconnect.com wss://*.walletconnect.org wss://relay.walletconnect.com wss://relay.walletconnect.org",
    "frame-src 'self' https://auth.privy.io https://*.privy.io https://s.tradingview.com https://s3.tradingview.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

function applyHeaders(response: NextResponse, request: NextRequest) {
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
    const hasSession = SESSION_COOKIES.some(name => {
      const cookie = request.cookies.get(name)?.value;
      return cookie && cookie.length > 10;
    });

    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      url.searchParams.set('from', path);
      return applyHeaders(NextResponse.redirect(url), request);
    }
  }

  return applyHeaders(NextResponse.next(), request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|steinz-logo-128.png|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
