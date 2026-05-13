import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getTokenBalances } from '@/lib/services/alchemy';
import { getSolanaWalletTokens } from '@/lib/services/alchemy-solana';
import { getDexPrice } from '@/lib/services/dexscreener';

export const runtime = 'nodejs';
export const maxDuration = 30;

const NAME = 'cult-refresh-treasury';

/**
 * Cron — snapshots the cult treasury balance every 6 hours.
 *
 * Reads the live $NAKA balance for NAKA_TREASURY_WALLET and inserts a row
 * into cult_treasury_snapshots so the Conclave Treasury Panel renders fresh
 * numbers without manual seeding.
 *
 * Until NAKA_TOKEN_CONTRACT and NAKA_TREASURY_WALLET are both set, exits in
 * <100ms with skipped='env_unset' — same gating philosophy as
 * cult-verify-membership: don't pretend to refresh when the chain side
 * doesn't exist yet.
 *
 * Schedule: every 6 hours (`0 *‍/6 * * *`).
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const startedAt = Date.now();
  const tokenContract = process.env.NAKA_TOKEN_CONTRACT;
  const treasuryWallet = process.env.NAKA_TREASURY_WALLET;

  if (!tokenContract || !treasuryWallet) {
    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, 'success', duration, undefined, 0);
    return NextResponse.json({
      ok: true,
      durationMs: duration,
      skipped: 'env_unset',
      hint: 'Set both NAKA_TOKEN_CONTRACT and NAKA_TREASURY_WALLET to enable.',
    });
  }

  try {
    const isEvm = /^0x[a-fA-F0-9]{40}$/.test(treasuryWallet);
    let balanceNaka: number | null = null;

    if (isEvm) {
      const balances = await getTokenBalances(treasuryWallet, 'ethereum');
      const match = balances.find(
        b => b.contractAddress.toLowerCase() === tokenContract.toLowerCase(),
      );
      if (match?.tokenBalance) {
        const decimals = match.decimals ?? 18;
        balanceNaka = Number(BigInt(match.tokenBalance)) / 10 ** decimals;
      } else {
        balanceNaka = 0;
      }
    } else {
      // Solana mints case-sensitive — direct equality.
      const tokens = await getSolanaWalletTokens(treasuryWallet);
      const match = tokens.find(t => t.mint === tokenContract);
      balanceNaka = match ? Number(match.uiAmount ?? 0) : 0;
    }

    // USD enrichment. DexScreener is free, keyless and indexes both EVM and
    // Solana, so it works for whichever chain the treasury is on without
    // branching. Failure here must not poison the snapshot — balance_naka
    // is the authoritative number; balance_usd stays null when pricing is
    // cold and the UI degrades to "—".
    let balanceUsd: number | null = null;
    if (balanceNaka != null && balanceNaka > 0) {
      try {
        const priceUsd = await getDexPrice(tokenContract);
        if (priceUsd > 0) {
          balanceUsd = balanceNaka * priceUsd;
        }
      } catch {
        // Swallow — see comment above.
      }
    } else if (balanceNaka === 0) {
      balanceUsd = 0;
    }

    const admin = getSupabaseAdmin();
    const { error: insErr } = await admin.from('cult_treasury_snapshots').insert({
      balance_naka: balanceNaka,
      balance_usd: balanceUsd,
      source: isEvm ? 'alchemy' : 'helius',
      notes: `Auto-refresh by ${NAME}`,
    });
    if (insErr) throw insErr;

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, 'success', duration, undefined, 1);
    return NextResponse.json({ ok: true, durationMs: duration, balanceNaka, balanceUsd });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, 0);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
