/**
 * Phase 5: sniper auto-sell engine.
 *
 * Walks all open sniper positions (sniper_executions where status='confirmed'
 * and realized_at IS NULL), fetches the current USD price for each token,
 * evaluates take-profit / stop-loss / trailing-stop against the criteria's
 * config, and dispatches a sell when triggered.
 *
 * Non-custodial: dispatch = insert pending_trades(source='sniper-autosell').
 * The existing pending-trade pipeline takes the user's browser-side signature
 * before broadcasting; this cron never signs.
 *
 * Cadence: 1 minute. Conditional early-exit when zero positions are open
 * keeps the cron cost ~zero on idle accounts.
 */

import { NextRequest } from "next/server";
import { verifyCron, cronResponse, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTokenPriceUsd, getEvmTokenDecimals } from "@/lib/sniper/priceFeed";
import { usdcForChain, usdcBaseUnitsToUsd } from "@/lib/trading/usdc";
import { evaluatePosition } from "@/lib/sniper/autosell";
import { tryExecuteSellViaSessionKey } from "@/lib/trading/sessionKeyExecutor";
import type { SniperChain } from "@/lib/sniper/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface OpenPosition {
  id: string;
  user_id: string;
  criteria_id: string | null;
  chain: string | null;
  token_address: string;
  token_symbol: string | null;
  amount_native: number | null;
  tokens_received: number | null;
  entry_price_usd: number | null;
  peak_price_usd: number | null;
  pnl_usd: number | null;
  wallet_address: string | null;
  sell_pending_trade_id: string | null;
}

