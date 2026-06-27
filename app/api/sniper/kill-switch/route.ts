import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getSupabase() {
  const cookieStore = await cookies();
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
 * User-facing kill switch: pauses or resumes ALL of the caller's
 * sniper_criteria in one call. Uses `paused` (reversible) rather than `enabled`
 * so resume doesn't lose each sniper's on/off state. Body: { enabled: boolean }
 * where enabled=false KILLS (pause all) and enabled=true RESUMES (un-pause all).
 * The platform-wide admin kill-switch is separate (platform_sniper_state).
 */
export const POST = withTierGate("max", async (request: NextRequest) => {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  // enabled === false → kill (pause all); anything else → resume (un-pause all).
  const paused = body.enabled === false;

  const { error, count } = await sb
    .from("sniper_criteria")
    .update({ paused }, { count: "exact" })
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, killed: paused, affected: count ?? 0 });
});

/** GET → is the caller currently killed? (has criteria and all are paused) */
export const GET = withTierGate("max", async (_request: NextRequest) => {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await sb.from("sniper_criteria").select("paused").eq("user_id", user.id);
  const rows = data ?? [];
  const killed = rows.length > 0 && rows.every((r) => (r as { paused: boolean }).paused);
  return NextResponse.json({ killed });
});
