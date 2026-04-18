import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

const DEFAULTS = {
  default_slippage_bps: 100,
  expert_mode: false,
  auto_approve_under_usd: 0,
  preferred_dex_route: "best_price",
  mev_protection_enabled: true,
  default_chart_timeframe: "1h",
  default_indicators: ["ema_20", "ema_50"],
};

export async function GET() {
  const supabase = await getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_trading_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    await supabase.from("user_trading_preferences").insert({ user_id: user.id, ...DEFAULTS });
    return NextResponse.json({ preferences: { user_id: user.id, ...DEFAULTS } });
  }
  return NextResponse.json({ preferences: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await getSupabase();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const allowed = [
    "default_slippage_bps",
    "expert_mode",
    "auto_approve_under_usd",
    "preferred_dex_route",
    "mev_protection_enabled",
    "default_chart_timeframe",
    "default_indicators",
    "last_used_token_from",
    "last_used_token_to",
    "last_used_chain",
    "favorite_pairs",
  ];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in body) update[k] = body[k];

  const { error } = await supabase
    .from("user_trading_preferences")
    .upsert({ user_id: user.id, ...update }, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
