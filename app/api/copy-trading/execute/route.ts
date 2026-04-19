import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getTokenSecurity, getAddressSecurity } from "@/lib/services/goplus";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { executeTrade } from "@/lib/trading/relayer";
import { sizeCopySell } from "@/lib/trading/copyTradeSell";

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

interface ExecuteBody {
  source_whale: string;
  source_tx_hash: string;
  chain: string;
  token_address: string;
  token_symbol?: string;
  action: "buy" | "sell";
  amount_usd: number;
}

// Per-chain USDC funding source for buys. Mirrors copy-trade-monitor cron so
// manual and automated paths produce identical pending_trades shape.
function usdcForChain(chain: string): string | null {
  switch (chain.toLowerCase()) {
    case "ethereum":
    case "eth":      return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    case "base":     return "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    case "polygon":
    case "matic":    return "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
    case "arbitrum":
    case "arb":      return "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    case "optimism":
    case "op":       return "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
    case "bsc":
    case "bnb":      return "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
    case "solana":
    case "sol":      return "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    default:         return null;
  }
}

/**
 * Manual user-triggered copy-trade execution.
 *
 * Validates the user's copy rule, runs GoPlus token+address security checks,
 * checks the daily cap rolling window, then hands off to the non-custodial
 * relayer (lib/trading/relayer.executeTrade). The relayer creates a
 * pending_trades row that the PendingTradesBanner picks up; the user signs
 * in their browser via the same wallet source as a normal swap.
 *
 * Replaces the old "awaiting_relayer" placeholder. Identical execution path
 * to /api/cron/copy-trade-monitor.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as ExecuteBody;
  if (!body.source_whale || !body.source_tx_hash || !body.token_address || !body.chain || !body.action) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (body.action === "buy" && !(body.amount_usd > 0)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // Helper: insert a blocked-or-failed user_copy_trades row with consistent shape.
  const recordBlocked = async (
    status: "blocked_rule" | "blocked_security" | "failed",
    failureReason: string,
    securityScore?: number,
  ) => {
    await supabase.from("user_copy_trades").insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.action === "buy" ? body.amount_usd : null,
      status,
      failure_reason: failureReason,
      ...(typeof securityScore === "number" ? { security_score: securityScore } : {}),
    });
  };

  // 1. Look up copy rule
  const { data: rule } = await supabase
    .from("user_copy_rules")
    .select("*")
    .eq("user_id", user.id)
    .eq("whale_address", body.source_whale)
    .eq("chain", body.chain)
    .maybeSingle();

  if (!rule || !rule.enabled) {
    await recordBlocked("blocked_rule", rule ? "rule_disabled" : "no_rule");
    return NextResponse.json({ error: "No active copy rule" }, { status: 403 });
  }

  // 2. Rule guards (only meaningful for buys; sells always exit a held position)
  if (body.action === "buy") {
    if (body.amount_usd > rule.max_per_trade_usd) {
      await recordBlocked("blocked_rule", "exceeds_per_trade_cap");
      return NextResponse.json({ error: "Exceeds per-trade cap" }, { status: 403 });
    }
    if (Array.isArray(rule.tokens_blacklist) && rule.tokens_blacklist.includes(body.token_address.toLowerCase())) {
      await recordBlocked("blocked_rule", "token_blacklisted");
      return NextResponse.json({ error: "Token is blacklisted" }, { status: 403 });
    }
    if (Array.isArray(rule.chains_allowed) && rule.chains_allowed.length > 0 && !rule.chains_allowed.includes(body.chain)) {
      await recordBlocked("blocked_rule", "chain_not_allowed");
      return NextResponse.json({ error: "Chain not allowed" }, { status: 403 });
    }

    // Daily cap rolling 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("user_copy_trades")
      .select("amount_usd")
      .eq("user_id", user.id)
      .in("status", ["pending", "success"])
      .gt("created_at", since);
    const rollingUsd = (recent ?? []).reduce(
      (acc: number, r: { amount_usd: number | null }) => acc + (r.amount_usd ?? 0),
      0,
    );
    if (rollingUsd + body.amount_usd > rule.daily_cap_usd) {
      await recordBlocked("blocked_rule", "daily_cap_reached");
      return NextResponse.json({ error: "Daily cap reached" }, { status: 403 });
    }
  }

  // 3. GoPlus token + address security
  const tokenSec = await getTokenSecurity(body.token_address, body.chain).catch(() => null);
  const addrSec = await getAddressSecurity(body.source_whale, body.chain).catch(() => null);

  let score = 100;
  const reasons: string[] = [];
  if (tokenSec && typeof tokenSec === "object") {
    const s = tokenSec as unknown as Record<string, unknown>;
    if (s.isHoneypot) { score -= 60; reasons.push("honeypot"); }
    if (s.isMintable) { score -= 15; reasons.push("mintable"); }
    if (s.ownerCanChangeBalance) { score -= 25; reasons.push("owner_balance_mutable"); }
    const buyTax = typeof s.buyTax === "number" ? s.buyTax : 0;
    const sellTax = typeof s.sellTax === "number" ? s.sellTax : 0;
    if (buyTax > 10) { score -= 10; reasons.push(`buy_tax_${buyTax}`); }
    if (sellTax > 10) { score -= 10; reasons.push(`sell_tax_${sellTax}`); }
  }
  if (addrSec && typeof addrSec === "object") {
    const a = addrSec as unknown as Record<string, unknown>;
    if (a.isScam) { score -= 80; reasons.push("scam_address"); }
    if (a.isBlacklisted) { score -= 50; reasons.push("blacklisted"); }
  }

  if (score < 40) {
    await recordBlocked("blocked_security", reasons.join(",") || "security_score_too_low", score);
    return NextResponse.json({ error: "Security check failed", score, reasons }, { status: 403 });
  }

  // 4. Insert pending user_copy_trades row (relayer will link the pending_trade_id
  //    via source_order_id; receipt-reconciliation cron writes back actuals).
  const admin = getSupabaseAdmin();
  const { data: inserted, error: insertErr } = await admin
    .from("user_copy_trades")
    .insert({
      user_id: user.id,
      source_whale: body.source_whale,
      source_tx_hash: body.source_tx_hash,
      chain: body.chain,
      token_address: body.token_address,
      token_symbol: body.token_symbol ?? null,
      action: body.action,
      amount_usd: body.action === "buy" ? body.amount_usd : null,
      status: "pending",
      security_score: score,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    Sentry.captureException(insertErr ?? new Error("user_copy_trades insert returned no row"), {
      tags: { module: "copy-trade.execute", user_id: user.id },
    });
    return NextResponse.json({ error: insertErr?.message ?? "Could not record trade" }, { status: 500 });
  }

  // 5. Build trade intent based on action direction.
  const usdcAddr = usdcForChain(body.chain);
  if (!usdcAddr) {
    await admin.from("user_copy_trades").update({
      status: "failed",
      failure_reason: `unsupported_chain_${body.chain}`,
    }).eq("id", inserted.id);
    return NextResponse.json({ error: "Unsupported chain for copy trade" }, { status: 400 });
  }

  const walletSource: "external_evm" | "external_solana" =
    body.chain.toLowerCase() === "solana" || body.chain.toLowerCase() === "sol"
      ? "external_solana"
      : "external_evm";

  let fromTokenAddress: string;
  let fromTokenSymbol: string | null;
  let toTokenAddress: string;
  let toTokenSymbol: string | null;
  let amountIn: string;

  if (body.action === "sell") {
    const sizing = await sizeCopySell({
      userId: user.id,
      chain: body.chain,
      tokenAddress: body.token_address,
    });
    if (!sizing) {
      await admin.from("user_copy_trades").update({
        status: "failed",
        failure_reason: "no_balance_to_sell",
      }).eq("id", inserted.id);
      return NextResponse.json({ error: "No token balance to sell" }, { status: 400 });
    }
    fromTokenAddress = body.token_address;
    fromTokenSymbol = body.token_symbol ?? null;
    toTokenAddress = usdcAddr;
    toTokenSymbol = "USDC";
    amountIn = sizing.amountInRaw;
  } else {
    fromTokenAddress = usdcAddr;
    fromTokenSymbol = "USDC";
    toTokenAddress = body.token_address;
    toTokenSymbol = body.token_symbol ?? null;
    amountIn = String(body.amount_usd);
  }

  // 6. Hand off to the non-custodial relayer. Creates pending_trades row +
  //    notifies user. Banner picks it up and signs in browser.
  const slippageBps = (rule.max_slippage_bps as number | null) ?? 200;
  const result = await executeTrade({
    userId: user.id,
    chain: body.chain,
    walletSource,
    fromTokenAddress,
    fromTokenSymbol,
    toTokenAddress,
    toTokenSymbol,
    amountIn,
    slippageBps,
    reason: "copy_trade",
    sourceOrderId: inserted.id,
    sourceOrderTable: "user_copy_trades",
  });

  if (result.success && result.awaitingUserConfirmation) {
    return NextResponse.json({
      ok: true,
      trade_id: inserted.id,
      pending_trade_id: result.pendingTradeId,
      security_score: score,
      route_provider: result.route?.provider ?? null,
      expected_amount_out: result.route?.amountOut ?? null,
    });
  }

  // Relayer rejected (security or no route). Mirror its failure_reason onto
  // the user_copy_trades row and surface it to the caller.
  await admin.from("user_copy_trades").update({
    status: result.securityBlocked ? "blocked_security" : "failed",
    failure_reason: result.failureReason ?? "relayer_rejected",
  }).eq("id", inserted.id);

  return NextResponse.json(
    {
      error: result.failureReason ?? "Relayer rejected trade",
      security_score: score,
    },
    { status: result.securityBlocked ? 403 : 500 },
  );
}
