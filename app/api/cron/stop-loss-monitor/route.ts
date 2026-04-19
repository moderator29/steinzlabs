import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, cronResponse, cronHasWork } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getDexPrice } from "@/lib/services/dexscreener";
import { executeTrade } from "@/lib/trading/relayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type TriggerKind = "stop_loss" | "take_profit" | "trail_stop";

interface StopLossRow {
  id: string;
  user_id: string;
  chain: string;
  token_address: string;
  token_symbol: string | null;
  position_amount: string;
  entry_price_usd: number | null;
  stop_loss_price_usd: number | null;
  take_profit_price_usd: number | null;
  trailing_stop_percent: number | null;
  highest_price_seen: number | null;
  exit_to_token_address: string;
  exit_to_token_symbol: string | null;
  slippage_bps: number;
  wallet_source: "external_evm" | "external_solana" | "builtin";
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  if (!(await cronHasWork("stop_loss_orders", { column: "status", value: "active" }))) {
    return cronResponse("stop-loss-monitor", startedAt, { skipped: "no-active-orders" });
  }

  const admin = getSupabaseAdmin();
  let triggered = 0;
  let skipped = 0;
  let failed = 0;

  const { data: orders, error } = await admin
    .from("stop_loss_orders")
    .select(
      "id,user_id,chain,token_address,token_symbol,position_amount,entry_price_usd,stop_loss_price_usd,take_profit_price_usd,trailing_stop_percent,highest_price_seen,exit_to_token_address,exit_to_token_symbol,slippage_bps,wallet_source",
    )
    .eq("status", "active")
    .limit(500)
    .returns<StopLossRow[]>();

  if (error) {
    Sentry.captureException(error, { tags: { cron: "stop-loss-monitor" } });
    return cronResponse("stop-loss-monitor", startedAt, { error: error.message });
  }

  const rows = orders ?? [];
  const priceCache = new Map<string, number | null>();
  await Promise.all(
    Array.from(new Set(rows.map((r) => r.token_address.toLowerCase()))).map(async (addr) => {
      try {
        const p = await getDexPrice(addr);
        priceCache.set(addr, p > 0 ? p : null);
      } catch {
        priceCache.set(addr, null);
      }
    }),
  );

  for (const order of rows) {
    const currentPrice = priceCache.get(order.token_address.toLowerCase()) ?? null;
    if (currentPrice == null) {
      skipped++;
      continue;
    }

    let triggerKind: TriggerKind | null = null;

    // Update trailing-stop high-water mark first.
    if (order.trailing_stop_percent != null) {
      const highest = order.highest_price_seen ?? order.entry_price_usd ?? currentPrice;
      if (currentPrice > (highest ?? 0)) {
        await admin
          .from("stop_loss_orders")
          .update({ highest_price_seen: currentPrice, updated_at: new Date().toISOString() })
          .eq("id", order.id);
      } else if (highest && highest > 0) {
        const drawdownPct = ((highest - currentPrice) / highest) * 100;
        if (drawdownPct >= Number(order.trailing_stop_percent)) {
          triggerKind = "trail_stop";
        }
      }
    }

    if (
      !triggerKind &&
      order.stop_loss_price_usd != null &&
      currentPrice <= Number(order.stop_loss_price_usd)
    ) {
      triggerKind = "stop_loss";
    }

    if (
      !triggerKind &&
      order.take_profit_price_usd != null &&
      currentPrice >= Number(order.take_profit_price_usd)
    ) {
      triggerKind = "take_profit";
    }

    if (!triggerKind) {
      skipped++;
      continue;
    }

    const realizedPnl =
      order.entry_price_usd != null
        ? (currentPrice - Number(order.entry_price_usd)) * Number(order.position_amount)
        : null;

    const result = await executeTrade({
      userId: order.user_id,
      chain: order.chain,
      walletSource: order.wallet_source,
      fromTokenAddress: order.token_address,
      fromTokenSymbol: order.token_symbol,
      toTokenAddress: order.exit_to_token_address,
      toTokenSymbol: order.exit_to_token_symbol,
      amountIn: String(order.position_amount),
      slippageBps: order.slippage_bps ?? 100,
      reason: triggerKind,
      sourceOrderId: order.id,
      sourceOrderTable: "stop_loss_orders",
      expectedPriceUsd: currentPrice,
    });

    if (result.awaitingUserConfirmation) {
      // Intermediate state: re-trigger guard + preserves provisional price/pnl
      // for UI, but confirm/route.ts is the path that promotes to the real
      // triggered_* status. Reject/cleanup restores to 'active'.
      await admin
        .from("stop_loss_orders")
        .update({
          status: "pending_confirmation",
          pending_trade_id: result.pendingTradeId ?? null,
          triggered_price: currentPrice,
          realized_pnl_usd: realizedPnl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);
      triggered++;
    } else if (result.securityBlocked) {
      await admin
        .from("stop_loss_orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", order.id);
      failed++;
    } else {
      failed++;
      Sentry.captureMessage(`stop-loss trigger failed: ${result.failureReason}`, {
        tags: { order_id: order.id, kind: triggerKind },
      });
    }
  }

  return cronResponse("stop-loss-monitor", startedAt, {
    considered: rows.length,
    triggered,
    skipped,
    failed,
  });
}
