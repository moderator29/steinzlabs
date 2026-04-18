import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

/**
 * User-facing kill switch: disables ALL of the caller's sniper_criteria
 * in one call. The platform-wide admin kill-switch lives at
 * /api/admin/sniper-platform-state (separate route, not here).
 */
export const POST = withTierGate("pro", async (_request: NextRequest) => {
  const sb = getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { error, count } = await sb
    .from("sniper_criteria")
    .update({ enabled: false }, { count: "exact" })
    .eq("user_id", user.id)
    .eq("enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, paused: count ?? 0 });
});
