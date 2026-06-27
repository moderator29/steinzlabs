import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";
import { classifyAddress, entityTypeToLabel, canonicalAction, dbActionsForCanonical, type WhaleLabel } from "@/lib/whales/labels";
import { normalizeAddress } from "@/lib/utils/addressNormalize";

const VALID_LABELS: ReadonlySet<WhaleLabel> = new Set([
  'cex', 'mm', 'smart_money', 'bot', 'insider', 'whale', 'bridge', 'mev',
]);

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
  whale_label: WhaleLabel;
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

export const GET = withTierGate("mini", async (request: NextRequest) => {
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
  // Audit B5 / P1 #25 — Smart Money + label filter pills. labelsParam
  // is a comma-separated list of WhaleLabel values; we narrow the
  // server-enriched rows to only those whose entity_type matches.
  // Invalid labels are silently dropped so a malformed query string
  // can't break the feed.
  const labelsParam = sp.get("labels")?.toLowerCase() ?? "";
  const requestedLabels: WhaleLabel[] = labelsParam
    ? labelsParam.split(",").map((l) => l.trim()).filter((l): l is WhaleLabel => VALID_LABELS.has(l as WhaleLabel))
    : [];

  const minUsd = SIZE_MIN[size] ?? 100_000;
  const windowSec = TIME_WINDOW_SECONDS[timeRange] ?? 86_400;
  const since = new Date(Date.now() - windowSec * 1000).toISOString();

  const cacheKey = `whale-tracker:feed:${chains.join(",")}:${size}:${timeRange}:${actionFilter ?? "all"}:${tokenSearch}:${requestedLabels.join("+")}:${offset}:${limit}`;

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
      // The DB stores raw actions (transfer_out/transfer_in/buy/sell/...); the
      // UI filter sends a canonical buy|sell|transfer. Translate so picking
      // "Transfer" matches the real transfer_out rows instead of zero rows.
      if (actionFilter) q = q.in("action", dbActionsForCanonical(actionFilter));
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
      // §whale-tracker-grade — surface pnl_30d_usd / win_rate /
      // avg_hold_hours so the UI can render behavioral badges
      // (Accumulator / Distributor / Sniper / High-win-rate) inline
      // on every feed row, derived from columns the backfill cron
      // already populates.
      const { data: whaleRows } = await admin
        .from("whales")
        .select("address,chain,label,entity_type,pnl_30d_usd,win_rate,avg_hold_hours")
        .in("address", uniqAddrs);
      const labels = new Map<string, {
        label: string | null;
        entity_type: string | null;
        pnl_30d_usd: number | null;
        win_rate: number | null;
        avg_hold_hours: number | null;
      }>();
      for (const w of (whaleRows ?? []) as Array<{
        address: string;
        chain: string;
        label: string | null;
        entity_type: string | null;
        pnl_30d_usd: number | null;
        win_rate: number | null;
        avg_hold_hours: number | null;
      }>) {
        labels.set(
          `${w.chain}:${normalizeAddress(w.address, w.chain)}`,
          {
            label: w.label,
            entity_type: w.entity_type,
            pnl_30d_usd: w.pnl_30d_usd,
            win_rate: w.win_rate,
            avg_hold_hours: w.avg_hold_hours,
          },
        );
      }

      const enriched: FeedRow[] = rows.map((r) => {
        const meta = labels.get(`${r.chain}:${normalizeAddress(r.whale_address, r.chain)}`) ?? null;
        const entity_type = meta?.entity_type ?? null;
        let label = meta?.label ?? null;

        // Resolve a WhaleLabel for the filter pills + badge. The curated
        // registry wins (it knows specific CEX/MM/bridge addresses); otherwise
        // map the whales.entity_type vocabulary onto the WhaleLabel taxonomy.
        // Before this the pills compared a WhaleLabel against entity_type
        // strings ('institutional' etc.) and matched zero rows.
        const cls = classifyAddress(r.whale_address, r.chain);
        const registryLabel = cls.labels[0];
        const whale_label: WhaleLabel = registryLabel && registryLabel !== 'whale'
          ? registryLabel
          : entityTypeToLabel(entity_type);
        if (!label && cls.name) label = cls.name;

        return {
          ...r,
          action: canonicalAction(r.action),
          label,
          entity_type,
          whale_label,
          pnl_30d_usd: meta?.pnl_30d_usd ?? null,
          win_rate: meta?.win_rate ?? null,
          avg_hold_hours: meta?.avg_hold_hours ?? null,
        };
      });

      // Apply label filter after enrichment on the resolved WhaleLabel so both
      // whales-table rows and registry-classified rows are respected by the
      // Smart Money / CEX / Bot pills.
      const filtered = requestedLabels.length > 0
        ? enriched.filter((r) => requestedLabels.includes(r.whale_label))
        : enriched;

      return { rows: filtered, total: requestedLabels.length > 0 ? filtered.length : (count ?? enriched.length) };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[whale-tracker/feed]", err);
    return NextResponse.json({ rows: [], total: 0, error: "feed failed" }, { status: 500 });
  }
});
