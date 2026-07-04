import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isEvmAddress, normalizeAddress } from "@/lib/utils/addressNormalize";

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
// Minimum native balance (ETH/BNB/MATIC/etc.) a discovered wallet must hold to
// be admitted — filters dust/throwaway swappers so auto-discovery stays vetted.
const MIN_NATIVE_BALANCE = 0.05;

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
          // Vetting floor — require a non-trivial native balance so we admit
          // real, funded wallets and skip dust/throwaway swappers. This is the
          // "good filter" that keeps auto-discovery quality high.
          if ((parseFloat(bal) || 0) < MIN_NATIVE_BALANCE) return null;
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

      // Normalize to the canonical stored form (EVM routers → lowercase) so we
      // never write a mixed-case duplicate and the unique (address,chain) key
      // dedups reliably.
      const addrs = eoas.map((e) => normalizeAddress(e.address, pair.chain));
      const { data: existing } = await supabase.from("whales").select("address").in("address", addrs);
      const seen = new Set((existing ?? []).map((r) => (r as { address: string }).address));

      const rows = eoas
        .map((e) => ({ e, addr: normalizeAddress(e.address, pair.chain) }))
        .filter(({ addr }) => !seen.has(addr))
        .map(({ e, addr }) => ({
          address: addr,
          chain: pair.chain,
          // No auto-generated "Active X trader" label — the tracker shows the
          // wallet address (Nansen/Arkham style) until a real entity label is
          // resolved. Avoids the noisy label users disliked.
          label: null,
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
        // Upsert with ignoreDuplicates so a concurrent tick (or the Bitquery
        // discovery path) inserting the same address can't make the WHOLE batch
        // fail the unique (address,chain) constraint and silently drop every new
        // whale. Colliding rows are skipped; the rest insert; select returns
        // only the rows this call actually wrote.
        const { data, error } = await supabase
          .from("whales")
          .upsert(rows, { onConflict: "address,chain", ignoreDuplicates: true })
          .select("id");
        if (!error) inserted += (data ?? []).length;
      }
    }

    await logCronExecution(NAME, "success", Date.now() - startedAt, undefined, inserted);
    return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, pairs: pairs.length, inserted });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
