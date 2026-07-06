import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";

export const GET = withTierGate("mini", async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const chain = sp.get("chain");
  const entityType = sp.get("entity_type");
  const q = sp.get("q")?.trim();
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") ?? "30", 10) || 30));
  // §whale-tracker-grade audit — PnL leaderboard widget on the tracker
  // home was hitting this endpoint with no ordering control, which meant
  // it surfaced top-whale-SCORE whales instead of top-PnL. Add explicit
  // sort + min_pnl filter so the leaderboard can rank by realised 30d
  // PnL like the panel name promises.
  // Directory DEFAULTS to composite whale_score (industry standard): the most
  // notable, well-known whales lead page one — the big names with real data,
  // not the long tail of freshly-discovered wallets that have volume but no PnL
  // yet. Callers that want the active-volume roster or PnL leaderboard pass
  // ?sort=volume / ?sort=pnl.
  const sortBy = (sp.get("sort") ?? "score").toLowerCase();
  const minPnl = Math.max(0, parseInt(sp.get("min_pnl") ?? "0", 10) || 0);
  // PnL leaderboard ranks by realised PnL; the active-trader roster by 7d DEX
  // volume; everything else by composite score.
  const orderColumn = sortBy === "pnl" ? "pnl_30d_usd" : sortBy === "volume" ? "volume_7d_usd" : "whale_score";
  // Optional: only wallets active on >= N of the last 7 days (daily traders).
  const minActiveDays = Math.max(0, parseInt(sp.get("min_active_days") ?? "0", 10) || 0);

  const cacheKey = `whales:list:${chain ?? "all"}:${entityType ?? "all"}:${q ?? ""}:${sortBy}:${minPnl}:${minActiveDays}:${offset}:${limit}`;

  try {
    const data = await cacheWithFallback(cacheKey, 30, async () => {
      const supabase = getSupabaseAdmin();
      let query = supabase
        .from("whales")
        // §whale-tracker-grade — added avg_hold_hours so the PnL leaderboard
        // can derive Accumulator / Distributor / Sniper badges from
        // existing columns the backfill cron already populates.
        .select("id, address, chain, label, entity_type, archetype, portfolio_value_usd, pnl_30d_usd, win_rate, avg_hold_hours, whale_score, volume_7d_usd, active_days_7d, follower_count, x_handle, verified, last_active_at", { count: "exact" })
        .eq("is_active", true)
        .order(orderColumn, { ascending: false, nullsFirst: false })
        // Tiebreak so the biggest, most-established whales (largest portfolios)
        // lead within an equal score band, then most-recently-active — keeps the
        // marquee names (MicroStrategy, BlackRock, etc.) on the first pages.
        .order("portfolio_value_usd", { ascending: false, nullsFirst: false })
        .order("last_active_at", { ascending: false, nullsFirst: false })
        .range(offset, offset + limit - 1);

      if (minPnl > 0) query = query.gte("pnl_30d_usd", minPnl);
      if (minActiveDays > 0) query = query.gte("active_days_7d", minActiveDays);

      if (chain) query = query.eq("chain", chain);
      if (entityType) query = query.eq("entity_type", entityType);
      if (q) {
        // Sanitize before interpolating into the PostgREST .or() filter: strip
        // structural chars + LIKE wildcards so the search can't inject operators.
        const safeQ = q.replace(/[^a-zA-Z0-9 .\-]/g, "").trim();
        if (safeQ) query = query.or(`label.ilike.%${safeQ}%,address.ilike.%${safeQ}%`);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { whales: data ?? [], total: count ?? 0 };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/whales]", err);
    return NextResponse.json({ error: "Failed to load whales" }, { status: 500 });
  }
});
