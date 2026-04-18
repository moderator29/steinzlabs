import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";

export const GET = withTierGate("pro", async (
  request: NextRequest,
  { params }: { params: { address: string } },
) => {
  const chain = request.nextUrl.searchParams.get("chain");
  const supabase = getSupabaseAdmin();

  try {
    let q = supabase
      .from("whales")
      .select("*")
      .eq("address", params.address)
      .eq("is_active", true);
    if (chain) q = q.eq("chain", chain);
    const { data: whale } = await q.maybeSingle();

    if (!whale) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [activityR, followersR] = await Promise.all([
      supabase
        .from("whale_activity")
        .select("*")
        .eq("whale_address", params.address)
        .order("timestamp", { ascending: false })
        .limit(50),
      supabase
        .from("user_whale_follows")
        .select("user_id", { count: "exact", head: true })
        .eq("whale_address", params.address),
    ]);

    return NextResponse.json({
      whale,
      activity: activityR.data ?? [],
      followerCount: followersR.count ?? 0,
    });
  } catch (err) {
    console.error("[api/whales/:addr]", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
});
