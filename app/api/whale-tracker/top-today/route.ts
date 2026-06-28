import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";
import { normalizeAddress } from "@/lib/utils/addressNormalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TopWhaleRow {
  whale_address: string;
  chain: string;
  volume_usd: number;
  move_count: number;
  label: string | null;
  entity_type: string | null;
}

/**
 * Top 10 whales by 24h volume from whale_activity. 5-minute Redis cache.
 * Enriches with known entity labels from the `whales` table (if seeded).
 * Pro+ only.
 */
export const GET = withTierGate("mini", async (_request: NextRequest) => {
  try {
    const rows = await cacheWithFallback<TopWhaleRow[]>("whale-tracker:top-today", 300, async () => {
      const admin = getSupabaseAdmin();
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data: activity } = await admin
        .from("whale_activity")
        .select("whale_address,chain,value_usd")
        .gte("timestamp", since);
      const rowsA = (activity ?? []) as Array<{
        whale_address: string;
        chain: string;
        value_usd: number | null;
      }>;
      const map = new Map<string, { chain: string; vol: number; count: number }>();
      for (const r of rowsA) {
        const key = `${r.chain}:${normalizeAddress(r.whale_address, r.chain)}`;
        const existing = map.get(key) ?? { chain: r.chain, vol: 0, count: 0 };
        existing.vol += Number(r.value_usd ?? 0);
        existing.count += 1;
        map.set(key, existing);
      }
      const sorted = Array.from(map.entries())
        .map(([key, v]) => {
          const address = key.split(":")[1];
          return { address, chain: v.chain, volume_usd: v.vol, move_count: v.count };
        })
        // Rank by 24h volume, tie-broken by move_count. The tiebreak matters
        // while pricing is catching up: if a window's rows are still unpriced
        // (volume 0), ordering by real move_count surfaces the genuinely most
        // active whales instead of arbitrary insertion order — no fabricated
        // numbers, just a secondary real signal.
        .sort((a, b) => b.volume_usd - a.volume_usd || b.move_count - a.move_count)
        .slice(0, 10);

      // No real 24h activity volume → honest empty state. We do NOT
      // synthesize a ranking from portfolio × turnover: that would present
      // a fabricated "24h volume" number as real (CLAUDE.md: no mock data).
      // The panel fills the moment priced whale_activity rows start flowing.
      if (sorted.length === 0) {
        return [];
      }
      const addresses = sorted.map((s) => s.address);
      const { data: whaleRows } = await admin
        .from("whales")
        .select("address,chain,label,entity_type")
        .in("address", addresses);
      const enriched = new Map<string, { label: string | null; entity_type: string | null }>();
      for (const w of (whaleRows ?? []) as Array<{
        address: string;
        chain: string;
        label: string | null;
        entity_type: string | null;
      }>) {
        enriched.set(
          `${w.chain}:${normalizeAddress(w.address, w.chain)}`,
          { label: w.label, entity_type: w.entity_type },
        );
      }

      return sorted.map<TopWhaleRow>((s) => {
        const key = `${s.chain}:${normalizeAddress(s.address, s.chain)}`;
        const meta = enriched.get(key) ?? null;
        return {
          whale_address: s.address,
          chain: s.chain,
          volume_usd: s.volume_usd,
          move_count: s.move_count,
          label: meta?.label ?? null,
          entity_type: meta?.entity_type ?? null,
        };
      });
    });
    return NextResponse.json({ whales: rows });
  } catch (err) {
    console.error("[whale-tracker/top-today]", err);
    return NextResponse.json({ whales: [] });
  }
});
