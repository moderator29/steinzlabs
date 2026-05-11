import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveHoldings, holdingsResolverEnabled } from '@/lib/cult/holdings';

export const runtime = 'nodejs';
export const maxDuration = 120;

const NAME = 'cult-verify-membership';

type WalletEntry = { address: string; chain?: string };

/**
 * Cron — re-verifies on-chain holdings for every active naka_cult member daily.
 *
 * For each member with a connected wallet:
 *   - reads on-chain $NAKA balance + NFT ownership via resolveHoldings()
 *   - if the wallet still qualifies → leaves tier alone, syncs is_chosen
 *   - if the wallet no longer qualifies → demotes to 'free' tier
 *
 * Until NAKA_TOKEN_CONTRACT (and the NFT contracts) are set, the resolver
 * is disabled and this cron exits in <100ms with skipped='resolver_disabled'.
 * That's intentional: tier is set manually via SQL until $NAKA mints, and
 * we don't want this cron demoting hand-promoted accounts.
 *
 * Schedule: daily 03:00 UTC.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();

  if (!holdingsResolverEnabled()) {
    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, 'success', duration, undefined, 0);
    return NextResponse.json({
      ok: true,
      durationMs: duration,
      skipped: 'resolver_disabled',
      hint: 'Set NAKA_TOKEN_CONTRACT (or the NFT contract envs) to enable.',
    });
  }

  let processed = 0;
  let demoted = 0;
  let chosenChanged = 0;

  try {
    const admin = getSupabaseAdmin();

    // Pull every current naka_cult member + their default wallet address.
    const { data: members, error: selErr } = await admin
      .from('profiles')
      .select('id, is_chosen')
      .eq('tier', 'naka_cult');
    if (selErr) throw selErr;
    if (!members || members.length === 0) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, 'success', duration, undefined, 0);
      return NextResponse.json({ ok: true, durationMs: duration, processed: 0 });
    }

    // Batch wallet lookups — one query, then fan out per-wallet on-chain calls.
    const memberIds = members.map(m => m.id);
    const { data: walletRows } = await admin
      .from('user_wallets_v2')
      .select('user_id, wallets, default_address')
      .in('user_id', memberIds);

    const walletByUser = new Map<string, string | null>();
    for (const row of walletRows ?? []) {
      const wallets = (row.wallets as WalletEntry[] | null) ?? [];
      const defaultAddr = row.default_address ?? wallets[0]?.address ?? null;
      walletByUser.set(row.user_id, defaultAddr);
    }

    for (const member of members) {
      const wallet = walletByUser.get(member.id);
      if (!wallet) continue; // no connected wallet → skip (don't demote)

      const holdings = await resolveHoldings(wallet);
      processed += 1;

      if (!holdings.isMember) {
        // Demote — wallet no longer qualifies on any of the 3 paths.
        await admin
          .from('profiles')
          .update({ tier: 'free', is_chosen: false })
          .eq('id', member.id);
        demoted += 1;
        continue;
      }

      // Sync is_chosen if it drifted (e.g. Dev NFT was sold).
      if (holdings.isChosen !== member.is_chosen) {
        await admin
          .from('profiles')
          .update({ is_chosen: holdings.isChosen })
          .eq('id', member.id);
        chosenChanged += 1;
      }
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, 'success', duration, undefined, processed);
    return NextResponse.json({ ok: true, durationMs: duration, processed, demoted, chosenChanged });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, processed);
    return NextResponse.json({ ok: false, error: msg, processed, demoted }, { status: 500 });
  }
}
