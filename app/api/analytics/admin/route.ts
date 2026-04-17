import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSwapTrades, getGaslessTrades } from '@/lib/services/zerox';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) are required');
  }
  _supabase = createClient(url, key);
  return _supabase;
}

export async function GET(request: NextRequest) {
  try {
    // Admin auth check
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await getSupabase().auth.getUser(token);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const role = user.user_metadata?.role;
      if (role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
    }

    const [swapTrades, gaslessTrades] = await Promise.allSettled([
      getSwapTrades(),
      getGaslessTrades(),
    ]);

    const swaps = swapTrades.status === 'fulfilled' ? swapTrades.value : [];
    const gasless = gaslessTrades.status === 'fulfilled' ? gaslessTrades.value : [];
    const allTrades = [...swaps, ...gasless];

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Revenue calculations from integratorFee
    let totalFeesUsd = 0;
    let feesToday = 0;
    let feesThisMonth = 0;
    const dailyFees: Record<string, number> = {};
    const chainFees: Record<number, number> = {};
    const traderVolumes: Record<string, number> = {};

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    for (const trade of allTrades) {
      const feeUsd = parseFloat(trade.integratorFee?.amountUsd || '0');
      const sellUsd = parseFloat(trade.sellToken?.amountUsd || '0');
      const tradeTime = new Date(trade.timestamp);
      const age = now - tradeTime.getTime();
      const dateKey = tradeTime.toISOString().split('T')[0];

      totalFeesUsd += feeUsd;
      if (age < day) feesToday += feeUsd;
      if (tradeTime.getMonth() === currentMonth && tradeTime.getFullYear() === currentYear) {
        feesThisMonth += feeUsd;
      }

      dailyFees[dateKey] = (dailyFees[dateKey] || 0) + feeUsd;
      const cid = trade.chainId || 1;
      chainFees[cid] = (chainFees[cid] || 0) + feeUsd;

      if (trade.taker) {
        traderVolumes[trade.taker] = (traderVolumes[trade.taker] || 0) + sellUsd;
      }
    }

    // Daily fees chart (last 30 days)
    const dailyFeesChart = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * day);
      const key = d.toISOString().split('T')[0];
      dailyFeesChart.push({ date: key, fees: dailyFees[key] || 0 });
    }

    // Projected monthly revenue
    const last7DaysFees = dailyFeesChart.slice(-7).reduce((s, d) => s + d.fees, 0);
    const projectedMonthly = (last7DaysFees / 7) * 30;

    // Top traders
    const topTraders = Object.entries(traderVolumes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([wallet, volume]) => ({ wallet, volume }));

    return NextResponse.json({
      revenue: {
        totalFeesUsd,
        feesToday,
        feesThisMonth,
        projectedMonthly,
        dailyFeesChart,
        chainFees,
      },
      volume: {
        totalTrades: allTrades.length,
        standardCount: swaps.length,
        gaslessCount: gasless.length,
        gaslessRatio: allTrades.length > 0 ? gasless.length / allTrades.length : 0,
      },
      topTraders,
      trades: allTrades.slice(0, 200).map(t => ({
        txHash: t.txHash,
        chainId: t.chainId,
        sellToken: t.sellToken?.symbol,
        buyToken: t.buyToken?.symbol,
        sellAmountUsd: t.sellToken?.amountUsd,
        buyAmountUsd: t.buyToken?.amountUsd,
        feeUsd: t.integratorFee?.amountUsd || '0',
        taker: t.taker,
        timestamp: t.timestamp,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Admin analytics failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
