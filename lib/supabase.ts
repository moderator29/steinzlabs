import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SESSION_SECONDS = 60 * 60; // 1 hour

// ─── Auth-cookie sweep ───────────────────────────────────────────────────────
// Called on login-page mount (before signIn) and on sign-out.
// Wipes every sb-* chunk from every host×path combo so old session
// shards from previous logins/deploys don't accumulate in the browser.
// We do NOT call this inside the Supabase cookie adapter — Supabase
// writes multiple chunks sequentially and nuking inside set() deletes
// the previous chunk before all are committed, breaking the session.
export function clearSbCookies() {
  if (typeof document === 'undefined') return;
  const h = typeof window !== 'undefined' ? window.location.hostname : '';
  const hosts = h ? Array.from(new Set([h, `.${h}`, h.split('.').slice(-2).join('.'), `.${h.split('.').slice(-2).join('.')}`])) : [];
  const paths = ['/', '/auth', '/dashboard', '/api'];
  document.cookie.split(';').forEach(raw => {
    const name = raw.split('=')[0]?.trim();
    if (!name?.startsWith('sb-')) return;
    for (const host of hosts) for (const p of paths) {
      document.cookie = `${name}=; Path=${p}; Domain=${host}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    for (const p of paths) {
      document.cookie = `${name}=; Path=${p}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  });
}

// ─── Supabase browser client ─────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_supabase) return _supabase;

  // cookieOptions.maxAge caps every session cookie at 1 hour so they
  // self-delete instead of accumulating indefinitely. autoRefreshToken
  // rewrites the cookie every ~55 min while the user is active, so
  // active users are never logged out. Only idle >1 h sessions expire.
  _supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      cookieOptions: {
        maxAge: SESSION_SECONDS,
        sameSite: 'lax',
        secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
        path: '/',
      },
    }
  );

  return _supabase;
}

export function isSupabaseReady(): boolean {
  getClient();
  return true;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as unknown as Record<string, unknown>)[prop as string];
    return typeof value === 'function' ? (value as Function).bind(client) : value;
  }
});

export function setRememberMe(value: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('steinz_remember_me', value ? 'true' : 'false');
  }
}
