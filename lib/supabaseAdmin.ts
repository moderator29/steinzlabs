import 'server-only';
import { createClient } from '@supabase/supabase-js';

function sanitizeUrl(raw: string | undefined): string {
  if (!raw) return '';
  let url = raw.trim().replace(/^["']+|["']+$/g, '');
  if (url && !url.startsWith('http')) {
    url = 'https://' + url;
  }
  return url;
}

export function getSupabaseAdmin() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseUrl = sanitizeUrl(rawUrl);
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();

  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_KEY is not set');
    throw new Error('Auth service configuration error');
  }

  if (!supabaseUrl || !supabaseUrl.startsWith('https://')) {
    console.error('NEXT_PUBLIC_SUPABASE_URL is invalid. Raw length:', rawUrl?.length, 'Sanitized:', supabaseUrl?.substring(0, 15));
    throw new Error('Auth service configuration error');
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
