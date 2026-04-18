import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";

export const runtime = "nodejs";

export async function GET() {
  try {
    const edges = await cacheWithFallback("clusters:recent", 60, async () => {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from("wallet_edges")
        .select("from_address, to_address, chain, edge_type, confidence, last_seen_at")
        .gte("confidence", 0.6)
        .order("last_seen_at", { ascending: false, nullsFirst: false })
        .limit(50);
      return data ?? [];
    });
    return NextResponse.json({ edges });
  } catch (err) {
    console.error("[api/clusters/recent]", err);
    return NextResponse.json({ edges: [] });
  }
}
