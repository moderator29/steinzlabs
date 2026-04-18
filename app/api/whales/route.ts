import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";

export const GET = withTierGate("pro", async (request: NextRequest) => {
  const sp = request.nextUrl.searchParams;
  const chain = sp.get("chain");
  const entityType = sp.get("entity_type");
  const q = sp.get("q")?.trim();
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);
  const limit = Math.max(1, Math.min(100, parseInt(sp.get("limit") ?? "30", 10) || 30));

  const cacheKey = `whales:list:${chain ?? "all"}:${entityType ?? "all"}:${q ?? ""}:${offset}:${limit}`;

  try {
    const data = await cacheWithFallback(cacheKey, 30, async () => {
      const supabase = getSupabaseAdmin();
      let query = supabase
        .from("whales")
        .select("id, address, chain, label, entity_type, portfolio_value_usd, pnl_30d_usd, win_rate, whale_score, follower_count, x_handle, verified, last_active_at", { count: "exact" })
        .eq("is_active", true)
        .order("whale_score", { ascending: false })
        .range(offset, offset + limit - 1);

      if (chain) query = query.eq("chain", chain);
      if (entityType) query = query.eq("entity_type", entityType);
      if (q) query = query.or(`label.ilike.%${q}%,address.ilike.%${q}%`);

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