interface CriteriaTpsl {
  id: string;
  user_id: string;
  take_profit_pct: number | null;
  stop_loss_pct: number | null;
  trailing_stop_pct: number | null;
  max_slippage_bps: number | null;
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const url = request.nextUrl;
  const dryRun = url.searchParams.get("dryRun") === "1";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);

  const supabase = getSupabaseAdmin();

  const { count } = await supabase
    .from("sniper_executions")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .is("realized_at", null)
    .is("sell_pending_trade_id", null);

  if (!count) {
    return cronResponse("sniper-autosell", startedAt, { open: 0, noWork: true });
  }

  // Audit #47 C1: serialize ticks so two overlapping invocations can't both
  // pass a position's realized_at guard and double-sell. Atomic DB lock; if
  // another tick holds it, exit. TTL matches maxDuration as a crash backstop.
  const { data: lockOk } = await supabase.rpc("try_acquire_cron_lock", {
    p_name: "sniper-autosell",
    p_ttl_seconds: 280,
  });
  if (!lockOk) {
    return cronResponse("sniper-autosell", startedAt, { open: count, skipped: "another tick is running" });
  }
  try {

  const { data: positions, error } = await supabase
    .from("sniper_executions")
    .select(
      "id,user_id,criteria_id,chain,token_address,token_symbol,amount_native," +
        "tokens_received,entry_price_usd,peak_price_usd,pnl_usd,wallet_address,sell_pending_trade_id",
    )
    .eq("status", "confirmed")
    .is("realized_at", null)
    .is("sell_pending_trade_id", null)
    .not("entry_price_usd", "is", null)
    .order("executed_at", { ascending: true })
    .limit(limit);

  if (error) {
    await logCronExecution("sniper-autosell", "failed", Date.now() - startedAt, error.message);
    return cronResponse("sniper-autosell", startedAt, { error: error.message });
  }

  if (!positions || positions.length === 0) {
    return cronResponse("sniper-autosell", startedAt, { open: 0, eligible: 0 });
  }

  const open = positions as unknown as OpenPosition[];
  const criteriaIds = Array.from(
    new Set(open.map((p) => p.criteria_id).filter((id): id is string => !!id)),
  );
  const { data: criteriaRows } = await supabase
    .from("sniper_criteria")
    .select("id,user_id,take_profit_pct,stop_loss_pct,trailing_stop_pct,max_slippage_bps")
    .in("id", criteriaIds);
  const criteriaMap = new Map(
    ((criteriaRows ?? []) as unknown as CriteriaTpsl[]).map((c) => [c.id, c]),
  );

  const summary: Array<{
    id: string;
    action: "hold" | "sell" | "skip";
    reason?: string;
    pnlPct?: number;
    pendingTradeId?: string;
  }> = [];

  for (const pos of open) {
    if (!pos.chain || !pos.criteria_id) {
      summary.push({ id: pos.id, action: "skip", reason: "no chain/criteria" });
      continue;
    }
    const c = criteriaMap.get(pos.criteria_id);
    if (!c) {
      summary.push({ id: pos.id, action: "skip", reason: "criteria not found" });
      continue;
    }
    if (
      c.take_profit_pct == null &&
      c.stop_loss_pct == null &&
      c.trailing_stop_pct == null
    ) {
      summary.push({ id: pos.id, action: "skip", reason: "no TP/SL/trailing configured" });
      continue;
    }

    // TON has no live USD price feed wired (Ston.fi / DeDust integration is
    // pending). Calling priceFeed for TON always returns null, which used to
    // surface as a generic "no live price" skip and looked like an outage.
    // Short-circuit explicitly so the log makes the unsupported-chain reason
    // clear and we don't waste the RPC round trip.
    if (pos.chain === "ton") {
      summary.push({
        id: pos.id,
        action: "skip",
        reason: "ton price feed unsupported — autosell cannot unwind TON positions",
      });
      continue;
    }

    // Resolve real on-chain decimals once — needed for both correct pricing
    // and base-unit sell sizing (the sell amount_in must be wei, not whole
    // tokens, or the swap sells ~nothing yet marks the position realized).
    const decimals = await getEvmTokenDecimals(pos.chain as string, pos.token_address);
    const currentPriceUsd = await getCurrentTokenPriceUsd(
      pos.chain as SniperChain,
      pos.token_address,
      decimals,
    );
    if (currentPriceUsd == null || !pos.entry_price_usd) {
      summary.push({ id: pos.id, action: "skip", reason: "no live price" });
      continue;
    }

    const decision = evaluatePosition({
      entryPriceUsd: pos.entry_price_usd,
      currentPriceUsd,
      peakPriceUsd: pos.peak_price_usd,
      takeProfitPct: c.take_profit_pct,
      stopLossPct: c.stop_loss_pct,
      trailingStopPct: c.trailing_stop_pct,
    });

    if (decision.newPeakUsd != null) {
      await supabase
        .from("sniper_executions")
        .update({ peak_price_usd: decision.newPeakUsd })
        .eq("id", pos.id);
    }

    if (decision.action === "hold") {
      summary.push({ id: pos.id, action: "hold", pnlPct: decision.pnlPct });
      continue;
    }

    // SELL path. Insert a pending_trades row routing token → USDC; the
    // existing pipeline (security gate, route, user confirm) finishes it.
    if (dryRun) {
      summary.push({
        id: pos.id,
        action: "sell",
        reason: `${decision.reason} (dryRun)`,
        pnlPct: decision.pnlPct,
      });
      continue;
    }

    if (!pos.wallet_address) {
      summary.push({ id: pos.id, action: "skip", reason: "no wallet on execution row" });
      continue;
    }
    if (!pos.tokens_received || pos.tokens_received <= 0) {
      summary.push({ id: pos.id, action: "skip", reason: "tokens_received unknown" });
      continue;
    }
    // Resolve the real USDC contract for the chain — "USDC" the literal string
    // is not an address and would break the relayer/GoPlus downstream.
    const usdcAddress = usdcForChain(pos.chain);
    if (!usdcAddress) {
      summary.push({ id: pos.id, action: "skip", reason: `no USDC address for chain ${pos.chain}` });
      continue;
    }

    // tokens_received is a WHOLE-token count; the aggregator expects base
    // units. Scale by 10**decimals (BigInt to avoid float drift on big mc).
    const tokenAmountBaseUnits = (
      BigInt(Math.round((pos.tokens_received ?? 0) * 1e6)) *
      (BigInt(10) ** BigInt(decimals)) /
      BigInt(1e6)
    ).toString();

    // AA fast-path (#45): if the user has an active, owner-approved session key
    // on this chain, unwind the position right here as a background userOp
    // (token → USDC) — no browser, no pending-trade round trip. On any miss
    // (AA dormant, no session, over caps, quote failure) this returns null and
    // we fall through to staging a one-tap pending sell below.
    try {
      const aa = await tryExecuteSellViaSessionKey({
        userId: pos.user_id,
        chain: pos.chain,
        tokenAddress: pos.token_address,
        tokenAmountBaseUnits,
        slippageBps: c.max_slippage_bps ?? 200,
      });
      if (aa?.txHash) {
        // The M3 balance cap can sell LESS than requested (stale/inflated
        // tokens_received, or a partially-drained kernel). Use the ACTUAL sold
        // amount, not tokens_received, for PnL — and only fully close the position
        // when essentially all of it sold; otherwise decrement the remainder and
        // leave it open so the next tick can finish unwinding it.
        const soldBase = aa.sellAmountBaseUnits ? BigInt(aa.sellAmountBaseUnits) : BigInt(tokenAmountBaseUnits);
        const reqBase = BigInt(tokenAmountBaseUnits);
        const tokensSold = Number(soldBase) / 10 ** decimals;
        const proceedsUsd = aa.buyAmountBaseUnits ? usdcBaseUnitsToUsd(aa.buyAmountBaseUnits, pos.chain) : null;
        const realizedPnlUsd =
          proceedsUsd != null && pos.entry_price_usd != null
            ? proceedsUsd - pos.entry_price_usd * tokensSold
            : pos.entry_price_usd != null
              ? (currentPriceUsd - pos.entry_price_usd) * tokensSold
              : null;
        // Fully sold if not capped down (allow tiny rounding slack).
        const fullySold = soldBase * BigInt(1000) >= reqBase * BigInt(999);
        const remainingTokens = Math.max(0, (pos.tokens_received ?? 0) - tokensSold);
        await supabase
          .from("sniper_executions")
          .update({
            sell_tx_hash: aa.txHash,
            sell_dispatched_at: new Date().toISOString(),
            ...(fullySold ? { realized_at: new Date().toISOString() } : { tokens_received: remainingTokens }),
            // Accumulate — a partial sell already recorded a chunk; don't overwrite
            // it and lose the earlier chunk's realized PnL (it feeds reputation/stats).
            ...(realizedPnlUsd != null ? { pnl_usd: (pos.pnl_usd ?? 0) + realizedPnlUsd } : {}),
          })
          .eq("id", pos.id)
          .is("realized_at", null);

        summary.push({
          id: pos.id,
          action: "sell",
          reason: `${decision.reason ?? "trigger"} (AA session key${fullySold ? "" : ", partial"})`,
          pnlPct: decision.pnlPct,
        });
        continue;
      }
    } catch {
      // Fall back to pending-trade staging on any AA execution error.
    }

    // Schema fix: pending_trades has from_token_address / to_token_address /
    // source_reason / source_order_id / source_order_table, NOT the older
    // token_in / token_out / source / source_id pair this route used to
    // assume. Insert would 500 every tick on the wrong column names —
    // autosell looked wired but never actually queued anything. Status uses
    // "pending" so the prepare + confirm route gates pick it up.
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const { data: pending, error: insErr } = await supabase
      .from("pending_trades")
      .insert({
        user_id: pos.user_id,
        chain: pos.chain,
        wallet_source: "builtin",
        from_token_address: pos.token_address,
        from_token_symbol: pos.token_symbol,
        to_token_address: usdcAddress,
        to_token_symbol: "USDC",
        amount_in: tokenAmountBaseUnits,
        slippage_bps: c.max_slippage_bps ?? 200,
        source_reason: "sniper_autosell",
        source_order_id: pos.id,
        source_order_table: "sniper_executions",
        status: "pending",
        route_data: {},
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (insErr || !pending) {
      summary.push({
        id: pos.id,
        action: "skip",
        reason: `pending_trades insert failed: ${insErr?.message ?? "unknown"}`,
      });
      continue;
    }

    await supabase
      .from("sniper_executions")
      .update({
        sell_pending_trade_id: pending.id,
        sell_dispatched_at: new Date().toISOString(),
      })
      .eq("id", pos.id)
      // Only claim the sell if one isn't already in flight — guards against a
      // second cron tick dispatching a duplicate sell before confirmation.
      .is("sell_pending_trade_id", null);

    summary.push({
      id: pos.id,
      action: "sell",
      reason: decision.reason ?? undefined,
      pnlPct: decision.pnlPct,
      pendingTradeId: pending.id,
    });
  }

  const sells = summary.filter((s) => s.action === "sell").length;
  await logCronExecution(
    "sniper-autosell",
    "success",
    Date.now() - startedAt,
    undefined,
    sells,
  );
  return cronResponse("sniper-autosell", startedAt, {
    open: open.length,
    sells,
    summary,
  });
  } finally {
    await supabase.rpc("release_cron_lock", { p_name: "sniper-autosell" });
  }
}
