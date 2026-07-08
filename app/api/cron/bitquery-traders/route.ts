import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getActiveTraders, isBitqueryEnabled, type ActiveTrader } from "@/lib/services/bitquery";
import { classifyAddress } from "@/lib/whales/labels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NAME = "bitquery-traders";

/**
 * bitquery-traders — keeps a live roster of ACTIVE, day-to-day whale TRADERS in
 * the `whales` table (feeds the tracker, follow, watchlist, copy-trade). Ranked
 * by DEX trading VOLUME (not holdings) over a 7-day window, filtered to real,
 * good individual traders:
 *   - active on >= MIN_ACTIVE_DAYS of the last 7 (trades most days),
 *   - a real number of trades (not a single big transfer, not an HFT/MM bot),
 *   - volume inside a whale band (excludes dust and CEX/MM firehoses),
 *   - not a labeled CEX / market-maker / bridge / MEV address.
 *
 * Pulls every chain Bitquery covers (7 EVM + Solana), each in parallel, up to
 * FETCH_LIMIT per chain, so the directory fills toward thousands of REAL whales
 * over successive runs (the 7-day window slides, so the discoverable set churns).
 * Discovery only — never deletes; whale-backfill-pnl fills richer metrics after.
 * Gated on BITQUERY_API_KEY (no-op until set). Six-hourly group for quota.
 */

const WINDOW_DAYS = 7;
const MIN_ACTIVE_DAYS = 4;          // traded on >= 4 of the last 7 days
const MIN_TRADES = 6;               // genuinely trading, not a one-off transfer
const MAX_TRADES = 2_000;           // exclude HFT/MM bots (~285/day over 7d)
const MIN_VOL_USD = 50_000;         // real-whale floor
const MAX_VOL_USD = 50_000_000;     // exclude CEX/MM firehoses
const FETCH_LIMIT = 500;            // top-N by volume pulled per chain, per run

// Every chain Bitquery's DEXTrades covers. Solana is handled by getActiveTraders
// via its own query; the rest go through the EVM network map.
const CHAINS = ["ethereum", "base", "bsc", "arbitrum", "polygon", "optimism", "avalanche", "solana"];

// Labels that mark an address as institutional/non-trader — filter these out.
const INSTITUTIONAL = new Set(["cex", "mm", "bridge", "mev"]);

function isGoodWhale(t: ActiveTrader): boolean {
  if (t.activeDays < MIN_ACTIVE_DAYS) return false;
  if (t.trades < MIN_TRADES || t.trades > MAX_TRADES) return false;
  if (t.volumeUsd < MIN_VOL_USD || t.volumeUsd > MAX_VOL_USD) return false;
  const { labels } = classifyAddress(t.address, t.chain);
  return !labels.some((l) => INSTITUTIONAL.has(l));
}

/** Upsert the filtered traders for a chain, ranked by volume → whale_score.
 *  ignoreDuplicates lets the DB skip already-tracked (address,chain) rows, so we
 *  don't need a giant pre-select IN() query — the returned rows are the NEW ones. */
async function upsertTraders(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  traders: ActiveTrader[],
): Promise<number> {
  if (traders.length === 0) return 0;
  const ranked = traders.slice().sort((a, b) => b.volumeUsd - a.volumeUsd);
  const now = new Date().toISOString();
  const rows = ranked.map((t, i) => ({
    address: t.address,
    chain: t.chain,
    label: "Active daily trader",
    entity_type: "trader",
    archetype: "active_trader",
    // Higher volume rank → higher score (70–90); whale-backfill-pnl refines later.
    whale_score: Math.max(70, Math.round(90 - (i / Math.max(1, ranked.length)) * 20)),
    trade_count_30d: t.trades,
    volume_7d_usd: t.volumeUsd,
    active_days_7d: t.activeDays,
    follower_count: 0,
    verified: false,
    is_active: true,
    manual_label: false,
    first_seen_at: now,
    last_active_at: now,
  }));
  const { data } = await supabase
    .from("whales")
    .upsert(rows, { onConflict: "address,chain", ignoreDuplicates: true })
    .select("id");
  return (data ?? []).length;
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();

  if (!isBitqueryEnabled()) {
    await logCronExecution(NAME, "success", Date.now() - startedAt, "no-bitquery-key", 0);
    return NextResponse.json({ ok: true, skipped: "no-bitquery-key" });
  }

  const supabase = getSupabaseAdmin();
  const sinceIso = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000).toISOString();

  try {
    // Pull every chain in parallel (bounded by the slowest query), filter to
    // good whales, then upsert per chain.
    const perChain = await Promise.all(
      CHAINS.map(async (chain) => {
        try {
          const traders = await getActiveTraders(chain, { sinceIso, limit: FETCH_LIMIT });
          return { chain, good: traders.filter(isGoodWhale) };
        } catch (err) {
          Sentry.captureException(err, { tags: { cron: NAME, chain } });
          return { chain, good: [] as ActiveTrader[] };
        }
      }),
    );

    const byChain: Record<string, number> = {};
    let inserted = 0;
    for (const { chain, good } of perChain) {
      const n = await upsertTraders(supabase, good);
      byChain[chain] = n;
      inserted += n;
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, inserted, byChain });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
