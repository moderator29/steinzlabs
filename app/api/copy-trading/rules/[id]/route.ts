import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";
import { logAdminAction } from "@/lib/admin/auditLog";

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

export const PATCH = withTierGate("pro", async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<{
    enabled: boolean;
    paused: boolean;
    mode: "alerts_only" | "oneclick" | "auto_copy";
    max_per_trade_usd: number;
    daily_cap_usd: number;
    pct_of_whale: number | null;
    tp_pct: number | null;
    sl_pct: number | null;
    max_slippage_bps: number;
    copy_direction: "both" | "buy" | "sell";
    min_trade_size_usd: number | null;
    tokens_allowlist: string[] | null;
    tokens_blacklist: string[] | null;
    cooldown_until: string | null;
  }>;
  const update: Record<string, unknown> = {};
  if (body.enabled !== undefined) update.enabled = body.enabled;
  if (body.paused !== undefined) update.paused = body.paused;
  if (body.mode !== undefined) {
    if (!["alerts_only", "oneclick", "auto_copy"].includes(body.mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    update.mode = body.mode;
  }
  if (body.max_per_trade_usd !== undefined) update.max_per_trade_usd = body.max_per_trade_usd;
  if (body.daily_cap_usd !== undefined) update.daily_cap_usd = body.daily_cap_usd;
  if (body.pct_of_whale !== undefined) update.pct_of_whale = body.pct_of_whale;
  if (body.tp_pct !== undefined) update.tp_pct = body.tp_pct;
  if (body.sl_pct !== undefined) update.sl_pct = body.sl_pct;
  if (body.max_slippage_bps !== undefined) update.max_slippage_bps = body.max_slippage_bps;
  if (body.copy_direction !== undefined) {
    if (!["both", "buy", "sell"].includes(body.copy_direction)) {
      return NextResponse.json({ error: "Invalid copy_direction" }, { status: 400 });
    }
    update.copy_direction = body.copy_direction;
  }
  if (body.min_trade_size_usd !== undefined) update.min_trade_size_usd = body.min_trade_size_usd;
  if (body.tokens_allowlist !== undefined) update.tokens_allowlist = body.tokens_allowlist;
  if (body.tokens_blacklist !== undefined) update.tokens_blacklist = body.tokens_blacklist;
  if (body.cooldown_until !== undefined) update.cooldown_until = body.cooldown_until;

  const { error } = await supabase
    .from("user_copy_rules")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction({
    adminId: user.id,
    targetUserId: user.id,
    action: "copy_rule_update",
    details: { rule_id: id, changes: update },
  });
  return NextResponse.json({ ok: true });
});

export const DELETE = withTierGate("pro", async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("user_copy_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAdminAction({
    adminId: user.id,
    targetUserId: user.id,
    action: "copy_rule_delete",
    details: { rule_id: id },
  });
  return NextResponse.json({ ok: true });
});
