/**
 * Sniper risk #1 fix — backfill GoPlus security_score on matched events.
 *
 * sniper-monitor pulls fresh pairs from DexScreener which doesn't carry
 * security data, so every event lands with `details.security_score = null`.
 * Any criteria with `min_security_score > 0` (modal default is 60!) then
 * rejects every candidate forever.
 *
 * This cron walks recent matched / sniped_pending events with a null
 * security_score, calls GoPlus token_security per row, patches the
 * details JSONB. Capped at 30 tokens per tick — each GoPlus call costs
 * ~1-2s and we don't want to blow maxDuration.
 *
 * Non-EVM chains: Solana goes through GoPlus too but the matcher rarely
 * lands Solana new-pair matches today; we still attempt and skip on error.
 *
 * Cadence: every 2 minutes, offset from sniper-monitor's 5-minute tick so
 * matches typically land at most one cycle before enrichment patches them.
 */

import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, cronResponse, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getTokenSecurity } from '@/lib/services/goplus';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const NAME = 'sniper-enrich-security';
const BATCH = 30;
// Look back one hour — a stale match older than that is unlikely to still
// be actionable for the user, no point burning GoPlus calls on it.
const LOOKBACK_MS = 60 * 60_000;

interface EventRow {
  id: string;
  matched_token_address: string;
  matched_chain: string;
  details: Record<string, unknown> | null;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

  // Pull candidate events. We can't filter `details->>'security_score' IS NULL`
  // through supabase-js cleanly, so we over-fetch a small slice and filter
  // in-memory. The dedup keeps the workload tiny — same token in many events
  // gets one GoPlus call per tick.
  const { data: rows, error: fetchErr } = await admin
    .from('sniper_match_events')
    .select('id,matched_token_address,matched_chain,details')
    .in('decision', ['matched', 'sniped_pending'])
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);

  if (fetchErr) {
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, fetchErr.message, 0);
    return cronResponse(NAME, startedAt, { error: fetchErr.message });
  }

  const events = (rows ?? []) as EventRow[];
  const needs = events.filter((e) => {
    const d = e.details ?? {};
    return d.security_score == null;
  });

  if (needs.length === 0) {
    await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, 0);
    return cronResponse(NAME, startedAt, { scanned: events.length, enriched: 0, noWork: true });
  }

  // Dedup by token+chain so we never call GoPlus twice for the same pair
  // in one tick. Group event ids per token so a single GoPlus result patches
  // every matching row.
  const groups = new Map<string, { token: string; chain: string; ids: string[] }>();
  for (const e of needs) {
    if (!e.matched_token_address || !e.matched_chain) continue;
    const key = `${e.matched_chain}:${normalizeAddress(e.matched_token_address) ?? e.matched_token_address}`;
    const existing = groups.get(key);
    if (existing) {
      existing.ids.push(e.id);
    } else {
      groups.set(key, {
        token: e.matched_token_address,
        chain: e.matched_chain,
        ids: [e.id],
      });
    }
    if (groups.size >= BATCH) break;
  }

  let enriched = 0;
  let failed = 0;

  for (const { token, chain, ids } of groups.values()) {
    try {
      const sec = await getTokenSecurity(token, chain);
      // GoPlus buy/sell tax are decimal fractions (0.05 = 5%). Convert to
      // bps so the criteria's max_buy_tax_bps / max_sell_tax_bps fields
      // compare against a like unit downstream.
      const patch = {
        security_score: sec.trustScore,
        is_honeypot: sec.isHoneypot,
        buy_tax_bps: Math.round(sec.buyTax * 10_000),
        sell_tax_bps: Math.round(sec.sellTax * 10_000),
        holder_count: sec.holderCount,
        safety_level: sec.safetyLevel,
        enriched_at: new Date().toISOString(),
      };

      for (const id of ids) {
        // Read-modify-write on the JSONB so we don't clobber other keys the
        // matcher already wrote (amount_usd, auto_execute, wallet_source).
        const { data: existing, error: readErr } = await admin
          .from('sniper_match_events')
          .select('details')
          .eq('id', id)
          .maybeSingle();
        if (readErr || !existing) continue;
        const merged = { ...((existing.details as Record<string, unknown>) ?? {}), ...patch };
        const { error: updErr } = await admin
          .from('sniper_match_events')
          .update({ details: merged })
          .eq('id', id);
        if (!updErr) enriched++;
      }
    } catch (err) {
      failed++;
      // Don't poison Sentry with one bad token per minute — only capture
      // when a meaningful fraction of the batch fails.
      if (failed > 5) {
        Sentry.captureException(err, { tags: { cron: NAME, token, chain } });
      }
    }
  }

  await logCronExecution(NAME, 'success', Date.now() - startedAt, undefined, enriched);
  return cronResponse(NAME, startedAt, {
    scanned: events.length,
    grouped: groups.size,
    enriched,
    failed,
  });
}
