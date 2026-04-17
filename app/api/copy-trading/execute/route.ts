import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getTokenSecurity, getAddressSecurity } from "@/lib/services/goplus";

export const runtime = "nodejs";

function getSupabase() {
  const cookieStore = cookies();
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

interface ExecuteBody {
  source_whale: string;
  source_tx_hash: string;
  chain: string;
  token_address: string;
  token_symbol?: string;
  action: "buy" | "sell";
  amount_usd: number;
}

/**
 * Copy-trade execution endpoint.
 *
 * Validates the user's copy rule, runs GoPlus token+address security checks,
 * checks the daily cap rolling window, and records a user_copy_trades row.
 * Actual on-chain signing is deferred to the Session 5B-2 signed-tx relayer
 * (same pattern as the Phase 3 order monitors).
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as ExecuteBody;
  if (!body.source_whale || !body.source_tx_hash || !body.token_address || !body.chain || !body.action) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!(body.amount_usd > 0)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // 1. Look up copy rule
  const { data: rule } = await supabase
    .from("user_copy_rules")
    .select("*")
    .eq("user_id", user.id)
    .eq("whale_address", body.source_whale)
    .eq("chain", body.chain)
    .maybeSingle();

  if (!rule || !rule.enabled) {
    await supabase.from("user_copy_trades").insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.amount_usd,
      status: "blocked_rule",
      failure_reason: rule ? "rule_disabled" : "no_rule",
    });
    return NextResponse.json({ error: "No active copy rule" }, { status: 403 });
  }

  // 2. Rule guards
  if (body.amount_usd > rule.max_per_trade_usd) {
    await supabase.from("user_copy_trades").insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.amount_usd,
      status: "blocked_rule",
      failure_reason: "exceeds_per_trade_cap",
    });
    return NextResponse.json({ error: "Exceeds per-trade cap" }, { status: 403 });
  }
  if (Array.isArray(rule.tokens_blacklist) && rule.tokens_blacklist.includes(body.token_address.toLowerCase())) {
    await supabase.from("user_copy_trades").insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.amount_usd,
      status: "blocked_rule",
      failure_reason: "token_blacklisted",
    });
    return NextResponse.json({ error: "Token is blacklisted" }, { status: 403 });
  }
  if (Array.isArray(rule.chains_allowed) && rule.chains_allowed.length > 0 && !rule.chains_allowed.includes(body.chain)) {
    await supabase.from("user_copy_trades").insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.amount_usd,
      status: "blocked_rule",
      failure_reason: "chain_not_allowed",
    });
    return NextResponse.json({ error: "Chain not allowed" }, { status: 403 });
  }

  // 3. Daily cap rolling 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("user_copy_trades")
    .select("amount_usd")
    .eq("user_id", user.id)
    .eq("status", "success")
    .gt("created_at", since);
  const rollingUsd = (recent ?? []).reduce(
    (acc: number, r: { amount_usd: number | null }) => acc + (r.amount_usd ?? 0),
    0,
  );
  if (rollingUsd + body.amount_usd > rule.daily_cap_usd) {
    await supabase.from("user_copy_trades").insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.amount_usd,
      status: "blocked_rule",
      failure_reason: "daily_cap_reached",
    });
    return NextResponse.json({ error: "Daily cap reached" }, { status: 403 });
  }

  // 4. GoPlus token security
  const tokenSec = await getTokenSecurity(body.token_address, body.chain).catch(() => null);
  const addrSec = await getAddressSecurity(body.source_whale, body.chain).catch(() => null);

  let score = 100;
  const reasons: string[] = [];
  if (tokenSec && typeof tokenSec === "object") {
    const s = tokenSec as Record<string, unknown>;
    if (s.isHoneypot) { score -= 60; reasons.push("honeypot"); }
    if (s.isMintable) { score -= 15; reasons.push("mintable"); }
    if (s.ownerCanChangeBalance) { score -= 25; reasons.push("owner_balance_mutable"); }
    const buyTax = typeof s.buyTax === "number" ? s.buyTax : 0;
    const sellTax = typeof s.sellTax === "number" ? s.sellTax : 0;
    if (buyTax > 10) { score -= 10; reasons.push(`buy_tax_${buyTax}`); }
    if (sellTax > 10) { score -= 10; reasons.push(`sell_tax_${sellTax}`); }
  }
  if (addrSec && typeof addrSec === "object") {
    const a = addrSec as Record<string, unknown>;
    if (a.isScam) { score -= 80; reasons.push("scam_address"); }
    if (a.isBlacklisted) { score -= 50; reasons.push("blacklisted"); }
  }

  if (score < 40) {
    await supabase.from("user_copy_trades").insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.amount_usd,
      status: "blocked_security",
      failure_reason: reasons.join(",") || "security_score_too_low",
      security_score: score,
    });
    return NextResponse.json({ error: "Security check failed", score, reasons }, { status: 403 });
  }

  // 5. Record as pending — relayer will flip to success/failed with tx hash
  const { data: trade, error } = await supabase
    .from("user_copy_trades")
    .insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.amount_usd,
      status: "pending",
      failure_reason: "awaiting_relayer",
      security_score: score,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, trade, security_score: score });
}
