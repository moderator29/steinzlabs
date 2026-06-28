import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isEvmAddress } from "@/lib/utils/addressNormalize";
import { getTopDexTraders, isBitqueryEnabled } from "@/lib/services/bitquery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NAME = "whale-discovery";

/**
 * whale-discovery — automated, recurring discovery of NEW active on-chain
 * traders, the free replacement for Arkham/Nansen seeding. Reads recent
 * "to-router" transfers from major DEX routers via Alchemy, aggregates unique
 * senders (= people who swapped), filters to EOAs, and UPSERTs the freshest
 * ones into `whales`. Metrics (pnl/win-rate/score) are filled by the
 * whale-backfill-pnl cron afterwards.
 *
 * This rides Alchemy (already wired + free 30M CU/mo) so it works today. A
 * cross-chain Bitquery discovery source can augment this later: set
 * BITQUERY_API_KEY and verify the query in Bitquery's playground first — until
 * then we do NOT call it, to avoid writing unverified data.
 *
 * Rotates through (chain, router) pairs a few per tick so coverage spreads
 * over the day without a CU spike. Runs in the six-hourly dispatch group.
 */

const ROUTERS: Array<{ chain: string; key: string; router: string }> = [
  { chain: "ethereum", key: "uniswap_universal", router: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { chain: "ethereum", key: "uniswap_v3", router: "0xE592427A0AEce92De3Edee1F18E0157C05861564" },
  { chain: "base", key: "uniswap_universal", router: "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD" },
  { chain: "base", key: "aerodrome", router: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43" },
  { chain: "arbitrum", key: "uniswap_v3", router: "0xE592427A0AEce92De3Edee1F18E0157C05861564" },
  { chain: "arbitrum", key: "camelot", router: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d" },
  { chain: "bsc", key: "pancakeswap_v2", router: "0x10ED43C718714eb63d5aA57B78B54704E256024E" },
  { chain: "polygon", key: "uniswap_v3", router: "0xE592427A0AEce92De3Edee1F18E0157C05861564" },
];

// How many (chain, router) pairs to process per tick, and how many fresh EOAs
// to admit per pair. Kept small so a tick stays well under maxDuration and the
// CU spend is modest.
const PAIRS_PER_TICK = 2;
const PER_PAIR = 12;
const MIN_SWAPS = 3;

async function discoverFromRouter(
  pair: { chain: string; key: string; router: string },
): Promise<Array<{ address: string; swaps: number }>> {
  const { getAssetTransfers, getContractCode, getEthBalance } = await import("@/lib/services/alchemy");
  let transfers: Array<{ from: string }> = [];
  try {
    transfers = await getAssetTransfers(pair.router, pair.chain, "to", 1000);
  } catch {
    return [];
  }
  const counts = new Map<string, number>();
  for (const t of transfers) {
    const from = (t.from || "").toLowerCase();
    if (!from || from === pair.router.toLowerCase() || !isEvmAddress(from)) continue;
    counts.set(from, (counts.get(from) || 0) + 1);
  }
  const candidates = Array.from(counts.entries())
    .filter(([, c]) => c >= MIN_SWAPS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, PER_PAIR * 3);

  const eoas: Array<{ address: string; swaps: number }> = [];
  const CHUNK = 8;
  for (let i = 0; i < candidates.length && eoas.length < PER_PAIR; i += CHUNK) {
    const slice = candidates.slice(i, i + CHUNK);
    const checks = await Promise.all(
      slice.map(async ([addr, swaps]) => {
        try {
          const code = await getContractCode(addr, pair.chain);
          if (code && code !== "0x" && code !== "0x0") return null; // contract
          const bal = await getEthBalance(addr, pair.chain).catch(() => "0");
          if ((parseFloat(bal) || 0) <= 0) return null; // dead/throwaway wallet
          return { address: addr, swaps };
        } catch {
          return null;
        }
      }),
    );
    for (const r of checks) if (r) eoas.push(r);
  }
  return eoas;
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let inserted = 0;
  try {
    if (!process.env.ALCHEMY_API_KEY) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, "no-alchemy-key", 0);
      return NextResponse.json({ ok: true, skipped: "no-alchemy-key" });
    }
    const supabase = getSupabaseAdmin();

    // Rotate the starting pair by the hour so successive ticks cover different
    // routers/chains across the day.
    const startIdx = (new Date().getUTCHours() * PAIRS_PER_TICK) % ROUTERS.length;
    const pairs = Array.from({ length: PAIRS_PER_TICK }, (_, i) => ROUTERS[(startIdx + i) % ROUTERS.length]);

    for (const pair of pairs) {
      const eoas = await discoverFromRouter(pair);
      if (eoas.length === 0) continue;

      const addrs = eoas.map((e) => e.address);
      const { data: existing } = await supabase.from("whales").select("address").in("address", addrs);
      const seen = new Set((existing ?? []).map((r) => (r as { address: string }).address.toLowerCase()));

      const rows = eoas
        .filter((e) => !seen.has(e.address.toLowerCase()))
        .map((e) => ({
          address: e.address,
          chain: pair.chain,
          label: `Active ${pair.key} trader`,
          entity_type: "trader",
          archetype: "active_swapper",
          whale_score: 70,
          trade_count_30d: e.swaps,
          follower_count: 0,
          verified: false,
          is_active: true,
          first_seen_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        const { data, error } = await supabase.from("whales").insert(rows).select("id");
        if (!error) inserted += (data ?? []).length;
      }
    }

    // Bitquery cross-chain discovery — augments the Alchemy router scan with
    // top DEX buyers by USD volume. Gated on BITQUERY_API_KEY (no-op until set),
    // rotates one chain per tick, fails closed (getTopDexTraders returns []).
    let bitqueryInserted = 0;
    if (isBitqueryEnabled()) {
      const bqChains = ["ethereum", "base", "bsc", "arbitrum"];
      const chain = bqChains[new Date().getUTCHours() % bqChains.length];
      const sinceIso = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
      try {
        const traders = await getTopDexTraders(chain, { sinceIso, minUsd: 10_000, limit: 30 });
        if (traders.length > 0) {
          const addrs = traders.map((t) => t.address);
          const { data: existing } = await supabase.from("whales").select("address").in("address", addrs);
          const seen = new Set((existing ?? []).map((r) => (r as { address: string }).address.toLowerCase()));
          const rows = traders
            .filter((t) => !seen.has(t.address))
            .map((t) => ({
              address: t.address,
              chain: t.chain,
              label: "Top DEX trader",
              entity_type: "trader",
              archetype: "smart_money",
              whale_score: 72,
              follower_count: 0,
              verified: false,
              is_active: true,
              first_seen_at: new Date().toISOString(),
              last_active_at: new Date().toISOString(),
            }));
          if (rows.length > 0) {
            const { data } = await supabase.from("whales").insert(rows).select("id");
            bitqueryInserted = (data ?? []).length;
            inserted += bitqueryInserted;
          }
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { cron: NAME, source: "bitquery" } });
      }
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, pairs: pairs.length, inserted, bitqueryInserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
