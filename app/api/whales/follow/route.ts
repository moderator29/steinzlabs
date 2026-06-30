import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";
import { normalizeAddress } from "@/lib/utils/addressNormalize";

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

// Bug §5a — the detail + directory pages used to default `following=false`
// on mount because there was no way to ask "is the current user already
// following this whale?". After a successful POST the local state flipped
// optimistically but a fresh page load lost it. GET reads the row from
// user_whale_follows so the button always shows the truth.
//
// Two shapes:
//   GET /api/whales/follow?whale_address=...&chain=...  → { following: boolean }
//   GET /api/whales/follow?list=1                       → { follows: [...] }
export const GET = withTierGate("pro", async (request: NextRequest) => {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  if (sp.get("list") === "1") {
    const { data, error } = await supabase
      .from("user_whale_follows")
      .select("whale_address, chain, label, copy_mode, created_at")
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ follows: data ?? [] });
  }

  const whaleAddress = sp.get("whale_address");
  const chain = sp.get("chain");
  if (!whaleAddress || !chain) {
    return NextResponse.json({ error: "Missing whale_address or chain" }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("user_whale_follows")
    .select("whale_address")
    .eq("user_id", user.id)
    .eq("whale_address", normalizeAddress(whaleAddress, chain))
    .eq("chain", chain)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ following: !!data });
});

export const POST = withTierGate("pro", async (request: NextRequest) => {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { whale_address, chain, label, copy_mode } = await request.json();
  if (!whale_address || !chain) {
    return NextResponse.json({ error: "Missing whale_address or chain" }, { status: 400 });
  }

  // Normalize on write so the dispatcher's exact-match (Solana) and the
  // following/unfollow lookups all agree: EVM lowercased, Solana case preserved.
  const { error } = await supabase.from("user_whale_follows").upsert(
    {
      user_id: user.id,
      whale_address: normalizeAddress(whale_address, chain),
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
    .eq("whale_address", normalizeAddress(whaleAddress, chain))
    .eq("chain", chain);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
