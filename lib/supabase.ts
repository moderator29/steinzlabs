import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder';

let _supabase: SupabaseClient | null = null;

function isConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!(url && url.startsWith('https://') && url.includes('.supabase.co'));
}

function getClient(): SupabaseClient {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'steinz-auth-token',
      flowType: 'implicit',
    },
  });

  if (typeof window !== 'undefined' && isConfigured()) {
    _supabase.auth.onAuthStateChange((event: string, session: any) => {
      const isSecure = window.location.protocol === 'https:';
      const securePart = isSecure ? '; Secure' : '';
      if (session) {
        const remember = localStorage.getItem('steinz_remember_me') !== 'false';
        const maxAge = remember ? `; max-age=${60 * 60 * 24 * 7}` : '';
        document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax${securePart}${maxAge}`;
        localStorage.setItem('steinz_has_session', 'true');
      } else {
        document.cookie = `steinz_session=; path=/; max-age=0${securePart}`;
        localStorage.removeItem('steinz_remember_me');
        localStorage.removeItem('steinz_has_session');
      }
    });
  }

  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export function setRememberMe(value: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('steinz_remember_me', value ? 'true' : 'false');
  }
}
