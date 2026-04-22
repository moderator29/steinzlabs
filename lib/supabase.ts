import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SESSION_SECONDS = 60 * 60; // 1 hour

// ─── Cookie helpers ──────────────────────────────────────────────────────────
// Supabase SSR chunks JWTs into sb-<ref>-auth-token.0/.1/.2 (each ~4KB).
// Without cleanup, a few logins push the Cookie header past Vercel's 32KB
// edge limit → 494. Fix: always wipe all sb-* chunks before writing a new
// one, and cap maxAge to 1 hour so they self-delete.

const SESSION_MAX_AGE = 60 * 60;

function cookieHosts(): string[] {
  if (typeof window === 'undefined') return [];
  const h = window.location.hostname;
  return Array.from(new Set([h, `.${h}`, h.split('.').slice(-2).join('.'), `.${h.split('.').slice(-2).join('.')}`]));
}
const COOKIE_PATHS = ['/', '/auth', '/dashboard', '/api'];

function nukeSbCookies() {
  if (typeof document === 'undefined') return;
  document.cookie.split(';').forEach(raw => {
    const name = raw.split('=')[0]?.trim();
    if (!name?.startsWith('sb-')) return;
    for (const h of cookieHosts()) for (const p of COOKIE_PATHS) {
      document.cookie = `${name}=; Path=${p}; Domain=${h}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = `${name}=; Path=${p}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  });
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  const sec = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Path=/; Max-Age=${SESSION_MAX_AGE}; SameSite=Lax${sec}`;
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  for (const h of cookieHosts()) for (const p of COOKIE_PATHS) {
    document.cookie = `${name}=; Path=${p}; Domain=${h}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    document.cookie = `${name}=; Path=${p}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}

// ─── Supabase browser client ─────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_supabase) return _supabase;

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
      cookies: {
        get: readCookie,
        set(name, value) {
          // Do NOT call nukeSbCookies() here — Supabase writes multiple
          // chunks sequentially (.0 then .1) and nuking on each write
          // deletes the previous chunk before all chunks are committed,
          // leaving a partial session → user sees welcome but stays on /login.
          // Cleanup of old sessions happens on login-page mount (useEffect)
          // and on logout. The 1-hour maxAge handles gradual expiry.
          writeCookie(name, value);
        },
        remove: deleteCookie,
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
