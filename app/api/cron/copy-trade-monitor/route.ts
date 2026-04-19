import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, cronResponse, cronHasWork } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { executeTrade } from "@/lib/trading/relayer";
import { sizeCopySell } from "@/lib/trading/copyTradeSell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface FollowRow {
  user_id: string;
  whale_address: string;
  chain: string;
}

interface CopyRuleRow {
  user_id: string;
  whale_address: string;
  chain: string;
  max_per_trade_usd: number;
  daily_cap_usd: number;
  chains_allowed: string[] | null;
  tokens_blacklist: string[] | null;
  min_liquidity_usd: number | null;
  max_slippage_bps: number | null;
  enabled: boolean;
}

interface WhaleActivityRow {
  id: string;
  whale_address: string;
  chain: string;
  tx_hash: string;
  action: string;
  token_address: string | null;
  token_symbol: string | null;
  value_usd: number | null;
  timestamp: string;
}

const LOOKBACK_SECONDS = 180; // 3 minutes

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  if (!(await cronHasWork("copy_trade_rules", { column: "enabled", value: true }))) {
    return cronResponse("copy-trade-monitor", startedAt, { skipped: "no-active-copy-rules" });
  }

  const admin = getSupabaseAdmin();
  let considered = 0;
  let triggered = 0;
  let ruleBlocked = 0;
  let failed = 0;

  const sinceIso = new Date(Date.now() - LOOKBACK_SECONDS * 1000).toISOString();

  // 1) Fetch oneclick follows and their matching copy rules.
  const { data: follows } = await admin
    .from("user_whale_follows")
    .select("user_id,whale_address,chain")
    .eq("copy_mode", "oneclick")
    .returns<FollowRow[]>();

  const followRows = follows ?? [];
  if (followRows.length === 0) {
    return cronResponse("copy-trade-monitor", startedAt, { considered: 0, triggered: 0 });
  }

  const whaleKeys = Array.from(
    new Set(followRows.map((f) => `${f.chain}:${f.whale_address.toLowerCase()}`)),
  );

  // 2) Fetch recent buy/sell activity for those whales.
  const whaleAddrs = Array.from(new Set(followRows.map((f) => f.whale_address)));
  const { data: activity } = await admin
    .from("whale_activity")
    .select("id,whale_address,chain,tx_hash,action,token_address,token_symbol,value_usd,timestamp")
    .in("whale_address", whaleAddrs)
    .in("action", ["buy", "sell", "swap"])
    .gte("timestamp", sinceIso)
    .order("timestamp", { ascending: false })
    .limit(500)
    .returns<WhaleActivityRow[]>();

  const acts = activity ?? [];
  if (acts.length === 0) {
    return cronResponse("copy-trade-monitor", startedAt, { considered: 0, triggered: 0 });
  }

  // 3) Fetch copy rules for all (user, whale, chain) triples.
  const { data: rules } = await admin
    .from("user_copy_rules")
    .select(
      "user_id,whale_address,chain,max_per_trade_usd,daily_cap_usd,chains_allowed,tokens_blacklist,min_liquidity_usd,max_slippage_bps,enabled",
    )
    .eq("enabled", true)
    .returns<CopyRuleRow[]>();

  const ruleMap = new Map<string, CopyRuleRow>();
  for (const r of rules ?? []) {
    ruleMap.set(`${r.user_id}:${r.chain}:${r.whale_address.toLowerCase()}`, r);
  }

  // 4) Pre-compute today's per-user spend (for daily_cap_usd).
  const todayIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const userIds = Array.from(new Set(followRows.map((f) => f.user_id)));
  const { data: spendRows } = await admin
    .from("user_copy_trades")
    .select("user_id, amount_usd")
    .in("user_id", userIds)
    .gte("created_at", todayIso)
    .in("status", ["pending", "success"]);
  const spentMap = new Map<string, number>();
  for (const s of (spendRows ?? []) as { user_id: string; amount_usd: number | null }[]) {
    spentMap.set(s.user_id, (spentMap.get(s.user_id) ?? 0) + Number(s.amount_usd ?? 0));
  }

  // 5) Guard against reprocessing the same whale-tx for the same user.
  const txHashes = Array.from(new Set(acts.map((a) => a.tx_hash)));
  const { data: already } = await admin
    .from("user_copy_trades")
    .select("user_id, source_tx_hash")
    .in("source_tx_hash", txHashes);
  const alreadyKey = new Set<string>(
    (already ?? []).map(
      (a) => `${(a as { user_id: string }).user_id}:${(a as { source_tx_hash: string }).source_tx_hash}`,
    ),
  );

  // 6) Fan out: for each activity × follower, evaluate rules and trigger.
  for (const act of acts) {
    const whaleKey = `${act.chain}:${act.whale_address.toLowerCase()}`;
    if (!whaleKeys.includes(whaleKey)) continue;
    if (!act.token_address) continue;

    const followersForThisWhale = followRows.filter(
      (f) => f.chain === act.chain && f.whale_address.toLowerCase() === act.whale_address.toLowerCase(),
    );

    for (const follower of followersForThisWhale) {
      considered++;
      const dedupeKey = `${follower.user_id}:${act.tx_hash}`;
      if (alreadyKey.has(dedupeKey)) continue;

      const rule = ruleMap.get(`${follower.user_id}:${act.chain}:${act.whale_address.toLowerCase()}`);
      if (!rule) {
        ruleBlocked++;
        continue;
      }
      if (rule.chains_allowed && rule.chains_allowed.length > 0 && !rule.chains_allowed.includes(act.chain)) {
        ruleBlocked++;
        continue;
      }
      if (rule.tokens_blacklist && rule.tokens_blacklist.map((t) => t.toLowerCase()).includes(act.token_address.toLowerCase())) {
        ruleBlocked++;
        continue;
      }
      const spentToday = spentMap.get(follower.user_id) ?? 0;
      const sizeUsd = Math.min(
        Number(rule.max_per_trade_usd),
        Math.max(0, Number(rule.daily_cap_usd) - spentToday),
      );
      // Daily-cap gate only applies to buys (sell exits are independent of
      // the user's USD buy budget).
      if (act.action !== "sell" && sizeUsd <= 0) {
        ruleBlocked++;
        continue;
      }

      // We need wallet_source from user's preference. Default external_evm for
      // EVM chains and external_solana for solana — users on builtin can set
      // explicitly via user_trading_preferences.
      const walletSource: "external_evm" | "external_solana" =
        act.chain.toLowerCase() === "solana" ? "external_solana" : "external_evm";

      // Quote stablecoin input for the copy (USDC). We use USDC on each chain
      // as the funding source for copy trades unless rule specifies otherwise.
      const usdcAddr = usdcForChain(act.chain);
      if (!usdcAddr) {
        ruleBlocked++;
        continue;
      }

      // Direction branch: buy copies the whale; sell exits the user's
      // position entirely (v1 policy: full exit on whale sell). Sell path
      // skips when user doesn't hold the token or has no wallet on chain.
      const isSell = act.action === "sell";
      let fromTokenAddress: string;
      let fromTokenSymbol: string | null;
      let toTokenAddress: string;
      let toTokenSymbol: string | null;
      let amountIn: string;

      if (isSell) {
        const sizing = await sizeCopySell({
          userId: follower.user_id,
          chain: act.chain,
          tokenAddress: act.token_address,
        });
        if (!sizing) {
          ruleBlocked++;
          continue;
        }
        fromTokenAddress = act.token_address;
        fromTokenSymbol = act.token_symbol;
        toTokenAddress = usdcAddr;
        toTokenSymbol = "USDC";
        amountIn = sizing.amountInRaw;
      } else {
        fromTokenAddress = usdcAddr;
        fromTokenSymbol = "USDC";
        toTokenAddress = act.token_address;
        toTokenSymbol = act.token_symbol;
        amountIn = String(sizeUsd);
      }

      const { data: inserted } = await admin
        .from("user_copy_trades")
        .insert({
          user_id: follower.user_id,
          source_whale: act.whale_address,
          source_tx_hash: act.tx_hash,
          token_address: act.token_address,
          token_symbol: act.token_symbol,
          action: isSell ? "sell" : "buy",
          amount_usd: isSell ? null : sizeUsd,
          status: "pending",
        })
        .select("id")
        .single();

      const result = await executeTrade({
        userId: follower.user_id,
        chain: act.chain,
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
      });

      if (result.awaitingUserConfirmation) {
        if (!isSell) {
          spentMap.set(follower.user_id, spentToday + sizeUsd);
        }
        triggered++;
      } else if (result.securityBlocked) {
        if (inserted) {
          await admin
            .from("user_copy_trades")
            .update({ status: "failed", failure_reason: result.failureReason })
            .eq("id", (inserted as { id: string }).id);
        }
        failed++;
      } else {
        failed++;
        Sentry.captureMessage(`copy-trade failed: ${result.failureReason}`, {
          tags: { user_id: follower.user_id, whale: act.whale_address },
        });
      }
    }
  }

  return cronResponse("copy-trade-monitor", startedAt, {
    considered,
    triggered,
    ruleBlocked,
    failed,
  });
}

function usdcForChain(chain: string): string | null {
  const c = chain.toLowerCase();
  switch (c) {
    case "ethereum":
    case "eth":
      return "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
    case "base":
      return "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    case "polygon":
    case "matic":
      return "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
    case "arbitrum":
    case "arb":
      return "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    case "optimism":
    case "op":
      return "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";
    case "bsc":
    case "bnb":
      return "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
    case "solana":
    case "sol":
      return "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    default:
      return null;
  }
}
