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
 * bitquery-traders — keeps a live roster of ACTIVE, day-to-day whale TRADERS
 * (top 100 EVM + top 100 Solana) in the `whales` table, which feeds the tracker,
 * follow, watchlist, and copy-trade. Ranked by DEX trading VOLUME (not holdings)
 * over a 7-day window, then filtered to real individual traders:
 *   - active on >= MIN_ACTIVE_DAYS of the last 7 (trades almost daily),
 *   - volume in a whale band (excludes CEX/MM firehoses and dust),
 *   - trade count below bot/MM levels,
 *   - not a labeled CEX / market-maker / bridge / MEV address.
 *
 * Gated on BITQUERY_API_KEY (no-op until set). Runs in the six-hourly group to
 * respect Bitquery quota. Discovery only — never deletes; metrics get filled by
 * whale-backfill-pnl afterward.
 */

const WINDOW_DAYS = 7;
const MIN_ACTIVE_DAYS = 4;          // traded on >= 4 of the last 7 days
const MIN_VOL_USD = 50_000;         // real-whale floor
const MAX_VOL_USD = 50_000_000;     // exclude CEX/MM firehoses
const MAX_TRADES = 2_000;           // exclude HFT/MM bots (~285/day over 7d)
const TARGET = 100;                 // per chain-group (EVM pooled, Solana)
const EVM_CHAINS = ["ethereum", "base", "bsc", "arbitrum"];

// Labels that mark an address as institutional/non-trader — filter these out.
const INSTITUTIONAL = new Set(["cex", "mm", "bridge", "mev"]);

function isNormalTrader(t: ActiveTrader): boolean {
  if (t.activeDays < MIN_ACTIVE_DAYS) return false;
  if (t.volumeUsd < MIN_VOL_USD || t.volumeUsd > MAX_VOL_USD) return false;
  if (t.trades > MAX_TRADES) return false;
  const { labels } = classifyAddress(t.address, t.chain);
  return !labels.some((l) => INSTITUTIONAL.has(l));
}

/** Insert the new (untracked) traders, ranked by volume → whale_score. */
async function upsertTraders(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  traders: ActiveTrader[],
): Promise<number> {
  if (traders.length === 0) return 0;
  const ranked = traders.slice().sort((a, b) => b.volumeUsd - a.volumeUsd).slice(0, TARGET);
  const addrs = ranked.map((t) => t.address);
  const { data: existing } = await supabase.from("whales").select("address").in("address", addrs);
  const seen = new Set((existing ?? []).map((r) => (r as { address: string }).address.toLowerCase()));

  const now = new Date().toISOString();
  const rows = ranked
    .filter((t) => !seen.has(t.address.toLowerCase()))
    .map((t, i) => ({
      address: t.address,
      chain: t.chain,
      label: "Active daily trader",
      entity_type: "trader",
      archetype: "active_trader",
      // Higher volume rank → higher score (70–90); metrics refine it later.
      whale_score: Math.max(70, Math.round(90 - (i / Math.max(1, ranked.length)) * 20)),
      trade_count_30d: t.trades,
      follower_count: 0,
      verified: false,
      is_active: true,
      manual_label: false,
      first_seen_at: now,
      last_active_at: now,
    }));
  if (rows.length === 0) return 0;
  // ignoreDuplicates so a concurrent insert of the same (address,chain) can't
  // throw a unique violation and fail the batch.
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
  let evmInserted = 0;
  let solInserted = 0;

  try {
    // EVM — pool the major chains, dedupe by (chain,address), filter, rank, top 100.
    const evmPool: ActiveTrader[] = [];
    for (const chain of EVM_CHAINS) {
      try {
        const traders = await getActiveTraders(chain, { sinceIso, limit: TARGET });
        evmPool.push(...traders.filter(isNormalTrader));
      } catch (err) {
        Sentry.captureException(err, { tags: { cron: NAME, chain } });
      }
    }
    evmInserted = await upsertTraders(supabase, evmPool);

    // Solana.
    try {
      const sol = await getActiveTraders("solana", { sinceIso, limit: TARGET });
      solInserted = await upsertTraders(supabase, sol.filter(isNormalTrader));
    } catch (err) {
      Sentry.captureException(err, { tags: { cron: NAME, chain: "solana" } });
    }

    const inserted = evmInserted + solInserted;
    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, evmInserted, solInserted, inserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
