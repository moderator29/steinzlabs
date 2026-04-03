import { createClient, SupabaseClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://phvewrldcdxupsnakddx.supabase.co';
const SESSION_SECONDS = 60 * 60 * 48;

let _supabase: SupabaseClient | null = null;
let _configured = false;

function clean(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^["']+|["']+$/g, '');
}

function getUrl(): string {
  const env = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (env && env.startsWith('https://') && env.includes('.supabase.co')) return env;
  return FALLBACK_URL;
}

function getKey(): string {
  return clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isConfigured(): boolean {
  const key = getKey();
  return !!(key && key.length > 20);
}

function getClient(): SupabaseClient {
  if (_supabase) return _supabase;

  _configured = isConfigured();
  const supabaseUrl = getUrl();
  const supabaseAnonKey = getKey();

  if (!supabaseAnonKey) {
    console.warn('[Supabase] Anon key not available, auth will not work');
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder', {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'steinz-auth-token',
      flowType: 'implicit',
    },
  });

  if (typeof window !== 'undefined' && _configured) {
    try {
      _supabase.auth.onAuthStateChange((event: string, session: any) => {
        const isSecure = window.location.protocol === 'https:';
        const securePart = isSecure ? '; Secure' : '';
        if (session) {
          document.cookie = `steinz_session=${session.access_token}; path=/; SameSite=Lax${securePart}; max-age=${SESSION_SECONDS}`;
          localStorage.setItem('steinz_has_session', 'true');
        } else {
          document.cookie = `steinz_session=; path=/; max-age=0${securePart}`;
          localStorage.removeItem('steinz_remember_me');
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
  return _configured;
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
