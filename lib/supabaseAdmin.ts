import 'server-only';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://phvewrldcdxupsnakddx.supabase.co';

export function getSupabaseAdmin() {
  const envUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/^["']+|["']+$/g, '');
  const supabaseUrl = (envUrl && envUrl.startsWith('https://')) ? envUrl : SUPABASE_URL;
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim().replace(/^["']+|["']+$/g, '');

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_KEY is not available');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
