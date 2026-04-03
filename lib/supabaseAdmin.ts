import 'server-only';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

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
