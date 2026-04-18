import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, cronResponse } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getDexPrice } from "@/lib/services/dexscreener";
import { executeTrade } from "@/lib/trading/relayer";

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

    const result = await executeTrade({
      userId: bot.user_id,
      chain: bot.chain,
      walletSource: bot.wallet_source,
      fromTokenAddress: bot.from_token_address,
      fromTokenSymbol: bot.from_token_symbol,
      toTokenAddress: bot.to_token_address,
      toTokenSymbol: bot.to_token_symbol,
      amountIn: String(bot.amount_per_execution),
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
