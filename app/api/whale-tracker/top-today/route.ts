import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

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
export const GET = withTierGate("pro", async (_request: NextRequest) => {
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
        const key = `${r.chain}:${r.whale_address.toLowerCase()}`;
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
        .sort((a, b) => b.volume_usd - a.volume_usd)
        .slice(0, 10);

      // §2.15 fallback — when whale_activity is empty (the webhook-driven
      // Live Feed isn't wired yet), synthesize a ranking from the whales
      // table's portfolio_value_usd × average-daily-trade-count so the
      // panel never shows a blank zero-state. Real volume takes over the
      // moment activity rows start flowing.
      if (sorted.length === 0) {
        const { data: fallbackWhales } = await admin
          .from('whales')
          .select('address, chain, label, entity_type, portfolio_value_usd, trade_count_30d')
          .eq('is_active', true)
          .not('portfolio_value_usd', 'is', null)
          .order('portfolio_value_usd', { ascending: false })
          .limit(10);
        return (fallbackWhales ?? []).map((w): TopWhaleRow => {
          const portfolio = Number(w.portfolio_value_usd ?? 0);
          const dailyTradeRate = Number(w.trade_count_30d ?? 0) / 30;
          // Rough 24h volume estimate: portfolio × daily-turnover. Bounded
          // so it doesn't outpace the real-volume leaderboard once live.
          const estVolume = Math.min(portfolio * Math.max(dailyTradeRate, 0.01), portfolio);
          return {
            whale_address: w.address,
            chain: w.chain,
            volume_usd: Math.round(estVolume),
            move_count: Math.max(1, Math.round(dailyTradeRate)),
            label: w.label ?? null,
            entity_type: w.entity_type ?? null,
          };
        });
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
          `${w.chain}:${w.address.toLowerCase()}`,
          { label: w.label, entity_type: w.entity_type },
        );
      }

      return sorted.map<TopWhaleRow>((s) => {
        const key = `${s.chain}:${s.address.toLowerCase()}`;
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
