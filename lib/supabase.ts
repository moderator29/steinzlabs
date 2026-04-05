import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phvewrldcdxupsnakddx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBodmV3cmxkY2R4dXBzbmFrZGR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMDA0NjMsImV4cCI6MjA5MDc3NjQ2M30.xHGPMphDjMsPN566gRcGle5Mp8mEBxGiI1HXDX9M7ZU';

export const SESSION_SECONDS = 60 * 60 * 4;

let _supabase: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_supabase) return _supabase;

  _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'steinz-auth-token',
      flowType: 'implicit',
    },
  });

  if (typeof window !== 'undefined') {
    try {
      _supabase.auth.onAuthStateChange((event: string, session: any) => {
        const isSecure = window.location.protocol === 'https:';
        const securePart = isSecure ? '; Secure' : '';
        if (session) {
          document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax${securePart}; max-age=${SESSION_SECONDS}`;
          localStorage.setItem('steinz_has_session', 'true');
        } else {
          document.cookie = `steinz_session=; path=/; max-age=0${securePart}`;
          localStorage.removeItem('steinz_has_session');
        }
      });
    } catch (err) {
      console.error('Auth state listener setup failed:', err);
    }
  }

  return _supabase;
}

export function isSupabaseReady(): boolean {
  getClient();
  return true;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

export function setRememberMe(value: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('steinz_remember_me', value ? 'true' : 'false');
  }
}
