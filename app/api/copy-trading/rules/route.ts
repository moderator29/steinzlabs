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

type CopyMode = "alerts_only" | "oneclick" | "auto_copy";

interface RuleBody {
  whale_address: string;
  chain: string;
  mode?: CopyMode;
  max_per_trade_usd: number;
  daily_cap_usd: number;
  pct_of_whale?: number | null;
  tp_pct?: number | null;
  sl_pct?: number | null;
  wallet_address?: string | null;
  chains_allowed?: string[];
  tokens_blacklist?: string[];
  min_liquidity_usd?: number;
  max_slippage_bps?: number;
  require_confirmation?: boolean;
  enabled?: boolean;
  paused?: boolean;
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
  if (body.pct_of_whale != null) {
    const p = Number(body.pct_of_whale);
    if (!Number.isFinite(p) || p <= 0 || p > 100) {
      return NextResponse.json({ error: "pct_of_whale must be between 0 and 100" }, { status: 400 });
    }
  }
  if (body.tp_pct != null && (!Number.isFinite(Number(body.tp_pct)) || Number(body.tp_pct) <= 0)) {
    return NextResponse.json({ error: "tp_pct must be positive" }, { status: 400 });
  }
  if (body.sl_pct != null && (!Number.isFinite(Number(body.sl_pct)) || Number(body.sl_pct) <= 0)) {
    return NextResponse.json({ error: "sl_pct must be positive" }, { status: 400 });
  }

  const mode: CopyMode = body.mode ?? "oneclick";
  if (!["alerts_only", "oneclick", "auto_copy"].includes(mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  // Tier gates: alerts_only is allowed at mini+, oneclick at pro+, auto_copy
  // at max. The withTierGate("mini") wrapper enforces the floor; the
  // per-mode upgrade is enforced via the user's profile tier.
  if (mode !== "alerts_only") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("tier, tier_expires_at")
      .eq("id", user.id)
      .single<{ tier: string | null; tier_expires_at: string | null }>();
    const expired = profile?.tier_expires_at && new Date(profile.tier_expires_at) < new Date();
    const tier = expired ? "free" : profile?.tier ?? "free";
    const rank: Record<string, number> = { free: 0, mini: 1, pro: 2, max: 3 };
    const need = mode === "auto_copy" ? "max" : "pro";
    if ((rank[tier] ?? 0) < rank[need]) {
      return NextResponse.json(
        { error: `Mode '${mode}' requires ${need} tier`, requiredTier: need },
        { status: 403 },
      );
    }
  }

  const { error } = await supabase.from("user_copy_rules").upsert(
    {
      user_id: user.id,
      whale_address: body.whale_address,
      chain: body.chain,
      mode,
      max_per_trade_usd: body.max_per_trade_usd,
      daily_cap_usd: body.daily_cap_usd,
      pct_of_whale: body.pct_of_whale ?? null,
      tp_pct: body.tp_pct ?? null,
      sl_pct: body.sl_pct ?? null,
      wallet_address: body.wallet_address ?? null,
      chains_allowed: body.chains_allowed ?? null,
      tokens_blacklist: body.tokens_blacklist ?? null,
      min_liquidity_usd: body.min_liquidity_usd ?? 50000,
      max_slippage_bps: body.max_slippage_bps ?? 200,
      require_confirmation: body.require_confirmation ?? mode !== "auto_copy",
      enabled: body.enabled ?? true,
      paused: body.paused ?? false,
    },
    { onConflict: "user_id,whale_address,chain" },
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
