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
import { getCurrentTokenPriceUsd } from "@/lib/sniper/priceFeed";
import { evaluatePosition } from "@/lib/sniper/autosell";
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

  const { data: positions, error } = await supabase
    .from("sniper_executions")
    .select(
      "id,user_id,criteria_id,chain,token_address,token_symbol,amount_native," +
        "tokens_received,entry_price_usd,peak_price_usd,wallet_address,sell_pending_trade_id",
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

    const currentPriceUsd = await getCurrentTokenPriceUsd(
      pos.chain as SniperChain,
      pos.token_address,
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

    const { data: pending, error: insErr } = await supabase
      .from("pending_trades")
      .insert({
        user_id: pos.user_id,
        wallet_address: pos.wallet_address,
        chain: pos.chain,
        token_in: pos.token_address,
        token_out: "USDC",
        amount_in: pos.tokens_received,
        slippage_bps: c.max_slippage_bps ?? 200,
        source: "sniper-autosell",
        source_id: pos.id,
        status: "queued",
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
      .eq("id", pos.id);

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
}
