import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
let _initialized = false;

function getSupabaseClient(): SupabaseClient | null {
  if (_initialized) return _supabase;
  _initialized = true;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

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

  if (typeof window !== 'undefined') {
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
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      if (prop === 'auth') {
        return new Proxy({}, {
          get() {
            return () => Promise.resolve({ data: null, error: new Error('Supabase not configured') });
          }
        });
      }
      return undefined;
    }
    return (client as any)[prop];
  }
});

export function setRememberMe(value: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('steinz_remember_me', value ? 'true' : 'false');
  }
}
