import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SESSION_SECONDS = 60 * 60; // 1 hour

let _supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_supabase) return _supabase;

  // IMPORTANT: do NOT pass a custom `storageKey` here.
  // @supabase/ssr writes session cookies named `sb-<projectref>-auth-token.*`
  // and the server middleware in middleware.ts reads them by that exact name.
  // Overriding `storageKey` causes a name mismatch — middleware never sees the
  // session and redirects authenticated users back to /login. (Production bug 2026-04-17.)
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
    const value = (client as Record<string, unknown>)[prop as string];
    return typeof value === 'function' ? (value as Function).bind(client) : value;
  }
});

export function setRememberMe(value: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('steinz_remember_me', value ? 'true' : 'false');
  }
}
