import { NextRequest, NextResponse } from 'next/server';

export interface OHLCCandle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// In-memory cache
const cache: Record<string, { data: any; ts: number }> = {};
const TTL: Record<string, number> = {
  '1H': 60_000,
  '6H': 3 * 60_000,
  '1D': 5 * 60_000,
  '1W': 15 * 60_000,
  '1M': 30 * 60_000,
  '1Y': 60 * 60_000,
  'ALL': 60 * 60_000,
};

function getCached(key: string, ttl: number) {
  const e = cache[key];
  if (e && Date.now() - e.ts < ttl) return e.data;
  return null;
}
function setCache(key: string, data: any) {
  cache[key] = { data, ts: Date.now() };
}

// Binance interval + limit per timeframe
const BINANCE_MAP: Record<string, { interval: string; limit: number }> = {
  '1H':  { interval: '5m',  limit: 12  },
  '6H':  { interval: '30m', limit: 12  },
  '1D':  { interval: '1h',  limit: 24  },
  '1W':  { interval: '4h',  limit: 42  },
  '1M':  { interval: '1d',  limit: 30  },
  '1Y':  { interval: '1d',  limit: 365 },
  'ALL': { interval: '1w',  limit: 200 },
};

// CoinGecko days per timeframe
const CG_DAYS: Record<string, number> = {
  '1H': 1, '6H': 1, '1D': 1, '1W': 7, '1M': 30, '1Y': 365, 'ALL': 365,
};

async function fetchBinanceKlines(rawSymbol: string, interval: string, limit: number): Promise<OHLCCandle[]> {
  // Normalise: strip existing USDT, then re-add
  let sym = rawSymbol.toUpperCase().replace(/USDT$/, '') + 'USDT';
  // Handle already-correct symbols
  if (rawSymbol.toUpperCase().endsWith('USDT') && !rawSymbol.toUpperCase().endsWith('USDTUSDT')) {
    sym = rawSymbol.toUpperCase();
  }

  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${limit}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const rows: any[][] = await res.json();

  return rows.map(k => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

async function fetchCoinGeckoOHLC(id: string, days: number): Promise<OHLCCandle[]> {
  const headers: Record<string, string> = process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : {};

  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`,
    { headers, next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`CoinGecko OHLC ${res.status}`);
  const rows: number[][] = await res.json();

  // CoinGecko returns [timestamp_ms, open, high, low, close]
  return rows.map(k => ({
    time: Math.floor(k[0] / 1000),
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: 0,
  }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase();
  const id     = searchParams.get('id') || '';
  const tf     = searchParams.get('tf') || '1D';

  if (!symbol && !id) {
    return NextResponse.json({ error: 'Missing symbol or id', candles: [] }, { status: 400 });
  }

  const cacheKey = `ohlc_${symbol || id}_${tf}`;
  const ttl = TTL[tf] ?? 5 * 60_000;
  const cached = getCached(cacheKey, ttl);
  if (cached) return NextResponse.json(cached);

  const { interval, limit } = BINANCE_MAP[tf] ?? { interval: '1d', limit: 30 };
  const cgDays = CG_DAYS[tf] ?? 30;

  let candles: OHLCCandle[] = [];

  // 1. Try Binance klines (symbol = BTC, ETH, SOL, etc.)
  if (symbol) {
    try {
      candles = await fetchBinanceKlines(symbol, interval, limit);
    } catch {
      // fall through to CoinGecko
    }
  }

  // 2. CoinGecko OHLC (id = bitcoin, ethereum, etc.)
  if (candles.length === 0 && id) {
    try {
      candles = await fetchCoinGeckoOHLC(id, cgDays);
    } catch {
      // fall through
    }
  }

  // 3. If we had symbol but no id, try guessing CoinGecko id from lowercase symbol
  if (candles.length === 0 && symbol && !id) {
    try {
      candles = await fetchCoinGeckoOHLC(symbol.toLowerCase(), cgDays);
    } catch {
      // nothing
    }
  }

  const result = { candles, timeframe: tf, symbol: symbol || id };
  if (candles.length > 0) setCache(cacheKey, result);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
  });
}
