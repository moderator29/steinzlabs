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

export const GET = withTierGate("pro", async (request: NextRequest) => {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const criteriaId = request.nextUrl.searchParams.get("criteria_id");
  const decision = request.nextUrl.searchParams.get("decision");
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 100), 200);

  let q = sb
    .from("sniper_match_events")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (criteriaId) q = q.eq("criteria_id", criteriaId);
  if (decision) q = q.eq("decision", decision);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
});
