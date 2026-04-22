import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SESSION_SECONDS = 60 * 60; // 1 hour

// ─── Cookie helpers ──────────────────────────────────────────────────────────
// Vercel rejects requests whose Cookie header exceeds 32 KB with 494.
// The root cause: @supabase/ssr chunks JWTs into sb-<ref>-auth-token.0/.1/.2
// (each ~4 KB) and never deletes old chunks when it writes new ones. After
// a few logins the jar grows past 32 KB and the browser is permanently locked
// out. We fix this at the write path: before writing any new sb-* chunk we
// first nuke every existing sb-* cookie on every plausible (host × path)
// combination, and we always set a 1-hour maxAge so cookies expire instead
// of accumulating indefinitely.

const COOKIE_MAX_AGE = 60 * 60; // 1 h — matches SESSION_SECONDS

function cookieHosts(): string[] {
  if (typeof window === 'undefined') return [];
  const h = window.location.hostname;
  return Array.from(new Set([
    h, `.${h}`,
    h.replace(/^www\./, ''), `.${h.replace(/^www\./, '')}`,
    h.split('.').slice(-2).join('.'), `.${h.split('.').slice(-2).join('.')}`,
  ]));
}
const COOKIE_PATHS = ['/', '/auth', '/dashboard', '/api'];

function nukeSbCookies() {
  if (typeof document === 'undefined') return;
  const hosts = cookieHosts();
  document.cookie.split(';').forEach(raw => {
    const name = raw.split('=')[0]?.trim();
    if (!name?.startsWith('sb-')) return;
    for (const h of hosts) {
      for (const p of COOKIE_PATHS) {
        document.cookie = `${name}=; Path=${p}; Domain=${h}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
        document.cookie = `${name}=; Path=${p}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      }
    }
  });
}

function writeCookie(name: string, value: string, maxAge = COOKIE_MAX_AGE) {
  if (typeof document === 'undefined') return;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie.split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  const hosts = cookieHosts();
  for (const h of hosts) {
    for (const p of COOKIE_PATHS) {
      document.cookie = `${name}=; Path=${p}; Domain=${h}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = `${name}=; Path=${p}; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
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
        get(name: string) {
          return readCookie(name);
        },
        set(name: string, value: string) {
          // Wipe all existing sb-* shards from previous sessions BEFORE
          // writing the new chunk — this is what prevents accumulation.
          if (name.startsWith('sb-')) nukeSbCookies();
          writeCookie(name, value, COOKIE_MAX_AGE);
        },
        remove(name: string) {
          deleteCookie(name);
        },
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
