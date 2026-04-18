import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkTier } from "@/lib/subscriptions/tierCheck";

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

interface CriteriaBody {
  id?: string;
  name: string;
  enabled?: boolean;
  trigger_type: "new_token_launch" | "whale_buy" | "price_target";
  chains_allowed: string[];
  min_liquidity_usd?: number;
  max_buy_tax_bps?: number;
  max_sell_tax_bps?: number;
  min_holder_count?: number;
  max_age_hours?: number;
  min_security_score?: number;
  block_honeypots?: boolean;
  trigger_whale_address?: string | null;
  trigger_price_target?: number | null;
  amount_per_snipe_usd: number;
  daily_max_snipes?: number;
  daily_max_spend_usd?: number;
  auto_execute?: boolean;
  wallet_source: "metamask" | "phantom" | "builtin";
}

export const GET = withTierGate("pro", async (_request: NextRequest) => {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await sb
    .from("sniper_criteria")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ criteria: data ?? [] });
});

export const POST = withTierGate("pro", async (request: NextRequest) => {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CriteriaBody | null;
  if (!body || !body.name || !body.trigger_type || !body.chains_allowed?.length) {
    return NextResponse.json({ error: "name, trigger_type, chains_allowed required" }, { status: 400 });
  }
  if (!(body.amount_per_snipe_usd > 0)) {
    return NextResponse.json({ error: "amount_per_snipe_usd must be > 0" }, { status: 400 });
  }

  // auto_execute is Max-only.
  if (body.auto_execute) {
    const admin = getSupabaseAdmin();
    const { data: profile } = await admin
      .from("profiles")
      .select("tier,tier_expires_at,role")
      .eq("id", user.id)
      .single<{ tier: string | null; tier_expires_at: string | null; role: string | null }>();
    const check = checkTier(profile?.tier, profile?.tier_expires_at, "max");
    const isAdmin = profile?.role === "admin";
    if (!isAdmin && !check.allowed) {
      return NextResponse.json(
        { error: "auto_execute_requires_max", currentTier: check.currentTier },
        { status: 403 },
      );
    }
  }

  const row = {
    user_id: user.id,
    name: body.name,
    enabled: body.enabled ?? true,
    trigger_type: body.trigger_type,
    chains_allowed: body.chains_allowed,
    min_liquidity_usd: body.min_liquidity_usd ?? 10_000,
    max_buy_tax_bps: body.max_buy_tax_bps ?? 1000,
    max_sell_tax_bps: body.max_sell_tax_bps ?? 1000,
    min_holder_count: body.min_holder_count ?? 10,
    max_age_hours: body.max_age_hours ?? 48,
    min_security_score: body.min_security_score ?? 60,
    block_honeypots: body.block_honeypots ?? true,
    trigger_whale_address: body.trigger_whale_address ?? null,
    trigger_price_target: body.trigger_price_target ?? null,
    amount_per_snipe_usd: body.amount_per_snipe_usd,
    daily_max_snipes: body.daily_max_snipes ?? 5,
    daily_max_spend_usd: body.daily_max_spend_usd ?? 500,
    auto_execute: body.auto_execute ?? false,
    wallet_source: body.wallet_source,
  };

  const { data, error } = body.id
    ? await sb.from("sniper_criteria").update(row).eq("id", body.id).eq("user_id", user.id).select().single()
    : await sb.from("sniper_criteria").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ criteria: data });
});

export const PATCH = withTierGate("pro", async (request: NextRequest) => {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id: string; enabled?: boolean } | null;
  if (!body?.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const update: Record<string, unknown> = {};
  if (body.enabled !== undefined) update.enabled = body.enabled;
  const { error } = await sb
    .from("sniper_criteria")
    .update(update)
    .eq("id", body.id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});

export const DELETE = withTierGate("pro", async (request: NextRequest) => {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const { error } = await sb
    .from("sniper_criteria")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
});
