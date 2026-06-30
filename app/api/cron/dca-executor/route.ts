import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, cronResponse } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getDexPrice } from "@/lib/services/dexscreener";
import { executeTrade } from "@/lib/trading/relayer";
import { usdcForChain, usdToUsdcBaseUnits } from "@/lib/trading/usdc";
import { getTokenDecimalsForSizing } from "@/lib/sniper/priceFeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface DcaBotRow {
  id: string;
  user_id: string;
  chain: string;
  from_token_address: string;
  from_token_symbol: string | null;
  to_token_address: string;
  to_token_symbol: string | null;
  amount_per_execution: string;
  interval_seconds: number;
  total_executions: number | null;
  executions_completed: number;
  slippage_bps: number;
  max_price_usd: number | null;
  min_price_usd: number | null;
  wallet_source: "external_evm" | "external_solana" | "builtin";
  next_execution_at: string;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  let scheduled = 0;
  let priceGated = 0;
  let triggered = 0;
  let failed = 0;

  const { data: bots, error } = await admin
    .from("dca_bots")
    .select(
      "id,user_id,chain,from_token_address,from_token_symbol,to_token_address,to_token_symbol,amount_per_execution,interval_seconds,total_executions,executions_completed,slippage_bps,max_price_usd,min_price_usd,wallet_source,next_execution_at",
    )
    .eq("status", "active")
    .lte("next_execution_at", nowIso)
    .limit(200)
    .returns<DcaBotRow[]>();

  if (error) {
    Sentry.captureException(error, { tags: { cron: "dca-executor" } });
    return cronResponse("dca-executor", startedAt, { error: error.message });
  }

  const rows = bots ?? [];
  scheduled = rows.length;

  for (const bot of rows) {
    let currentPrice: number | null = null;
    try {
      const p = await getDexPrice(bot.to_token_address);
      currentPrice = p > 0 ? p : null;
    } catch {
      currentPrice = null;
    }

    // Price-guard check.
    if (currentPrice != null) {
      if (bot.max_price_usd != null && currentPrice > Number(bot.max_price_usd)) {
        // Skip but schedule next interval so we don't replay this slot endlessly.
        const next = new Date(Date.now() + bot.interval_seconds * 1000).toISOString();
        await admin
          .from("dca_bots")
          .update({ next_execution_at: next, updated_at: new Date().toISOString() })
          .eq("id", bot.id);
        await admin.from("dca_executions").insert({
          bot_id: bot.id,
          execution_number: bot.executions_completed + 1,
          amount_in: bot.amount_per_execution,
          price_at_execution: currentPrice,
          status: "skipped",
          failure_reason: `price ${currentPrice} > max ${bot.max_price_usd}`,
        });
        priceGated++;
        continue;
      }
      if (bot.min_price_usd != null && currentPrice < Number(bot.min_price_usd)) {
        const next = new Date(Date.now() + bot.interval_seconds * 1000).toISOString();
        await admin
          .from("dca_bots")
          .update({ next_execution_at: next, updated_at: new Date().toISOString() })
          .eq("id", bot.id);
        await admin.from("dca_executions").insert({
          bot_id: bot.id,
          execution_number: bot.executions_completed + 1,
          amount_in: bot.amount_per_execution,
          price_at_execution: currentPrice,
          status: "skipped",
          failure_reason: `price ${currentPrice} < min ${bot.min_price_usd}`,
        });
        priceGated++;
        continue;
      }
    }

    // Resolve a real from-token contract (older rows stored the literal "USDC"
    // symbol, which aggregators reject) and scale the human amount to base units.
    const dcaFromAddr = /^0x[a-fA-F0-9]{40}$/.test(bot.from_token_address)
      ? bot.from_token_address
      : (usdcForChain(bot.chain) ?? bot.from_token_address);
    // Size the spend leg into base units. When spending USDC use the
    // DETERMINISTIC per-chain helper (no RPC, correct 6/18dp) — critical because
    // the spend amount is the order notional: an RPC blip defaulting decimals to
    // 18 on a 6-dp USDC chain would scale a $50 buy into $50,000,000,000,000.
    // For a non-USDC from-token, resolve real decimals and SKIP on failure
    // rather than guessing 18.
    let dcaAmountInBase: string;
    if (dcaFromAddr === usdcForChain(bot.chain)) {
      dcaAmountInBase = usdToUsdcBaseUnits(Number(bot.amount_per_execution), bot.chain);
    } else {
      const dec = await getTokenDecimalsForSizing(bot.chain, dcaFromAddr);
      if (dec == null) {
        Sentry.captureMessage(`dca-executor: from-token decimals unavailable for ${bot.chain}:${dcaFromAddr} — skipping bot ${bot.id} this tick`);
        continue;
      }
      dcaAmountInBase = (BigInt(Math.round(Number(bot.amount_per_execution) * 1e6)) * (BigInt(10) ** BigInt(dec)) / BigInt(1e6)).toString();
    }

    const result = await executeTrade({
      userId: bot.user_id,
      chain: bot.chain,
      walletSource: bot.wallet_source,
      fromTokenAddress: dcaFromAddr,
      fromTokenSymbol: bot.from_token_symbol,
      toTokenAddress: bot.to_token_address,
      toTokenSymbol: bot.to_token_symbol,
      amountIn: dcaAmountInBase,
      slippageBps: bot.slippage_bps ?? 100,
      reason: "dca",
      sourceOrderId: bot.id,
      sourceOrderTable: "dca_bots",
      expectedPriceUsd: currentPrice,
    });

    const nextRunIso = new Date(Date.now() + bot.interval_seconds * 1000).toISOString();

    if (result.awaitingUserConfirmation) {
      // Advance schedule; the pending-trade confirm path will insert the
      // authoritative dca_executions row and update aggregates.
      await admin
        .from("dca_bots")
        .update({
          next_execution_at: nextRunIso,
          last_execution_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bot.id);
      triggered++;
    } else if (result.securityBlocked) {
      await admin
        .from("dca_bots")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", bot.id);
      await admin.from("dca_executions").insert({
        bot_id: bot.id,
        execution_number: bot.executions_completed + 1,
        amount_in: bot.amount_per_execution,
        price_at_execution: currentPrice,
        status: "failed",
        failure_reason: result.failureReason ?? "security_blocked",
      });
      failed++;
    } else {
      failed++;
      // Do not advance schedule on infra failure so next run retries.
      Sentry.captureMessage(`dca execution failed: ${result.failureReason}`, {
        tags: { bot_id: bot.id },
      });
    }
  }

  return cronResponse("dca-executor", startedAt, {
    scheduled,
    triggered,
    priceGated,
    failed,
  });
}
