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
        storageKey: 'naka-auth-token',
        flowType: 'implicit',
      },
    })
  : null as any;

if (typeof window !== 'undefined' && supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      const remember = localStorage.getItem('naka_remember_me') !== 'false';
      const maxAge = remember ? `; max-age=${60 * 60 * 24 * 7}` : '';
      document.cookie = `naka_session=${session.access_token}; path=/; SameSite=Lax${maxAge}`;
    } else {
      document.cookie = 'naka_session=; path=/; max-age=0';
      localStorage.removeItem('naka_remember_me');
    }
  });
}

export function setRememberMe(value: boolean) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('naka_remember_me', value ? 'true' : 'false');
  }
}

export function getSupabaseAdmin() {
  let serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY is not available');
  }

  try {
    const expectedRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
    if (expectedRef) {
      const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64').toString());
      if (payload.ref !== expectedRef) {
        const fs = require('fs');
        const envFile = fs.readFileSync('.env.local', 'utf8');
        const match = envFile.match(/SUPABASE_SERVICE_KEY=(eyJ[^\s\n]+)/);
        if (match?.[1]) {
          const localPayload = JSON.parse(Buffer.from(match[1].split('.')[1], 'base64').toString());
          if (localPayload.ref === expectedRef) {
            serviceKey = match[1];
          }
        }
      }
    }
  } catch {}

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
