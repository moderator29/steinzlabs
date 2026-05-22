import 'server-only';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * §5.8 Failure ladder for Dune-derived data surfaces.
 *
 * Tier 0 — live Dune result (freshness=live)
 * Tier 1 — stale Dune cache (freshness=cached older than TTL OR
 *          freshness=stale). Surface to the UI with an
 *          X-Data-Freshness: stale header so widgets can label it.
 * Tier 2 — upstream switch to a comparable non-Dune source
 *          (CoinGecko / Birdeye / Alchemy / Helius / deBridge).
 *          UI shows the same widget; "data via fallback" footnote.
 * Tier 3 — no data anywhere. Render <DataUnavailable/>. Insert a
 *          system_alerts row at tier=2 so ops sees the gap.
 *
 * This module is a thin orchestrator — callers pass the live Dune
 * result first, then a fallback fetcher closure, and we descend the
 * ladder.
 */

export type FreshnessTier = 'live' | 'cached' | 'stale' | 'fallback' | 'unavailable';

export interface LadderResult<T> {
  data: T | null;
  freshness: FreshnessTier;
  source: string;
  fetched_at?: string;
}

interface LadderInput<T> {
  source_name: string;                                                       // e.g. 'dune.holder_concentration'
  dune_result: { ok: true; rows: unknown[]; freshness: 'live' | 'cached' | 'stale'; fetched_at: string } | { ok: false; reason: string };
  transformDune: (rows: unknown[]) => T;
  fallback?: () => Promise<{ data: T | null; source: string } | null>;
}

export async function descendLadder<T>(input: LadderInput<T>): Promise<LadderResult<T>> {
  // Tier 0/1 — Dune result, live or cached/stale.
  if (input.dune_result.ok && input.dune_result.rows.length > 0) {
    return {
      data: input.transformDune(input.dune_result.rows),
      freshness: input.dune_result.freshness,
      source: input.source_name,
      fetched_at: input.dune_result.fetched_at,
    };
  }

  // Tier 2 — upstream switch via the fallback fetcher.
  if (input.fallback) {
    try {
      const fb = await input.fallback();
      if (fb && fb.data !== null) {
        return { data: fb.data, freshness: 'fallback', source: fb.source };
      }
    } catch { /* fall through to tier 3 */ }
  }

  // Tier 3 — nothing. Log to system_alerts (best-effort) and return null.
  try {
    const admin = getSupabaseAdmin();
    await admin.from('system_alerts').insert({
      source: input.source_name,
      tier: 2,
      message: `Data unavailable across Dune + fallback for ${input.source_name}`,
      metadata: { dune_reason: input.dune_result.ok ? null : input.dune_result.reason },
    });
  } catch { /* never throw from telemetry */ }

  return { data: null, freshness: 'unavailable', source: input.source_name };
}

/**
 * Helper to stamp the standard `X-Data-Freshness` header on a Response.
 */
export function freshnessHeader(tier: FreshnessTier): Record<string, string> {
  return { 'X-Data-Freshness': tier };
}
