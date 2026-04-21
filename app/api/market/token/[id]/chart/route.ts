import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { OHLCVCandle } from '@/lib/market/types';

export const dynamic = 'force-dynamic';

const BASE = 'https://api.coingecko.com/api/v3';

function cgHeaders(): Record<string, string> {
  return process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : {};
}

function synthesizeOHLC(
  prices: [number, number][],
  intervalSec: number
): OHLCVCandle[] {
  const groups = new Map<number, number[]>();
  for (const [ms, price] of prices) {
    const bucket = Math.floor(ms / 1000 / intervalSec) * intervalSec;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)!.push(price);
  }
  const candles: OHLCVCandle[] = [];
  for (const [time, pts] of [...groups.entries()].sort(([a], [b]) => a - b)) {
    candles.push({
      time,
      open:  pts[0],
      high:  Math.max(...pts),
      low:   Math.min(...pts),
      close: pts[pts.length - 1],
    });
  }
  return candles;
}

function intervalFor(days: string): number {
  if (days === '1')   return 1800;
  if (days === '7')   return 7200;
  if (days === '30')  return 21600;
  if (days === '365') return 86400;
  return 604800;
}

// Same symbol→slug normalization the token detail route uses, so
// wallet links like /coin/arbitrum/eth resolve to CoinGecko's
// "ethereum" slug instead of a 404.
const SYMBOL_TO_SLUG: Record<string, string> = {
  eth: 'ethereum', weth: 'weth', btc: 'bitcoin', wbtc: 'wrapped-bitcoin',
  sol: 'solana', bnb: 'binancecoin', wbnb: 'wbnb', matic: 'matic-network',
  pol: 'polygon-ecosystem-token', avax: 'avalanche-2', arb: 'arbitrum',
  op: 'optimism', usdc: 'usd-coin', usdt: 'tether', dai: 'dai',
  link: 'chainlink', uni: 'uniswap', ltc: 'litecoin', trx: 'tron',
  doge: 'dogecoin', shib: 'shiba-inu',
};

// GeckoTerminal OHLCV fallback — free CoinGecko service that indexes
// small-cap DEX pairs CoinGecko's main /coins endpoint doesn't.
// Covers Naka Go (Ethereum), Pleasure Coin (Polygon), and any other
// contract-address token the user seeds into the wallet as a custom
// token. Returns raw [timestamp, open, high, low, close, volume]
// tuples that we normalise into our OHLCVCandle shape.
const GT_BASE = 'https://api.geckoterminal.com/api/v2';
// Map our chain ids to GeckoTerminal network slugs.
const GT_NETWORK: Record<string, string> = {
  ethereum: 'eth',
  bnb: 'bsc',
  bsc: 'bsc',
  polygon: 'polygon_pos',
  base: 'base',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  avalanche: 'avax',
  fantom: 'ftm',
  solana: 'solana',
};
function gtTimeframe(days: string): { tf: string; aggregate: string; limit: number } {
  // day/hour/minute aggregation; GeckoTerminal caps at 1000 candles.
  if (days === '1')   return { tf: 'minute', aggregate: '15', limit: 96 };   // 24h of 15m
  if (days === '7')   return { tf: 'hour',   aggregate: '1',  limit: 168 };  // 7d of 1h
  if (days === '30')  return { tf: 'hour',   aggregate: '4',  limit: 180 };  // 30d of 4h
  if (days === '365') return { tf: 'day',    aggregate: '1',  limit: 365 };  // 1y of 1d
  return { tf: 'day', aggregate: '1', limit: 1000 };                          // max
}

async function geckoTerminalFallback(contract: string, chain: string, days: string) {
  const network = GT_NETWORK[chain.toLowerCase()];
  if (!network) return null;

  // Step 1: resolve contract → top pool for that token.
  try {
    const poolsRes = await fetch(`${GT_BASE}/networks/${network}/tokens/${contract.toLowerCase()}/pools?page=1`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 300 },
    } as RequestInit);
    if (!poolsRes.ok) return null;
    const poolsJson = await poolsRes.json() as { data?: Array<{ id: string; attributes?: { address?: string } }> };
    const poolAddr = poolsJson.data?.[0]?.attributes?.address;
    if (!poolAddr) return null;

    // Step 2: fetch OHLCV for that pool.
    const { tf, aggregate, limit } = gtTimeframe(days);
    const ohlcvRes = await fetch(`${GT_BASE}/networks/${network}/pools/${poolAddr}/ohlcv/${tf}?aggregate=${aggregate}&limit=${limit}&currency=usd`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 30 },
    } as RequestInit);
    if (!ohlcvRes.ok) return null;
    const ohlcvJson = await ohlcvRes.json() as {
      data?: { attributes?: { ohlcv_list?: Array<[number, number, number, number, number, number]> } };
    };
    const list = ohlcvJson.data?.attributes?.ohlcv_list ?? [];
    // GT returns newest-first — reverse to chronological.
    const candles: OHLCVCandle[] = list
      .slice()
      .reverse()
      .map(([ts, o, h, l, c]) => ({ time: ts, open: o, high: h, low: l, close: c }));
    return candles.length > 1 ? candles : null;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await context.params;
  const id = SYMBOL_TO_SLUG[rawId.toLowerCase()] ?? rawId;
  const days = req.nextUrl.searchParams.get('days') ?? '1';
  const chainParam = req.nextUrl.searchParams.get('chain') ?? 'ethereum';

  const looksLikeEvmContract = /^0x[0-9a-fA-F]{40}$/.test(id);

  // Path A — contract address: skip CoinGecko's main /coins endpoint
  // (404 guaranteed) and go straight to GeckoTerminal by pool.
  if (looksLikeEvmContract) {
    const candles = await geckoTerminalFallback(id, chainParam, days);
    if (candles) {
      return NextResponse.json(
        { candles, volume: [] },
        { headers: { 'Cache-Control': 'public, max-age=30' } },
      );
    }
    return NextResponse.json({ error: 'No chart data on GeckoTerminal' }, { status: 404 });
  }

  // Path B — CoinGecko slug (bitcoin, ethereum, etc.)
  const url = new URL(`${BASE}/coins/${id}/market_chart`);
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('days', days);
  if (days === '1') url.searchParams.set('interval', 'minutely');

  try {
    const res = await fetch(url.toString(), {
      headers: cgHeaders(),
      next: { revalidate: 30 },
    } as RequestInit);

    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko ${res.status}` },
        { status: res.status }
      );
    }

    const raw = await res.json() as {
      prices: [number, number][];
      total_volumes: [number, number][];
    };

    const intervalSec = intervalFor(days);
    const candles = synthesizeOHLC(raw.prices ?? [], intervalSec);

    return NextResponse.json(
      { candles, volume: [] },
      { headers: { 'Cache-Control': 'public, max-age=30' } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 }
    );
  }
}