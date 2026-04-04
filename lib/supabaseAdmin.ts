import 'server-only';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phvewrldcdxupsnakddx.supabase.co';

export function getSupabaseAdmin() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim() || SUPABASE_URL;
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY is not available');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
