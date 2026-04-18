import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Portfolio performance + realized PnL from the authoritative
 * `transactions` table. Returns:
 *   - series: cumulative USD invested/withdrawn over time for the chart.
 *   - realized: simple realized P&L from closed round-trips (sum of
 *     usd_value on sells - proportional cost from prior buys).
 *   - stats: win rate, best/worst token, avg hold hours, total gas.
 *
 * Cost basis uses FIFO accounting keyed by (wallet_address, symbol).
 */

interface TxRow {
  tx_hash: string;
  wallet_address: string | null;
  chain: string | null;
  type: string | null;
  from_token_symbol: string | null;
  to_token_symbol: string | null;
  from_amount: number | null;
  to_amount: number | null;
  usd_value: number | null;
  gas_fee_usd: number | null;
  status: string | null;
  timestamp: string;
}

interface PerformancePoint {
  time: number; // unix seconds
  value: number;
}

interface PerformanceStats {
  winRate: number | null;
  totalTrades: number;
  closedTrades: number;
  bestToken: { symbol: string; pnl: number } | null;
  worstToken: { symbol: string; pnl: number } | null;
  avgHoldHours: number | null;
  totalGasUsd: number;
}

function getSupabase() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {},
        remove() {},
      },
    },
  );
}

interface Lot {
  amount: number;
  costUsd: number;
  timestampMs: number;
}

export async function GET(_request: NextRequest) {
  const sb = getSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: txData } = await admin
    .from("transactions")
    .select(
      "tx_hash,wallet_address,chain,type,from_token_symbol,to_token_symbol,from_amount,to_amount,usd_value,gas_fee_usd,status,timestamp",
    )
    .eq("user_id", user.id)
    .eq("status", "success")
    .order("timestamp", { ascending: true })
    .returns<TxRow[]>();

  const txs = txData ?? [];

  // FIFO cost basis: map per symbol → lot queue.
  const lots = new Map<string, Lot[]>();
  const realizedBySymbol = new Map<string, number>();
  const holdDurations: number[] = [];
  let closedTrades = 0;
  let winners = 0;
  let totalGasUsd = 0;

  for (const t of txs) {
    if (t.gas_fee_usd) totalGasUsd += Number(t.gas_fee_usd);

    const buySym = t.to_token_symbol ? t.to_token_symbol.toUpperCase() : null;
    const sellSym = t.from_token_symbol ? t.from_token_symbol.toUpperCase() : null;
    const usd = Number(t.usd_value ?? 0);
    if (usd <= 0) continue;

    const ts = new Date(t.timestamp).getTime();

    if (buySym && !["USD", "USDC", "USDT", "DAI"].includes(buySym) && t.to_amount) {
      const q = lots.get(buySym) ?? [];
      q.push({ amount: Number(t.to_amount), costUsd: usd, timestampMs: ts });
      lots.set(buySym, q);
    }

    if (sellSym && !["USD", "USDC", "USDT", "DAI"].includes(sellSym) && t.from_amount) {
      let remaining = Number(t.from_amount);
      const proceeds = usd;
      const q = lots.get(sellSym) ?? [];
      let costBasis = 0;
      while (remaining > 1e-12 && q.length > 0) {
        const lot = q[0];
        const take = Math.min(lot.amount, remaining);
        const takeRatio = take / lot.amount;
        const lotCost = lot.costUsd * takeRatio;
        costBasis += lotCost;
        remaining -= take;
        lot.amount -= take;
        lot.costUsd -= lotCost;
        if (take > 0) {
          const holdHours = (ts - lot.timestampMs) / 3600_000;
          if (holdHours >= 0 && holdHours < 24 * 365 * 10) holdDurations.push(holdHours);
        }
        if (lot.amount <= 1e-12) q.shift();
      }
      lots.set(sellSym, q);
      const pnl = proceeds - costBasis;
      realizedBySymbol.set(sellSym, (realizedBySymbol.get(sellSym) ?? 0) + pnl);
      closedTrades++;
      if (pnl > 0) winners++;
    }
  }

  // Performance series: cumulative USD flow by day.
  const byDay = new Map<number, number>();
  let cumulative = 0;
  for (const t of txs) {
    const usd = Number(t.usd_value ?? 0);
    if (usd <= 0) continue;
    // Treat buys of non-stable as money "deployed", sells as money
    // "withdrawn". Cumulative roughly tracks capital deployed over time.
    const buySym = t.to_token_symbol?.toUpperCase() ?? null;
    const isStableOut = buySym && ["USD", "USDC", "USDT", "DAI"].includes(buySym);
    const signed = isStableOut ? -usd : usd;
    cumulative += signed;
    const dayStart = Math.floor(new Date(t.timestamp).getTime() / 86_400_000) * 86_400;
    byDay.set(dayStart, cumulative);
  }
  const series: PerformancePoint[] = Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time, value }));

  // Best / worst tokens by realized PnL.
  let bestToken: PerformanceStats["bestToken"] = null;
  let worstToken: PerformanceStats["worstToken"] = null;
  for (const [symbol, pnl] of realizedBySymbol) {
    if (!bestToken || pnl > bestToken.pnl) bestToken = { symbol, pnl };
    if (!worstToken || pnl < worstToken.pnl) worstToken = { symbol, pnl };
  }

  const avgHoldHours =
    holdDurations.length > 0
      ? holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length
      : null;

  const stats: PerformanceStats = {
    winRate: closedTrades > 0 ? (winners / closedTrades) * 100 : null,
    totalTrades: txs.length,
    closedTrades,
    bestToken,
    worstToken,
    avgHoldHours,
    totalGasUsd,
  };

  const totalRealizedUsd = Array.from(realizedBySymbol.values()).reduce(
    (a, b) => a + b,
    0,
  );

  return NextResponse.json({
    series,
    realized: {
      totalUsd: totalRealizedUsd,
      bySymbol: Object.fromEntries(realizedBySymbol),
    },
    stats,
  });
}
