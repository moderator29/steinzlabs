import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'steinz-auth-token',
        flowType: 'implicit',
      },
    })
  : null as any;

if (typeof window !== 'undefined' && supabase) {
  supabase.auth.onAuthStateChange((event: string, session: any) => {
    if (session) {
      const remember = localStorage.getItem('steinz_remember_me') !== 'false';
      const maxAge = remember ? `; max-age=${60 * 60 * 24 * 7}` : '';
      document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax${maxAge}`;
    } else {
      document.cookie = 'steinz_session=; path=/; max-age=0';
      localStorage.removeItem('steinz_remember_me');
    }
  });
}

export function setRememberMe(value: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('steinz_remember_me', value ? 'true' : 'false');
  }
}

