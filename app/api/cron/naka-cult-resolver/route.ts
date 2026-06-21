import 'server-only';
import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { applyWalletEntitlements } from '@/lib/cult/entitlements';
import { verifyCron, cronResponse, logCronExecution, withCronErrorReporting } from '@/app/api/cron/_shared';

/**
 * Daily on-chain entitlement resolver.
 *
 * Sweeps every wallet we know about and reconciles each user's decoupled
 * entitlements via applyWalletEntitlements():
 *   NIPPO NFT / >= 1,227,000 $NAKA → cult membership (profiles.cult_member)
 *   Founder Pass NFT              → Max-tier platform access (6 months)
 *
 * Grants on qualification; revokes on-chain-granted access when the wallet no
 * longer qualifies (NFT transferred / balance dropped). Stripe subscriptions
 * and legacy/admin grants are never touched.
 *
 * Wired in vercel.json (owner action: add cron entry after merge). Runs daily
 * at 03:13 UTC by convention so it doesn't collide with whale-backfill-pnl.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5min budget

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  return await withCronErrorReporting('naka-cult-resolver', startedAt, async () => {
    const supabase = getSupabaseAdmin();

    // Collect every (user_id, evm_address) tuple. user_wallets_v2.wallets is
    // JSONB; addresses live inside the JSON (per CLAUDE.md schema gotchas).
    const { data: walletsV2 } = await supabase
      .from('user_wallets_v2')
      .select('user_id, wallets, default_address');

    const addrsByUser = new Map<string, Set<string>>();
    for (const row of walletsV2 ?? []) {
      const userId = (row as { user_id: string }).user_id;
      const wallets = (row as { wallets: unknown }).wallets;
      if (!Array.isArray(wallets)) continue;
      for (const w of wallets as Array<{ address?: string }>) {
        if (!w?.address || typeof w.address !== 'string') continue;
        // EVM only — both NFTs and $NAKA live on Ethereum mainnet.
        if (!/^0x[a-fA-F0-9]{40}$/.test(w.address)) continue;
        const set = addrsByUser.get(userId) ?? new Set<string>();
        set.add(w.address.toLowerCase());
        addrsByUser.set(userId, set);
      }
    }

    if (addrsByUser.size === 0) {
      await logCronExecution('naka-cult-resolver', 'success', Date.now() - startedAt, undefined, 0);
      return cronResponse('naka-cult-resolver', startedAt, { users: 0, cultGranted: 0, maxGranted: 0 });
    }

    let cultGranted = 0;
    let maxGranted = 0;
    for (const [userId, addrs] of addrsByUser.entries()) {
      try {
        const ent = await applyWalletEntitlements(userId, Array.from(addrs));
        if (ent.cult) cultGranted++;
        if (ent.max) maxGranted++;
      } catch {
        /* per-user failure must not abort the whole sweep */
      }
    }

    await logCronExecution('naka-cult-resolver', 'success', Date.now() - startedAt, undefined, addrsByUser.size);
    return cronResponse('naka-cult-resolver', startedAt, {
      users: addrsByUser.size,
      cultGranted,
      maxGranted,
    });
  });
}
