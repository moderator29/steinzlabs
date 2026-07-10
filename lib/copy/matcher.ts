/**
 * §3 Copy-trade matcher — webhook-driven counterpart to the
 * /api/cron/copy-trade-monitor poll loop.
 *
 * Given a freshly-recorded whale_activity row, fan out to every active
 * user_copy_rules row matching (chain, whale_address). For each follower:
 *
 *   - alerts_only: write user_copy_trades(status='alert') and queue a
 *                  Telegram push with a "Copy Now" deep-link.
 *   - oneclick:    call the existing relayer.executeTrade() — writes
 *                  pending_trades, security gate runs, user confirms in app.
 *   - auto_copy:   same path as oneclick. Non-custodial: the browser still
 *                  signs; auto-copy users opt into automatic confirmation
 *                  on the client side via a session-scoped flag set on
 *                  pending_trades.auto_confirm. The relayer/notifier honors
 *                  that flag when present.
 *
 * Daily caps, blacklist, cooldown, chains_allowed, and the per-(user,tx)
 * dedup live here so behavior matches the cron exactly. Cron remains as
 * catch-up for chains without a webhook subscription.
 */

import * as Sentry from "@sentry/nextjs";
import { parseUnits } from "ethers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { executeTrade } from "@/lib/trading/relayer";
import { sizeCopySell } from "@/lib/trading/copyTradeSell";
import { queueTelegramNotification } from "@/lib/telegram/notify";
import { normalizeAddress, isEvmChain } from "@/lib/utils/addressNormalize";

export interface CopyEvent {
  whale_address: string;
  chain: string;
  tx_hash: string;
  action: "buy" | "sell" | "swap";
  token_address: string | null;
  token_symbol: string | null;
  value_usd: number | null;
  timestamp: string;
}

export type CopyMode = "alerts_only" | "oneclick" | "auto_copy";

interface CopyRuleRow {
  user_id: string;
  whale_address: string;
  chain: string;
  mode: CopyMode | null;
  max_per_trade_usd: number | null;
  pct_of_whale: number | null;
  daily_cap_usd: number | null;
  chains_allowed: string[] | null;
  tokens_blacklist: string[] | null;
  tokens_allowlist: string[] | null;
  copy_direction: "both" | "buy" | "sell" | null;
  min_trade_size_usd: number | null;
  min_liquidity_usd: number | null;
  max_slippage_bps: number | null;
  cooldown_until: string | null;
  paused: boolean | null;
  enabled: boolean;
  wallet_address: string | null;
}

