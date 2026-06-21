import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/api/auth', '/auth/callback', '/auth/clear'];

// Vercel's edge rejects requests with oversized total headers (494
// REQUEST_HEADER_TOO_LARGE) BEFORE this middleware runs, so this guard can
// only catch a request on the way up — once cookies exceed the edge ceiling
// the request never reaches us. The usual cause is accumulated Supabase auth
// cookies (the SSR client chunks large JWTs into .0 / .1 parts and stale
// pairs from multiple projects / auth attempts pile up). We pre-emptively
// nuke cookies when the Cookie header climbs past 8KB — well below the edge
// ceiling — so affected users get bounced to /auth/clear + /login instead of
// the 494 wall. The threshold is deliberately aggressive: above 8KB we're on
// a trajectory to the ceiling, and a forced re-login is a much cheaper
// failure mode than a bricked site.
const COOKIE_BUDGET_BYTES = 8 * 1024; // 8KB — well under the Vercel edge header ceiling

// When a request triggers the overflow guard we wipe EVERY cookie, not
// just auth ones. At 8KB+ something is off — translate cookies, tracking
// cookies, stray testing fixtures, any of it — and the only reliable way
// to recover is to nuke the whole jar. Users log in again; no app data
// lives in cookies (we use localStorage for wallets, preferences, chat
// history), so nothing important is lost.
function clearAllCookies(request: NextRequest, response: NextResponse) {
  for (const c of request.cookies.getAll()) {
    response.cookies.set({ name: c.name, value: '', path: '/', maxAge: 0 });
    // Also clear on bare domain + leading-dot domain so pre-deploy chunks
    // written against alternate host variants don't survive the sweep.
    response.cookies.set({ name: c.name, value: '', path: '/', maxAge: 0, domain: request.nextUrl.hostname });
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

  // Pre-flight: if the cookie header is anywhere near the Vercel edge
  // ceiling, nuke the jar and redirect to /auth/clear. Except we don't
  // want to loop — /auth/clear itself is exempt, otherwise a user whose
  // incoming cookies still haven't been committed by the browser yet
  // would bounce back here forever.
  const cookieHeader = request.headers.get('cookie') || '';
  if (cookieHeader.length > COOKIE_BUDGET_BYTES && path !== '/auth/clear') {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/clear';
    url.searchParams.set('reason', 'cookie-overflow');
    url.searchParams.set('size', String(cookieHeader.length));
    url.searchParams.set('from', path);
    const resp = NextResponse.redirect(url);
    clearAllCookies(request, resp);
    return applyHeaders(resp);
  }

  if (path === '/auth') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return applyHeaders(NextResponse.redirect(url));
  }

  if ((isProtectedDashboard || isAdminRoute) && !isPublic) {
    const response = NextResponse.next();

    // Cap every auth cookie we write to SESSION_MAX_AGE so they
    // self-destruct and can never accumulate past the 8KB budget.
    const SESSION_MAX_AGE = 60 * 60; // 1 hour — matches app/login SESSION_HOURS

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            // Do NOT force httpOnly on these cookies. They are @supabase/ssr
            // auth cookies that the BROWSER client (createBrowserClient in
            // lib/supabase.ts) reads and writes via document.cookie. Forcing
            // httpOnly here made them (a) unreadable by the SDK — so the
            // client thought it had no session and churned through re-auth,
            // and (b) undeletable by our client-side recovery (clearSbCookies
            // + /auth/clear use document.cookie, which cannot touch httpOnly
            // cookies). That combination is exactly how users got permanently
            // stuck behind the 494 REQUEST_HEADER_TOO_LARGE wall: stale auth
            // chunks accumulated, no in-app path could clear them, and only a
            // manual browser-settings wipe recovered the account.
            //
            // We also no longer delete sibling sb-* chunks inside set().
            // Supabase writes chunks (.0, .1, …) in sequence; nuking the
            // others on each write dropped not-yet-rewritten chunks and
            // corrupted multi-chunk sessions (see the warning in
            // lib/supabase.ts). Stale shards are handled by the 1-hour maxAge
            // cap below and the server-side sweep on the sign-out redirect.
            response.cookies.set({
              name,
              value,
              ...options,
              // Hard cap so a session cookie never outlives 1 hour (matches
              // the browser client's SESSION_SECONDS). Keeps orphaned shards
              // from lingering indefinitely.
              maxAge: options.maxAge ? Math.min(options.maxAge, SESSION_MAX_AGE) : SESSION_MAX_AGE,
              sameSite: 'lax',
              secure: true,
              path: '/',
            });
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({ name, value: '', ...options, maxAge: 0, path: '/' });
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user || error) {
      // Also clear any stale sb-* cookies on the redirect so the
      // browser doesn't carry them to /login and start accumulating again.
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/login';
      redirectUrl.searchParams.set('from', path);
      const redirectResp = NextResponse.redirect(redirectUrl);
      request.cookies.getAll()
        .filter(c => c.name.startsWith('sb-'))
        .forEach(c => redirectResp.cookies.set({ name: c.name, value: '', path: '/', maxAge: 0 }));
      return applyHeaders(redirectResp);
    }

    // Server-side admin role gate. The /admin/layout.tsx client component
    // also checks a bearer token, but that's UI-level only — the route is
    // reachable without it. This block enforces profiles.role='admin'
    // before any /admin/* page renders. Non-admins get bounced to
    // /dashboard with ?denied=admin so the UI can surface a toast.
    if (isAdminRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single<{ role: string | null }>();
      if (!profile || profile.role !== 'admin') {
        const denyUrl = request.nextUrl.clone();
        denyUrl.pathname = '/dashboard';
        denyUrl.searchParams.set('denied', 'admin');
        return applyHeaders(NextResponse.redirect(denyUrl));
      }
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
