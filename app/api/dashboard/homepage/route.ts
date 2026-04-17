import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/apiAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cacheWithFallback } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VtxConversation {
  id: string;
  title: string | null;
  updated_at: string;
  messages: unknown;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const userId = user.id;
  const cacheKey = `dashboard:home:${userId}`;

  try {
    // Fetch full auth user for metadata (not cached — cheap + always current)
    const { data: fullAuthUser } = await supabase.auth.admin.getUserById(userId);
    const meta = (fullAuthUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const displayName =
      (typeof meta.display_name === "string" && meta.display_name) ||
      (typeof meta.username === "string" && meta.username) ||
      (user.email && user.email.split("@")[0]) ||
      "there";
    const tier = typeof meta.subscription_tier === "string" ? meta.subscription_tier : "free";

    const data = await cacheWithFallback(cacheKey, 30, async () => {
      const [walletsR, watchlistR, alertsR, followsR, vtxR] = await Promise.all([
        supabase.from("wallet_identities").select("address, chain").eq("user_id", userId),
        supabase.from("watchlist").select("token_id, chain").eq("user_id", userId).limit(20),
        supabase
          .from("alerts")
          .select("*")
          .eq("user_id", userId)
          .eq("triggered", true)
          .gt("triggered_at", new Date(Date.now() - 86_400_000).toISOString())
          .limit(5),
        supabase.from("user_whale_follows").select("whale_address").eq("user_id", userId).limit(10),
        supabase
          .from("vtx_conversations")
          .select("id, title, updated_at, messages")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
          .limit(10),
      ]);

      const recentVtx = ((vtxR.data as VtxConversation[] | null) ?? []).map((c) => {
        const msgs = Array.isArray(c.messages) ? (c.messages as unknown[]) : [];
        return {
          id: c.id,
          title: c.title,
          updatedAt: c.updated_at,
          lastMessage: msgs.length > 0 ? msgs[msgs.length - 1] : null,
        };
      });

      return {
        user: { id: userId, email: user.email, displayName, tier },
        wallets: walletsR.data ?? [],
        watchlist: watchlistR.data ?? [],
        alertsToday: alertsR.data ?? [],
        alertsCount: (alertsR.data ?? []).length,
        follows: followsR.data ?? [],
        recentVtx,
      };
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error("[dashboard/homepage]", err);
    return NextResponse.json({ error: "Failed to load homepage data" }, { status: 500 });
  }
}
