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

export const GET = withTierGate("mini", async () => {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("user_copy_rules")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rules: data ?? [] });
});

interface RuleBody {
  whale_address: string;
  chain: string;
  max_per_trade_usd: number;
  daily_cap_usd: number;
  chains_allowed?: string[];
  tokens_blacklist?: string[];
  min_liquidity_usd?: number;
  max_slippage_bps?: number;
  require_confirmation?: boolean;
  enabled?: boolean;
}

export const POST = withTierGate("mini", async (request: NextRequest) => {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as RuleBody;
  if (!body.whale_address || !body.chain) {
    return NextResponse.json({ error: "Missing whale_address/chain" }, { status: 400 });
  }
  if (!(body.max_per_trade_usd > 0) || !(body.daily_cap_usd > 0)) {
    return NextResponse.json({ error: "Invalid caps" }, { status: 400 });
  }
  if (body.max_per_trade_usd > body.daily_cap_usd) {
    return NextResponse.json({ error: "max_per_trade_usd cannot exceed daily_cap_usd" }, { status: 400 });
  }

  const { error } = await supabase.from("user_copy_rules").upsert(
    {
      user_id: user.id,
      whale_address: body.whale_address,
      chain: body.chain,
      max_per_trade_usd: body.max_per_trade_usd,
      daily_cap_usd: body.daily_cap_usd,
      chains_allowed: body.chains_allowed ?? null,
      tokens_blacklist: body.tokens_blacklist ?? null,
      min_liquidity_usd: body.min_liquidity_usd ?? 50000,
      max_slippage_bps: body.max_slippage_bps ?? 200,
      require_confirmation: body.require_confirmation ?? true,
      enabled: body.enabled ?? true,
    },
    { onConflict: "user_id,whale_address,chain" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
