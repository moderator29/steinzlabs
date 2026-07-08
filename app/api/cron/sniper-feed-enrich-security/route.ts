/**
 * Sniper discover-feed security backfill.
 *
 * sniper-feed-ingest writes rows into `sniper_feed_tokens` from DexScreener /
 * launchpad providers, which don't carry contract-security data. So every feed
 * row lands with `security_score = null` (plus null is_honeypot / buy_tax /
 * sell_tax). The UI's `statusFromRow` maps a null score to "scanning" forever,
 * and the "exclude honeypots" audit filter (is_honeypot) is a no-op because the
 * column is never populated.
 *
 * This cron calls GoPlus token_security per row via the shared
 * getTokenSecurity() (L1/L2 cached) and writes the real security columns back.
 *
 * Ordering matters. ~98% of the feed is Solana, and GoPlus token_security for
 * Solana lives at a plan-gated path on the current API key
 * (/solana/token_security/) — every Solana call currently throws. The previous
 * version ordered the WHOLE feed newest-first with a fixed batch, so the window
 * filled up with fresh Solana rows that all threw and enriched nothing, while
 * the ~75 EVM rows GoPlus DOES scan starved permanently behind hundreds of
 * fresher Solana rows (0 of 5313 enriched over 8 days).
 *
 * The fix: drain the OLDEST-unenriched EVM backlog first (chain != solana,
 * ORDER BY first_seen_at ASC) with the bulk of the budget, then spend a small
 * fixed remainder probing Solana. So EVM makes steady progress today, and the
 * moment the GoPlus plan covers Solana those probes start landing too — without
 * EVM ever being starved. A single bad token is skipped without aborting the
 * tick or wasting the rest of the budget; the update is idempotent, so running
 * every 2 min (even with an overlapping tick) only re-writes the same values.
 */

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getTokenSecurity, SecurityRateLimitError } from '@/lib/services/goplus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NAME = 'sniper-feed-enrich-security';
// EVM rows drained per tick, OLDEST-unenriched first. GoPlus scans every EVM
// chain we ingest (ethereum/base/arbitrum/optimism), so this is the enrichable
// backlog and gets the bulk of the per-tick budget.
const EVM_BATCH = 30;
// Solana rows probed per tick (see file header). Currently plan-gated and
// throwing; kept small so the tick stays cheap and never starves EVM, while
// still resuming automatically if/when the GoPlus plan covers Solana.
const SOLANA_PROBE = 10;

type SupabaseAdmin = ReturnType<typeof getSupabaseAdmin>;

interface FeedRow {
  id: string;
  chain: string;
  token_address: string;
}

interface EnrichOutcome {
  enriched: number;
  failed: number;
  skipped: number;
  rateLimited: boolean;
}

/**
 * Enrich a batch of feed rows in place. Skip-and-continue on a per-token throw
 * (one plan-gated / unindexed token must not abort the batch); a provider 429
 * stops the whole tick early since every remaining call would also throttle.
 * `failCaptureBase` offsets the "too many failures" Sentry threshold so the
 * Solana probe — expected to throw while plan-gated — doesn't page on its own.
 */
