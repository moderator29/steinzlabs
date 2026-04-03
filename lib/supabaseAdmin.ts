import 'server-only';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phvewrldcdxupsnakddx.supabase.co';

export function getSupabaseAdmin() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/^["']+|["']+$/g, '') || SUPABASE_URL;
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim().replace(/^["']+|["']+$/g, '');

  if (!serviceKey) {
    console.error('[Admin] SUPABASE_SERVICE_KEY is not set. Env keys available:', Object.keys(process.env).filter(k => k.includes('SUPA')).join(', '));
    throw new Error('Auth service configuration error');
  }

  console.log('[Admin] Creating client with URL length:', supabaseUrl.length, 'key length:', serviceKey.length);

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
