import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * Every distinct EVM address linked to a user across BOTH wallet stores:
 *   - wallet_identities  — wallets the user signed IN with (SIWE/SIWS)
 *   - user_wallets_v2    — the built-in Naka wallet(s); addresses live inside
 *                          the JSONB `wallets` array + a separate
 *                          `default_address` (per CLAUDE.md schema gotchas)
 *
 * The on-chain entitlement resolver historically read only user_wallets_v2, so
 * a Founder-Pass / NIPPO / $NAKA wallet a user *signed in* with was never
 * re-checked and never granted Max/cult. Unifying the read here closes that
 * gap for both the daily cron and the on-demand refresh endpoint.
 *
 * EVM only: NIPPO, the Founder Pass, and $NAKA all live on Ethereum mainnet.
 * Lower-casing is safe here — every address is already validated as EVM (the
 * Solana case-sensitivity rule does not apply to 0x addresses).
 */
export async function getUserEvmAddresses(userId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  const out = new Set<string>();

  const [idents, v2] = await Promise.all([
    sb.from('wallet_identities').select('address, chain').eq('user_id', userId),
    sb.from('user_wallets_v2').select('wallets, default_address').eq('user_id', userId),
  ]);

  for (const r of idents.data ?? []) {
    const a = (r as { address?: string }).address;
    if (a && EVM_RE.test(a)) out.add(a.toLowerCase());
  }

  for (const row of v2.data ?? []) {
    const wallets = (row as { wallets?: unknown }).wallets;
    if (Array.isArray(wallets)) {
      for (const w of wallets as Array<{ address?: string }>) {
        if (w?.address && EVM_RE.test(w.address)) out.add(w.address.toLowerCase());
      }
    }
    const def = (row as { default_address?: string }).default_address;
    if (def && EVM_RE.test(def)) out.add(def.toLowerCase());
  }

  return Array.from(out);
}
