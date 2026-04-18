import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";

export const runtime = "nodejs";

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );
}

export const POST = withTierGate("pro", async (request: NextRequest) => {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { whale_address, chain, label, copy_mode } = await request.json();
  if (!whale_address || !chain) {
    return NextResponse.json({ error: "Missing whale_address or chain" }, { status: 400 });
  }

  const { error } = await supabase.from("user_whale_follows").upsert(
    {
      user_id: user.id,
      whale_address,
      chain,
      label: label ?? null,
      copy_mode: copy_mode ?? "alerts",
    },
    { onConflict: "user_id,whale_address,chain" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

export const DELETE = withTierGate("pro", async (request: NextRequest) => {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const whaleAddress = request.nextUrl.searchParams.get("whale_address");
  const chain = request.nextUrl.searchParams.get("chain");
  if (!whaleAddress || !chain) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const { error } = await supabase
    .from("user_whale_follows")
    .delete()
    .eq("user_id", user.id)
    .eq("whale_address", whaleAddress)
    .eq("chain", chain);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
