import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface FeedRow {
  id: string;
  whale_address: string;
  chain: string;
  action: string;
  token_address: string | null;
  token_symbol: string | null;
  value_usd: number | null;
  tx_hash: string;
  timestamp: string;
  label: string | null;
  entity_type: string | null;
}

/**
 * Live whale feed backed by the whale_activity table (populated by the
 * existing /api/cron/whale-activity-poll cron). Filter by chain, size
 * threshold, time range, and action. Enriches with known whale labels.
 *
 * 15s Redis cache — the poll cron runs at 1-minute cadence so a shorter
 * cache would be over-fetching.
 */

const SIZE_MIN: Record<string, number> = {
  "10k": 10_000,
  "50k": 50_000,
  "100k": 100_000,
  "500k": 500_000,
  "1m": 1_000_000,
};

const TIME_WINDOW_SECONDS: Record<string, number> = {
  "1h": 3600,
  "6h": 6 * 3600,
  "24h": 24 * 3600,
  "7d": 7 * 24 * 3600,
};

export const GET = withTierGate("pro", async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const chainsParam = sp.get("chains");
  const chains = chainsParam
    ? chainsParam.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
    : [];
  const size = sp.get("size") ?? "100k";
  const timeRange = sp.get("time") ?? "24h";
  const actionFilter = sp.get("action"); // 'buy' | 'sell' | 'transfer' | null
  const tokenSearch = sp.get("token")?.toLowerCase() ?? "";
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "100", 10) || 100, 1), 200);
  const offset = Math.max(parseInt(sp.get("offset") ?? "0", 10) || 0, 0);

  const minUsd = SIZE_MIN[size] ?? 100_000;
  const windowSec = TIME_WINDOW_SECONDS[timeRange] ?? 86_400;
  const since = new Date(Date.now() - windowSec * 1000).toISOString();

  const cacheKey = `whale-tracker:feed:${chains.join(",")}:${size}:${timeRange}:${actionFilter ?? "all"}:${tokenSearch}:${offset}:${limit}`;

  try {
    const data = await cacheWithFallback<{ rows: FeedRow[]; total: number }>(cacheKey, 15, async () => {
      const admin = getSupabaseAdmin();
      let q = admin
        .from("whale_activity")
        .select(
          "id,whale_address,chain,action,token_address,token_symbol,value_usd,tx_hash,timestamp",
          { count: "exact" },
        )
        .gte("timestamp", since)
        .gte("value_usd", minUsd)
        .order("timestamp", { ascending: false })
        .range(offset, offset + limit - 1);

      if (chains.length > 0) q = q.in("chain", chains);
      if (actionFilter) q = q.eq("action", actionFilter);
      if (tokenSearch) q = q.ilike("token_symbol", `%${tokenSearch}%`);

      const { data: rowsData, error, count } = await q;
      if (error) throw error;

      const rows = (rowsData ?? []) as Array<{
        id: string;
        whale_address: string;
        chain: string;
        action: string;
        token_address: string | null;
        token_symbol: string | null;
        value_usd: number | null;
        tx_hash: string;
        timestamp: string;
      }>;

      if (rows.length === 0) return { rows: [], total: 0 };

      const uniqAddrs = Array.from(new Set(rows.map((r) => r.whale_address)));
      const { data: whaleRows } = await admin
        .from("whales")
        .select("address,chain,label,entity_type")
        .in("address", uniqAddrs);
      const labels = new Map<string, { label: string | null; entity_type: string | null }>();
      for (const w of (whaleRows ?? []) as Array<{
        address: string;
        chain: string;
        label: string | null;
        entity_type: string | null;
      }>) {
        labels.set(
          `${w.chain}:${w.address.toLowerCase()}`,
          { label: w.label, entity_type: w.entity_type },
        );
      }

      const enriched: FeedRow[] = rows.map((r) => {
        const meta = labels.get(`${r.chain}:${r.whale_address.toLowerCase()}`) ?? null;
        return {
          ...r,
          label: meta?.label ?? null,
          entity_type: meta?.entity_type ?? null,
        };
      });

      return { rows: enriched, total: count ?? enriched.length };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[whale-tracker/feed]", err);
    return NextResponse.json({ rows: [], total: 0, error: "feed failed" }, { status: 500 });
  }
});
