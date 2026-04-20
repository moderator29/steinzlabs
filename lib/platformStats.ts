import { createClient } from '@supabase/supabase-js';

// Server-only helper to atomically increment a platform-wide counter that
// appears on the landing page. Backed by the `increment_platform_stat`
// SECURITY DEFINER function in Supabase. Safe to call from any server
// route after a real event. Silently no-ops if Supabase isn't configured.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

type StatKey = 'tokens_analyzed' | 'rugs_detected' | 'swaps_protected';

let cachedClient: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  if (cachedClient) return cachedClient;
  cachedClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export async function incrementPlatformStat(stat: StatKey, delta = 1): Promise<void> {
  const client = getClient();
  if (!client) return;
  try {
    // Supabase generated types don't know about this new RPC yet — loosely
    // typed until we regenerate db types after the migration applies.
    await (client.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>)(
      'increment_platform_stat',
      { stat_name: stat, delta },
    );
  } catch (err) {
    // Counter failures must never break the primary request path.
    console.warn('[platformStats] increment failed:', (err as Error).message);
  }
}
