import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withTierGate } from "@/lib/subscriptions/apiTierGate";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkTier } from "@/lib/subscriptions/tierCheck";
import { addressesEqual, normalizeAddress } from "@/lib/utils/addressNormalize";

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
  launchpads_allowed?: string[] | null;
  trigger_whale_address?: string | null;
  trigger_price_target?: number | null;
  amount_per_snipe_usd: number;
  daily_max_snipes?: number;
  daily_max_spend_usd?: number;
  auto_execute?: boolean;
  wallet_source: "metamask" | "phantom" | "builtin";
  wallet_addresses?: string[];
  // Execution + risk-management fields the config modal sets. Previously the
  // route silently dropped these, so TP/SL/trailing never persisted and the
  // autosell engine had nothing to act on.
  max_slippage_bps?: number;
  priority_fee_native?: number | null;
  mev_protect?: boolean;
  take_profit_pct?: number | null;
  stop_loss_pct?: number | null;
  trailing_stop_pct?: number | null;
  auto_sell_on_target?: boolean;
  paused?: boolean;
  expiry_hours?: number | null;
}

interface UserWalletEntry {
  address?: string;
  chain?: string;
}

/**
 * Risk #7 from session G §4n. The matcher / executor read
 * sniper_criteria.wallet_addresses to know which user wallet to route a
 * snipe through. Without this check, a user could submit any address —
 * including someone else's — and the executor would happily insert a
 * pending_trades row for that wallet on their own user_id. The user
 * couldn't sign the trade (they don't hold the key), but the audit
 * surface would be wrong and an admin tool that trusts the field would
 * leak it.
 *
 * Returns the list of owned addresses (canonical form) so the caller can
 * also re-canonicalize before storing.
 */
async function getOwnedAddresses(userId: string): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("user_wallets_v2")
    .select("wallets,default_address")
    .eq("user_id", userId)
    .maybeSingle<{ wallets: unknown; default_address: string | null }>();
  if (!data) return [];
  const owned: string[] = [];
  if (data.default_address) owned.push(data.default_address);
  if (Array.isArray(data.wallets)) {
    for (const w of data.wallets as UserWalletEntry[]) {
      if (w && typeof w.address === "string" && w.address) owned.push(w.address);
    }
  }
  return owned;
}

export const GET = withTierGate("max", async (_request: NextRequest) => {
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

export const POST = withTierGate("max", async (request: NextRequest) => {
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

  if (!["metamask", "phantom", "builtin"].includes(body.wallet_source)) {
    return NextResponse.json({ error: "wallet_source must be metamask|phantom|builtin" }, { status: 400 });
  }

  // Ownership check on wallet_addresses (risk #7). Each submitted address must
  // appear in the caller's user_wallets_v2 row. Reject the whole insert on a
  // single mismatch — silently dropping unknown addresses would mask UI bugs
  // and could let stale client state pollute the criteria row.
  let walletAddresses: string[] | null = null;
  if (body.wallet_addresses !== undefined) {
    if (!Array.isArray(body.wallet_addresses)) {
      return NextResponse.json({ error: "wallet_addresses must be a string array" }, { status: 400 });
    }
    const submitted = body.wallet_addresses
      .filter((a): a is string => typeof a === "string" && a.length > 0);
    if (submitted.length > 0) {
      const owned = await getOwnedAddresses(user.id);
      const unowned = submitted.filter(
        (s) => !owned.some((o) => addressesEqual(o, s)),
      );
      if (unowned.length > 0) {
        return NextResponse.json(
          { error: "wallet_addresses_not_owned", unowned },
          { status: 403 },
        );
      }
    }
    // Canonicalize before storing so downstream lookups (matcher,
    // executor, history) compare addresses chain-correctly. Skipping
    // this risks Solana mints being lower-cased on read elsewhere.
    walletAddresses = submitted.map((addr) => normalizeAddress(addr) ?? addr);
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
    launchpads_allowed: body.launchpads_allowed?.length ? body.launchpads_allowed : null,
    trigger_whale_address: body.trigger_whale_address ?? null,
    trigger_price_target: body.trigger_price_target ?? null,
    amount_per_snipe_usd: body.amount_per_snipe_usd,
    daily_max_snipes: body.daily_max_snipes ?? 5,
    daily_max_spend_usd: body.daily_max_spend_usd ?? 500,
    auto_execute: body.auto_execute ?? false,
    wallet_source: body.wallet_source,
    max_slippage_bps: body.max_slippage_bps ?? 100,
    priority_fee_native: body.priority_fee_native ?? null,
    mev_protect: body.mev_protect ?? true,
    take_profit_pct: body.take_profit_pct ?? null,
    stop_loss_pct: body.stop_loss_pct ?? null,
    trailing_stop_pct: body.trailing_stop_pct ?? null,
    auto_sell_on_target: body.auto_sell_on_target ?? false,
    paused: body.paused ?? false,
    expiry_hours: body.expiry_hours ?? null,
    ...(walletAddresses !== null ? { wallet_addresses: walletAddresses } : {}),
  };

  const { data, error } = body.id
    ? await sb.from("sniper_criteria").update(row).eq("id", body.id).eq("user_id", user.id).select().single()
    : await sb.from("sniper_criteria").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ criteria: data });
});

export const PATCH = withTierGate("max", async (request: NextRequest) => {
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

export const DELETE = withTierGate("max", async (request: NextRequest) => {
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