const USDC_BY_CHAIN: Record<string, string> = {
  ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  bsc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
  avalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  solana: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

// USDC decimals differ by chain — 6 on most EVM + Solana, but 18 for the
// Binance-Peg USDC on BSC. Used to convert a human USD buy size to raw units.
const USDC_DECIMALS: Record<string, number> = {
  ethereum: 6, base: 6, polygon: 6, arbitrum: 6, optimism: 6, solana: 6, bsc: 18,
};

export interface CopyMatchOutcome {
  considered: number;
  alerted: number;
  triggered: number;
  blocked: number;
  failed: number;
  reasons: string[];
}

export async function matchCopyEvent(event: CopyEvent): Promise<CopyMatchOutcome> {
  const out: CopyMatchOutcome = {
    considered: 0,
    alerted: 0,
    triggered: 0,
    blocked: 0,
    failed: 0,
    reasons: [],
  };
  if (!event.token_address) return out;

  const admin = getSupabaseAdmin();
  // §13 audit fix: chain-aware address normalization (handoff §6).
  // Solana addresses are base58 case-sensitive — `.ilike()` would let
  // an attacker register a whale rule for "AbCd…" and match a totally
  // different on-chain whale "abcd…". For Solana use exact .eq().
  const chainLower = event.chain.toLowerCase();
  const whaleKey = normalizeAddress(event.whale_address, event.chain);

  let rulesQuery = admin
    .from("user_copy_rules")
    .select(
      "user_id,whale_address,chain,mode,max_per_trade_usd,pct_of_whale," +
        "daily_cap_usd,chains_allowed,tokens_blacklist,tokens_allowlist," +
        "copy_direction,min_trade_size_usd,min_liquidity_usd," +
        "max_slippage_bps,cooldown_until,paused,enabled,wallet_address",
    )
    .eq("enabled", true);
  rulesQuery = isEvmChain(event.chain)
    ? rulesQuery.ilike("whale_address", whaleKey)
    : rulesQuery.eq("whale_address", whaleKey);
  const { data: rules } = await rulesQuery;

  const matches = (rules ?? []) as unknown as CopyRuleRow[];
  if (matches.length === 0) return out;

  const userIds = Array.from(new Set(matches.map((r) => r.user_id)));

  // Per-user spend today, for daily_cap enforcement.
  // §13 audit fix: 'alert' rows are intent signals only — the user
  // hasn't actually spent USDC yet. Counting them toward the daily
  // cap means 10 alerts can block real oneclick / auto_copy trades.
  const dayAgoIso = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: spendRows } = await admin
    .from("user_copy_trades")
    .select("user_id, amount_usd")
    .in("user_id", userIds)
    .gte("created_at", dayAgoIso)
    .in("status", ["pending", "success"]);
  const spentMap = new Map<string, number>();
  for (const s of (spendRows ?? []) as { user_id: string; amount_usd: number | null }[]) {
    spentMap.set(s.user_id, (spentMap.get(s.user_id) ?? 0) + Number(s.amount_usd ?? 0));
  }

  // Dedup: never fire twice for the same (user, source_tx).
  const { data: already } = await admin
    .from("user_copy_trades")
    .select("user_id")
    .in("user_id", userIds)
    .eq("source_tx_hash", event.tx_hash);
  const alreadyUsers = new Set(((already ?? []) as { user_id: string }[]).map((a) => a.user_id));

  const nowIso = new Date().toISOString();
  const isSell = event.action === "sell";

  for (const rule of matches) {
    out.considered++;

    if (rule.paused) {
      out.blocked++;
      continue;
    }
    if (rule.chain.toLowerCase() !== chainLower) {
      out.blocked++;
      continue;
    }
    if (rule.cooldown_until && rule.cooldown_until > nowIso) {
      out.blocked++;
      continue;
    }
    if (alreadyUsers.has(rule.user_id)) {
      out.blocked++;
      continue;
    }
    if (
      rule.chains_allowed &&
      rule.chains_allowed.length > 0 &&
      !rule.chains_allowed.map((c) => c.toLowerCase()).includes(chainLower)
    ) {
      out.blocked++;
      continue;
    }
    if (
      rule.tokens_blacklist &&
      event.token_address &&
      rule.tokens_blacklist.map((t) => normalizeAddress(t, event.chain)).includes(normalizeAddress(event.token_address, event.chain))
    ) {
      out.blocked++;
      continue;
    }
    // Allow-list: when set, ONLY these tokens may be copied. A 'swap' event is
    // treated as a buy below, so allow/block both apply to it.
    if (
      rule.tokens_allowlist &&
      rule.tokens_allowlist.length > 0 &&
      event.token_address &&
      !rule.tokens_allowlist.map((t) => normalizeAddress(t, event.chain)).includes(normalizeAddress(event.token_address, event.chain))
    ) {
      out.blocked++;
      continue;
    }
    // Direction filter: 'buy' copies only the whale's entries, 'sell' only exits.
    const dir = rule.copy_direction ?? "both";
    if ((dir === "buy" && isSell) || (dir === "sell" && !isSell)) {
      out.blocked++;
      continue;
    }
    // Min whale-trade size: ignore moves smaller than the follower cares about.
    // Only meaningful when the event carries a USD notional; unknown sizes pass.
    if (
      rule.min_trade_size_usd != null &&
      event.value_usd != null &&
      Number(event.value_usd) < Number(rule.min_trade_size_usd)
    ) {
      out.blocked++;
      continue;
    }

    const spentToday = spentMap.get(rule.user_id) ?? 0;
    const dailyRemaining = Math.max(0, Number(rule.daily_cap_usd ?? 0) - spentToday);

    // Sizing: pct_of_whale takes precedence (if both set), else max_per_trade_usd.
    let sizeUsd: number;
    if (rule.pct_of_whale != null && event.value_usd != null) {
      sizeUsd = (Number(event.value_usd) * Number(rule.pct_of_whale)) / 100;
    } else {
      sizeUsd = Number(rule.max_per_trade_usd ?? 0);
    }
    if (rule.max_per_trade_usd != null) {
      sizeUsd = Math.min(sizeUsd, Number(rule.max_per_trade_usd));
    }
    if (rule.daily_cap_usd != null) {
      sizeUsd = Math.min(sizeUsd, dailyRemaining);
    }

    // Buy direction needs USD budget; sell exits use position-size sizing.
    if (!isSell && sizeUsd <= 0) {
      out.blocked++;
      continue;
    }

    // Default mode for legacy rows pre-migration is 'oneclick' so behavior is
    // unchanged for users who had rules before §3 shipped.
    const mode: CopyMode = rule.mode ?? "oneclick";

    if (mode === "alerts_only") {
      const { error: insErr } = await admin.from("user_copy_trades").insert({
        user_id: rule.user_id,
        source_whale: event.whale_address,
        source_tx_hash: event.tx_hash,
        chain: event.chain,
        token_address: event.token_address,
        token_symbol: event.token_symbol,
        action: isSell ? "sell" : "buy",
        amount_usd: isSell ? null : sizeUsd,
        status: "alert",
      });
      if (insErr) {
        out.failed++;
        out.reasons.push(`alert insert failed: ${insErr.message}`);
        continue;
      }
      queueTelegramNotification({
        userId: rule.user_id,
        kind: "copy",
        title: `${isSell ? "Whale SELL" : "Whale BUY"}: ${event.token_symbol ?? "token"}`,
        body:
          `${event.whale_address.slice(0, 8)}… ${isSell ? "sold" : "bought"} ` +
          `${event.token_symbol ?? "a token"}` +
          (event.value_usd ? ` ($${Number(event.value_usd).toLocaleString()})` : "") +
          `\nSize you'd copy: $${sizeUsd.toFixed(2)}\nTap to confirm.`,
        url:
          `/dashboard/copy-trading?action=${isSell ? "sell" : "buy"}` +
          `&whale=${encodeURIComponent(event.whale_address)}` +
          `&token=${encodeURIComponent(event.token_address)}` +
          `&symbol=${encodeURIComponent(event.token_symbol ?? "")}` +
          `&chain=${encodeURIComponent(event.chain)}` +
          `&tx=${encodeURIComponent(event.tx_hash)}` +
          `&amount=${isSell ? "" : sizeUsd}`,
      });
      if (!isSell) spentMap.set(rule.user_id, spentToday + sizeUsd);
      out.alerted++;
      continue;
    }

    // oneclick / auto_copy: drive the existing relayer/pending-trades flow.
    const usdcAddr = USDC_BY_CHAIN[chainLower];
    if (!usdcAddr) {
      out.blocked++;
      continue;
    }
    const walletSource: "external_evm" | "external_solana" =
      chainLower === "solana" ? "external_solana" : "external_evm";

    let fromTokenAddress: string;
    let fromTokenSymbol: string | null;
    let toTokenAddress: string;
    let toTokenSymbol: string | null;
    let amountIn: string;     // indicative-route hint (human for buys)
    let amountInRaw: string;  // RAW base units of from-token (for the firm 0x quote)
    if (isSell) {
      const sizing = await sizeCopySell({
        userId: rule.user_id,
        chain: event.chain,
        tokenAddress: event.token_address,
      });
      if (!sizing) {
        out.blocked++;
        continue;
      }
      fromTokenAddress = event.token_address;
      fromTokenSymbol = event.token_symbol;
      toTokenAddress = usdcAddr;
      toTokenSymbol = "USDC";
      amountIn = sizing.amountInRaw;     // sizeCopySell already returns raw units
      amountInRaw = sizing.amountInRaw;
    } else {
      fromTokenAddress = usdcAddr;
      fromTokenSymbol = "USDC";
      toTokenAddress = event.token_address;
      toTokenSymbol = event.token_symbol;
      // Pin to 6 dp (USDC unit) — String(Number) can drop precision (10.50 -> "10.5"),
      // matching the fix already in /api/copy-trading/execute.
      amountIn = Number(sizeUsd).toFixed(6);
      // Raw base units (USDC is 6dp on most chains, 18 on BSC) for the firm quote.
      amountInRaw = parseUnits(amountIn, USDC_DECIMALS[chainLower] ?? 6).toString();
    }

    // #13: atomic per-user cap claim instead of a bare insert + the racy
    // app-level cap reduce(). Null = the buy would breach daily_cap_usd.
    const { data: claimedId, error: claimErr } = await admin.rpc("claim_copy_trade", {
      p_user: rule.user_id,
      p_daily_cap: rule.daily_cap_usd ?? null,
      p_amount: isSell ? null : sizeUsd,
      p_source_whale: event.whale_address,
      p_source_tx: event.tx_hash,
      p_chain: event.chain,
      p_token_address: event.token_address,
      p_token_symbol: event.token_symbol,
      p_action: isSell ? "sell" : "buy",
      p_security_score: null,
    });
    if (!claimedId) {
      // NULL = cap breach or duplicate (fail-closed). A non-null error here is a
      // genuine RPC failure (e.g. lock timeout) — surface it instead of silently
      // counting it as a normal block, so transient DB issues are observable.
      if (claimErr) {
        out.reasons.push(`claim_copy_trade error: ${claimErr.message}`);
        Sentry.captureMessage(`claim_copy_trade failed: ${claimErr.message}`, {
          tags: { user_id: rule.user_id, whale: event.whale_address },
        });
      }
      out.blocked++;
      continue;
    }
    const inserted = { id: claimedId as string };

    const result = await executeTrade({
      userId: rule.user_id,
      chain: event.chain,
      walletSource,
      fromTokenAddress,
      fromTokenSymbol,
      toTokenAddress,
      toTokenSymbol,
      amountIn,
      slippageBps: rule.max_slippage_bps ?? 200,
      reason: "copy_trade",
      sourceOrderId: (inserted as { id: string } | null)?.id ?? null,
      sourceOrderTable: "user_copy_trades",
      // auto_copy → eligible for 24/7 session-key execution (gated by the signer
      // flag + a funded session key; falls back to pending otherwise).
      autoConfirm: rule.mode === "auto_copy",
      sourceTxHash: event.tx_hash,
      tradeUsd: isSell ? null : sizeUsd,
      amountInRaw,
    });

    if (result.success && result.broadcastTxHash && !result.awaitingUserConfirmation) {
      // Headless session-key auto-execution already broadcast on-chain — mark
      // the claimed copy-trade row success (not stuck pending), record the hash,
      // and account the spend so sibling rules in this batch see it.
      if (inserted) {
        await admin
          .from("user_copy_trades")
          .update({ status: "success", copied_tx_hash: result.broadcastTxHash })
          .eq("id", (inserted as { id: string }).id);
      }
      if (!isSell) spentMap.set(rule.user_id, spentToday + sizeUsd);
      out.triggered++;
    } else if (result.awaitingUserConfirmation) {
      if (!isSell) spentMap.set(rule.user_id, spentToday + sizeUsd);
      out.triggered++;
    } else if (result.securityBlocked) {
      if (inserted) {
        await admin
          .from("user_copy_trades")
          .update({ status: "failed", failure_reason: result.failureReason })
          .eq("id", (inserted as { id: string }).id);
      }
      out.failed++;
      out.blocked++;
    } else {
      // Generic failure (no route, relayer/insert error). Previously this
      // only bumped a counter and Sentry, leaving the claimed row 'pending'
      // forever — pending-trades-cleanup never resolves it. Mark it failed so
      // the row reflects reality and can be retried/surfaced.
      if (inserted) {
        await admin
          .from("user_copy_trades")
          .update({ status: "failed", failure_reason: result.failureReason ?? "execution_failed" })
          .eq("id", (inserted as { id: string }).id);
      }
      out.failed++;
      Sentry.captureMessage(`copy-trade failed: ${result.failureReason ?? "unknown"}`, {
        tags: { user_id: rule.user_id, whale: event.whale_address },
      });
    }
  }

  return out;
}
