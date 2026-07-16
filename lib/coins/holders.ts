import 'server-only';

/**
 * Real on-chain holder count for a coin. GoPlus returns holder_count on BOTH its
 * EVM and Solana token-security endpoints, so scanTokenSecurity gives us one
 * honest source across every coin chain (solana / ethereum / bsc). It is cached
 * by the security layer and is usually already warm because rug-risk and the
 * Naka Score read the same scan for the same coin. Returns null (honest "no
 * data") rather than a fabricated 0 when the provider has nothing.
 */

import { scanTokenSecurity } from '@/lib/security/goplusService';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function getRealHolderCount(chain: string, address: string): Promise<number | null> {
  try {
    const sec = await scanTokenSecurity(address, chain);
    const n = Number(sec?.holderCount ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  } catch {
    return null;
  }
}

/** Persist a fresh holder count onto the registry row (fire-and-forget safe). */
export async function persistHolderCount(chain: string, tokenKey: string, count: number): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from('coin_registry').update({ holders_count: count }).eq('chain', chain).eq('token_key', tokenKey);
  } catch {
    /* best-effort cache; the value is re-fetched next time regardless */
  }
}
