import 'server-only';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyAdminRequest, unauthorizedResponse } from '@/lib/auth/adminAuth';
import { PLATFORM_FEE_BPS } from '@/lib/trading/swapLogging';

/**
 * Coins-feature revenue analytics.
 *
 * There is no coins-specific revenue ledger: fee_revenue is the platform-wide
 * swap ledger and carries no coins-source tag we can trust to isolate this
 * feature. So we compute coins revenue HONESTLY from the settled trades in
 * coin_trades (every row is written only after the wallet broadcast confirms)
 * at the real platform fee, PLATFORM_FEE_BPS (default 50 bps = 0.5%), and flag
 * the response as `estimated: true` so the UI can label it plainly.
 */

const FEE_FRACTION = PLATFORM_FEE_BPS / 10_000;
const PAGE_SIZE = 1000;

interface TradeRow {
  chain: string;
  token_key: string;
  symbol: string | null;
  usd_amount: number | string | null;
  created_at: string;
}

interface DayPoint {
  day: string;
  revenueUsd: number;
  volumeUsd: number;
  trades: number;
}

interface CoinPoint {
  chain: string;
  tokenKey: string;
  symbol: string | null;
  volumeUsd: number;
  revenueUsd: number;
  trades: number;
}

export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  try {
    const supabase = getSupabaseAdmin();

    // Page through every settled trade so the totals are accurate rather than
    // capped at the default PostgREST row limit.
    const rows: TradeRow[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('coin_trades')
        .select('chain, token_key, symbol, usd_amount, created_at')
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) {
        console.error('[admin/coins/revenue GET] Query error:', error);
        break;
      }
      const batch = (data as TradeRow[]) ?? [];
      rows.push(...batch);
      if (batch.length < PAGE_SIZE) break;
    }

    let totalVolumeUsd = 0;
    const byChain = new Map<string, { volumeUsd: number; revenueUsd: number; trades: number }>();
    const byDay = new Map<string, DayPoint>();
    const byCoin = new Map<string, CoinPoint>();

    for (const r of rows) {
      const usd = Number(r.usd_amount) || 0;
      totalVolumeUsd += usd;

      const chain = r.chain || 'unknown';
      const chainAgg = byChain.get(chain) ?? { volumeUsd: 0, revenueUsd: 0, trades: 0 };
      chainAgg.volumeUsd += usd;
      chainAgg.revenueUsd += usd * FEE_FRACTION;
      chainAgg.trades += 1;
      byChain.set(chain, chainAgg);

      const day = r.created_at ? r.created_at.slice(0, 10) : 'unknown';
      const dayAgg = byDay.get(day) ?? { day, revenueUsd: 0, volumeUsd: 0, trades: 0 };
      dayAgg.revenueUsd += usd * FEE_FRACTION;
      dayAgg.volumeUsd += usd;
      dayAgg.trades += 1;
      byDay.set(day, dayAgg);

      const coinId = `${chain}:${r.token_key}`;
      const coinAgg = byCoin.get(coinId) ?? {
        chain,
        tokenKey: r.token_key,
        symbol: r.symbol,
        volumeUsd: 0,
        revenueUsd: 0,
        trades: 0,
      };
      coinAgg.volumeUsd += usd;
      coinAgg.revenueUsd += usd * FEE_FRACTION;
      coinAgg.trades += 1;
      if (!coinAgg.symbol && r.symbol) coinAgg.symbol = r.symbol;
      byCoin.set(coinId, coinAgg);
    }

    const perChain = [...byChain.entries()]
      .map(([chain, v]) => ({ chain, ...v }))
      .sort((a, b) => b.revenueUsd - a.revenueUsd);

    const perDay = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));

    const topCoins = [...byCoin.values()]
      .sort((a, b) => b.volumeUsd - a.volumeUsd)
      .slice(0, 10);

    return NextResponse.json({
      estimated: true,
      basis: `Estimated from coins trades at ${(FEE_FRACTION * 100).toFixed(2)}%`,
      feeBps: PLATFORM_FEE_BPS,
      totalRevenueUsd: totalVolumeUsd * FEE_FRACTION,
      totalVolumeUsd,
      totalTrades: rows.length,
      perChain,
      perDay,
      topCoins,
    });
  } catch (err) {
    console.error('[admin/coins/revenue GET] Failed:', err);
    return NextResponse.json({
      estimated: true,
      basis: 'Estimated from coins trades at 0.50%',
      feeBps: PLATFORM_FEE_BPS,
      totalRevenueUsd: 0,
      totalVolumeUsd: 0,
      totalTrades: 0,
      perChain: [],
      perDay: [],
      topCoins: [],
    });
  }
}
