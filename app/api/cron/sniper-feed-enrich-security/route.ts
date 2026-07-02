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
 * This cron walks the newest feed rows with a null security_score, calls GoPlus
 * token_security per row via the shared getTokenSecurity() (L1/L2 cached), and
 * writes the real security columns back onto the row. Capped at a small batch
 * per tick — each GoPlus call costs ~1-2s and we stay well inside maxDuration.
 *
 * Non-EVM chains: Solana routes through GoPlus's Solana path inside
 * scanTokenSecurity, so SPL rows enrich too; a single bad token is skipped
 * without failing the tick.
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
const BATCH = 40;

interface FeedRow {
  id: string;
  chain: string;
  token_address: string;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();

  // security_score is a real column, so filter the un-audited rows directly
  // (no in-memory over-fetch needed). Newest first — the freshest listings are
  // what the discover feed surfaces, so they benefit most from enrichment.
  const { data: rows, error: fetchErr } = await admin
    .from('sniper_feed_tokens')
    .select('id,chain,token_address')
    .is('security_score', null)
    .order('first_seen_at', { ascending: false })
    .limit(BATCH);

  if (fetchErr) {
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, fetchErr.message, 0);
    return cronResponse(NAME, startedAt, { error: fetchErr.message });
  }

  const feed = (rows ?? []) as FeedRow[];
  if (feed.length === 0) {
    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
    return cronResponse(NAME, startedAt, { scanned: 0, enriched: 0, noWork: true });
  }

  let enriched = 0;
  let failed = 0;
  let rateLimited = false;

  for (const row of feed) {
    if (!row.token_address || !row.chain) continue;
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
      if (!honeypotKnown && sec.holderCount === 0) continue;

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

      const { error: updErr } = await admin
        .from('sniper_feed_tokens')
        .update(patch)
        .eq('id', row.id);
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
      // meaningful fraction of the batch fails.
      if (failed > 5) {
        Sentry.captureException(err, { tags: { cron: NAME, token: row.token_address, chain: row.chain } });
      }
    }
  }

  await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, enriched);
  return cronResponse(NAME, startedAt, {
    scanned: feed.length,
    enriched,
    failed,
    rateLimited,
  });
}
