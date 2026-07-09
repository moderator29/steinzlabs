import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import * as Sentry from "@sentry/nextjs";
import { getTokenSecurity, getAddressSecurity } from "@/lib/services/goplus";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { executeTrade } from "@/lib/trading/relayer";
import { sizeCopySell } from "@/lib/trading/copyTradeSell";
import { checkTierServer } from "@/lib/subscriptions/serverTierCheck";
import { logAdminAction } from "@/lib/admin/auditLog";
import { guardRoute } from "@/lib/api/guardRoute";
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
  const guard = await guardRoute(request, { rate: 'high' });
  if (!guard.ok) return guard.response;
  const supabase = await getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Copy trading is a Pro-tier feature (per the pricing page).
  const gate = await checkTierServer('pro');
  if (!gate.allowed) return NextResponse.json({ error: 'upgrade_required', requiredTier: gate.requiredTier, currentTier: gate.currentTier, expired: gate.expired }, { status: 403 });

  const body = (await request.json()) as ExecuteBody;
  if (!body.source_whale || !body.source_tx_hash || !body.token_address || !body.chain || !body.action) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (body.action === "buy" && !(body.amount_usd > 0)) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  // C.7: Idempotency-Key replay protection. Retries collapse into the
  // cached response so a double-tap or network blip doesn't queue
  // duplicate copy-trade executions.
  const { checkIdempotency, saveIdempotency } = await import("@/lib/api/idempotency");
  const idemp = await checkIdempotency(request, user.id, "/api/copy-trading/execute", body);
  if (idemp) return idemp;

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
  // #5: a paused rule must not execute even on an explicit manual click — the
  // cron/matcher already honor `paused`, so the manual path must too.
  if (rule.paused) {
    await recordBlocked("blocked_rule", "rule_paused");
    return NextResponse.json({ error: "Copy rule is paused" }, { status: 403 });
  }

  // 2. Rule guards (only meaningful for buys; sells always exit a held position)
  if (body.action === "buy") {
    if (body.amount_usd > rule.max_per_trade_usd) {
      await recordBlocked("blocked_rule", "exceeds_per_trade_cap");
      return NextResponse.json({ error: "Exceeds per-trade cap" }, { status: 403 });
    }
    if (Array.isArray(rule.tokens_blacklist) && rule.tokens_blacklist.map((t: string) => normalizeAddress(t, body.chain)).includes(normalizeAddress(body.token_address, body.chain))) {
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
  // Affirmative rug flags that must block UNCONDITIONALLY, mirroring isHighRisk
  // (lib/services/goplus.ts). A pure honeypot is only a -60 score hit here, which
  // lands on exactly 40 and slips past the `score < 40` gate — so the score path
  // alone let honeypots through. Each hard flag blocks on its own. tokenSec is
  // null only on a scanner outage (fetched with .catch(() => null)) — we fail
  // OPEN there and never block a legit copy trade during an outage.
  const hardReasons: string[] = [];
  if (tokenSec && typeof tokenSec === "object") {
    const s = tokenSec as unknown as Record<string, unknown>;
    if (s.isHoneypot) hardReasons.push("honeypot");
    if (s.cannotBuy) hardReasons.push("cannot_buy");
    if (s.cannotSellAll) hardReasons.push("cannot_sell_all");
    if (s.selfDestruct) hardReasons.push("self_destruct");
    if (s.canTakeBackOwnership) hardReasons.push("can_take_back_ownership");
    if (s.ownerCanChangeBalance) hardReasons.push("owner_balance_mutable");
    if (s.hasHiddenOwner) hardReasons.push("hidden_owner");
    // buyTax/sellTax are 0..1 FRACTIONS (0.30 = 30%), matching goplusService.
    const sellTaxFrac = typeof s.sellTax === "number" ? s.sellTax : 0;
    if (sellTaxFrac > 0.30) hardReasons.push("extreme_sell_tax");
  }
  if (hardReasons.length > 0) {
    await recordBlocked("blocked_security", hardReasons.join(","), 0);
    return NextResponse.json({ error: "Security check failed", score: 0, reasons: hardReasons }, { status: 403 });
  }
  if (tokenSec && typeof tokenSec === "object") {
    const s = tokenSec as unknown as Record<string, unknown>;
    if (s.isHoneypot) { score -= 60; reasons.push("honeypot"); }
    if (s.isMintable) { score -= 15; reasons.push("mintable"); }
    if (s.ownerCanChangeBalance) { score -= 25; reasons.push("owner_balance_mutable"); }
    // Taxes are 0..1 FRACTIONS (0.10 = 10%). The old `> 10` compared a fraction
    // against 1000%, so the penalty never fired.
    const buyTax = typeof s.buyTax === "number" ? s.buyTax : 0;
    const sellTax = typeof s.sellTax === "number" ? s.sellTax : 0;
    if (buyTax > 0.10) { score -= 10; reasons.push(`buy_tax_${buyTax}`); }
    if (sellTax > 0.10) { score -= 10; reasons.push(`sell_tax_${sellTax}`); }
  }
  if (addrSec && typeof addrSec === "object") {
    const a = addrSec as unknown as Record<string, unknown>;
    // AddressScanResult has NO `isScam` field — it exposes `isMalicious`
    // (phishing / stealing / cybercrime), `isBlacklisted`, `isPhishing`, `isMixer`.
    // The old read of `a.isScam` was always undefined, so this -80 penalty was
    // dead and a malicious source whale never lost points.
    if (a.isMalicious) { score -= 80; reasons.push("malicious_address"); }
    if (a.isBlacklisted) { score -= 50; reasons.push("blacklisted"); }
  }

  if (score < 40) {
    await recordBlocked("blocked_security", reasons.join(",") || "security_score_too_low", score);
    return NextResponse.json({ error: "Security check failed", score, reasons }, { status: 403 });
  }

  // 4. Atomically claim the pending row under the per-user cap lock (#13). This
  //    replaces a plain insert + the racy app-level cap check: claim_copy_trade
  //    re-checks the rolling 24h spend while holding an advisory lock, so the
  //    manual path can't overspend concurrently with the cron / webhook paths.
  const admin = getSupabaseAdmin();
  const { data: claimedId, error: claimErr } = await admin.rpc("claim_copy_trade", {
    p_user: user.id,
    p_daily_cap: rule.daily_cap_usd ?? null,
    p_amount: body.action === "buy" ? body.amount_usd : null,
    p_source_whale: body.source_whale,
    p_source_tx: body.source_tx_hash,
    p_chain: body.chain,
    p_token_address: body.token_address,
    p_token_symbol: body.token_symbol ?? null,
    p_action: body.action,
    p_security_score: score,
  });
  if (claimErr) {
    Sentry.captureException(claimErr, { tags: { module: "copy-trade.execute", user_id: user.id } });
    return NextResponse.json({ error: claimErr.message ?? "Could not record trade" }, { status: 500 });
  }
  if (!claimedId) {
    await recordBlocked("blocked_rule", "daily_cap_reached", score);
    return NextResponse.json({ error: "Daily cap reached" }, { status: 403 });
  }
  const inserted = { id: claimedId as string };

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
    // §copy-1 — `String(body.amount_usd)` lost decimal precision because
    // JS Number → String can drop trailing zeros (e.g. 10.50 → "10.5").
    // Pin to 6 decimals which matches USDC's on-chain unit and preserves
    // the user's intended sizing through the aggregator.
    const usd = Number(body.amount_usd);
    if (!Number.isFinite(usd) || usd <= 0) {
      return NextResponse.json({ error: "Invalid amount_usd" }, { status: 400 });
    }
    amountIn = usd.toFixed(6);
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
    await logAdminAction({
      adminId: user.id,
      targetUserId: user.id,
      action: "copy_trade_execute",
      details: {
        trade_id: inserted.id,
        pending_trade_id: result.pendingTradeId,
        source_whale: body.source_whale,
        source_tx_hash: body.source_tx_hash,
        chain: body.chain,
        token_address: body.token_address,
        action: body.action,
        amount_usd: body.action === "buy" ? body.amount_usd : null,
        security_score: score,
        route_provider: result.route?.provider ?? null,
      },
    });
    const successPayload = {
      ok: true as const,
      trade_id: inserted.id,
      pending_trade_id: result.pendingTradeId,
      security_score: score,
      route_provider: result.route?.provider ?? null,
      expected_amount_out: result.route?.amountOut ?? null,
    };
    await saveIdempotency(request, user.id, "/api/copy-trading/execute", body, 200, successPayload);
    return NextResponse.json(successPayload);
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
