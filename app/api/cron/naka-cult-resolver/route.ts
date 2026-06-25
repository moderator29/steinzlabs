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

    // Collect every (user_id, evm_address) tuple from BOTH wallet stores:
    //   user_wallets_v2  — built-in Naka wallet(s); addresses live inside the
    //                      JSONB `wallets` array (per CLAUDE.md schema gotchas)
    //   wallet_identities — wallets the user signed IN with (SIWE)
    // Reading only user_wallets_v2 (the prior behaviour) meant a Founder Pass
    // / NIPPO / $NAKA wallet a user signed in with was never re-checked daily.
    const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
    const addrsByUser = new Map<string, Set<string>>();
    const addFor = (userId: string, address: string | undefined | null) => {
      if (!address || typeof address !== 'string' || !EVM_RE.test(address)) return;
      const set = addrsByUser.get(userId) ?? new Set<string>();
      set.add(address.toLowerCase());
      addrsByUser.set(userId, set);
    };

    const [{ data: walletsV2 }, { data: identities }] = await Promise.all([
      supabase.from('user_wallets_v2').select('user_id, wallets, default_address'),
      supabase.from('wallet_identities').select('user_id, address, chain'),
    ]);

    for (const row of walletsV2 ?? []) {
      const userId = (row as { user_id: string }).user_id;
      const wallets = (row as { wallets: unknown }).wallets;
      if (Array.isArray(wallets)) {
        for (const w of wallets as Array<{ address?: string }>) addFor(userId, w?.address);
      }
      addFor(userId, (row as { default_address?: string }).default_address);
    }
    for (const row of identities ?? []) {
      addFor((row as { user_id: string }).user_id, (row as { address?: string }).address);
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