async function enrichBatch(
  admin: SupabaseAdmin,
  rows: FeedRow[],
  failCaptureBase: number,
): Promise<EnrichOutcome> {
  let enriched = 0;
  let failed = 0;
  let skipped = 0;
  let rateLimited = false;

  for (const row of rows) {
    if (!row.token_address || !row.chain) {
      skipped++;
      continue;
    }
    try {
      const sec = await getTokenSecurity(row.token_address, row.chain);
      const raw = (sec.raw ?? {}) as Record<string, unknown>;

      // Brand-new tokens often come back from GoPlus with an EMPTY snapshot
      // (no is_honeypot field, no holders) before it has indexed the contract.
      // Writing that snapshot would permanently freeze is_honeypot=false /
      // score=100 for a token GoPlus simply hadn't scanned yet (the cron only
      // revisits rows with a null security_score). Skip those rows this tick;
      // the next tick retries them. Solana derives honeypot from
      // non_transferable, which GoPlus always returns, so it never skips.
      const honeypotKnown = row.chain === 'solana'
        || raw.is_honeypot === '0' || raw.is_honeypot === '1';
      if (!honeypotKnown && sec.holderCount === 0) {
        skipped++;
        continue;
      }

      // GoPlus buy/sell tax are decimal fractions (0.05 = 5%). The feed's
      // buy_tax / sell_tax / dev_holding_pct columns are stored as fractions
      // (the UI multiplies by 100 for display), so pass them through as-is.
      // dev_sold_all: only derivable when GoPlus actually returned a holders
      // list — creatorHoldingPct defaults to 0 when the list is absent, which
      // would fabricate "dev sold everything" for every unindexed token.
      // Solana: the Solana branch hardcodes creatorHoldingPct=0, so EVM only.
      const holdersList = Array.isArray(raw.holders)
        ? raw.holders
        : Array.isArray(raw._holders) ? raw._holders : [];
      const devSoldAll = row.chain !== 'solana' && sec.creatorAddress && holdersList.length > 0
        ? sec.creatorHoldingPct <= 0
        : null;

      const patch: Record<string, unknown> = {
        is_honeypot: honeypotKnown ? sec.isHoneypot : null,
        buy_tax: sec.buyTax,
        sell_tax: sec.sellTax,
        security_score: sec.trustScore,
        dev_holding_pct: sec.creatorHoldingPct,
        dev_sold_all: devSoldAll,
        updated_at: new Date().toISOString(),
      };
      // Only overwrite holders when GoPlus actually returned a count — a zero
      // means "unavailable" for brand-new pools and would clobber a real value.
      if (sec.holderCount > 0) patch.holders = sec.holderCount;

      // Idempotent: re-scoping to security_score IS NULL means a concurrent
      // overlapping tick that already enriched this row is a no-op, not a
      // double write of stale data.
      const { error: updErr } = await admin
        .from('sniper_feed_tokens')
        .update(patch)
        .eq('id', row.id)
        .is('security_score', null);
      if (!updErr) enriched++;
      else failed++;
    } catch (err) {
      failed++;
      // Provider throttled — remaining calls in this tick will also 429, so
      // stop early and let the next tick resume. Not a bug, don't page Sentry.
      if (err instanceof SecurityRateLimitError) {
        rateLimited = true;
        break;
      }
      // Don't poison Sentry with one bad token per tick — only capture when a
      // meaningful fraction of the batch fails. failCaptureBase lets the Solana
      // probe (expected to throw while plan-gated) stay silent.
      if (failCaptureBase + failed > 5) {
        Sentry.captureException(err, { tags: { cron: NAME, token: row.token_address, chain: row.chain } });
      }
    }
  }

  return { enriched, failed, skipped, rateLimited };
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();

  // EVM backlog first, OLDEST unenriched first, so the starved EVM rows behind
  // the Solana wall actually drain instead of being perpetually skipped.
  const { data: evmRows, error: evmErr } = await admin
    .from('sniper_feed_tokens')
    .select('id,chain,token_address')
    .is('security_score', null)
    .neq('chain', 'solana')
    .order('first_seen_at', { ascending: true })
    .limit(EVM_BATCH);

  if (evmErr) {
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, evmErr.message, 0);
    return cronResponse(NAME, startedAt, { error: evmErr.message });
  }

  // Small Solana probe, also oldest-first for deterministic progress if the
  // plan gate lifts. A fetch error here is non-fatal — EVM work still counts.
  const { data: solRows, error: solErr } = await admin
    .from('sniper_feed_tokens')
    .select('id,chain,token_address')
    .is('security_score', null)
    .eq('chain', 'solana')
    .order('first_seen_at', { ascending: true })
    .limit(SOLANA_PROBE);

  if (solErr) {
    Sentry.captureException(solErr, { tags: { cron: NAME, stage: 'solana-probe-fetch' } });
  }

  const evmFeed = (evmRows ?? []) as FeedRow[];
  const solFeed = (solRows ?? []) as FeedRow[];

  if (evmFeed.length === 0 && solFeed.length === 0) {
    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
    return cronResponse(NAME, startedAt, { scanned: 0, enriched: 0, noWork: true });
  }

  // Drain the enrichable EVM backlog first.
  const evm = await enrichBatch(admin, evmFeed, 0);

  // Then spend the small remaining budget probing Solana — unless the EVM pass
  // already hit a provider 429 (in which case Solana would only throttle too).
  const sol = evm.rateLimited
    ? { enriched: 0, failed: 0, skipped: solFeed.length, rateLimited: true }
    : await enrichBatch(admin, solFeed, evm.failed);

  const enriched = evm.enriched + sol.enriched;
  const scanned = evmFeed.length + solFeed.length;

  await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, enriched);
  return cronResponse(NAME, startedAt, {
    scanned,
    enriched,
    evm: { scanned: evmFeed.length, enriched: evm.enriched, failed: evm.failed, skipped: evm.skipped },
    solana: { scanned: solFeed.length, enriched: sol.enriched, failed: sol.failed, skipped: sol.skipped, probe: true },
    rateLimited: evm.rateLimited || sol.rateLimited,
  });
}
