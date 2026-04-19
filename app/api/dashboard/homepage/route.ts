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
    const data = await cacheWithFallback(cacheKey, 30, async () => {
      // Fan out everything in parallel including the profiles row so the
      // dashboard greeting always has tier + is_verified ready to render.
      const [profileR, walletsR, watchlistR, alertsR, followsR, vtxR] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(),
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

      const profile = (profileR.data ?? {}) as Record<string, unknown>;
      const displayName =
        (typeof profile.username === "string" && profile.username) ||
        (typeof profile.first_name === "string" && profile.first_name) ||
        (user.email && user.email.split("@")[0]) ||
        "there";
      const tierRaw = typeof profile.tier === "string" ? profile.tier : "free";
      const tier = (tierRaw === "mini" || tierRaw === "pro" || tierRaw === "max") ? tierRaw : "free";
      const tierExpiresAt = typeof profile.tier_expires_at === "string" ? profile.tier_expires_at : null;
      // Honor tier expiry — same logic as effectiveTier() helper.
      const effective =
        tier !== "free" && tierExpiresAt && new Date(tierExpiresAt).getTime() < Date.now()
          ? "free"
          : tier;
      const isVerified = profile.is_verified === true;
      const role = profile.role === "admin" ? "admin" : "user";

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
        user: {
          id: userId,
          email: user.email,
          displayName,
          tier: effective,
          isVerified,
          role,
        },
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
