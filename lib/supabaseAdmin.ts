import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = ((process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY) || '').trim();

  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not available');
  }

  return createClient(SUPABASE_URL, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
