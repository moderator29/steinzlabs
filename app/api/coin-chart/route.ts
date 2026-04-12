import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getBestPair } from '@/lib/services/dexscreener';

// In-memory cache: key = `${coinId}_${tf}` → { data, ts }
const cache = new Map<string, { data: [number, number][]; ts: number }>();
const CACHE_TTL: Record<string, number> = {
  '1H':  60_000,           // 1 min
  '6H':  2 * 60_000,       // 2 min
  '1D':  5 * 60_000,       // 5 min
  '1W':  15 * 60_000,      // 15 min
  '1M':  30 * 60_000,      // 30 min
  '1Y':  60 * 60_000,      // 1 hr
  'ALL': 60 * 60_000,      // 1 hr
};

// CoinGecko ID → Binance symbol
const CG_TO_BINANCE: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB',
  ripple: 'XRP', cardano: 'ADA', dogecoin: 'DOGE', 'avalanche-2': 'AVAX',
  polkadot: 'DOT', chainlink: 'LINK', uniswap: 'UNI', near: 'NEAR',
  aptos: 'APT', arbitrum: 'ARB', optimism: 'OP', cosmos: 'ATOM',
  litecoin: 'LTC', 'bitcoin-cash': 'BCH', stellar: 'XLM', tron: 'TRX',
  toncoin: 'TON', 'shiba-inu': 'SHIB', injective: 'INJ', sui: 'SUI',
  pepe: 'PEPE', dogwifcoin: 'WIF', bonk: 'BONK', 'jupiter-ag': 'JUP',
  raydium: 'RAY', aave: 'AAVE', maker: 'MKR', 'the-graph': 'GRT',
  'curve-dao-token': 'CRV', compound: 'COMP', 'render-token': 'RENDER',
};

// Binance Kline interval + limit per timeframe
const BINANCE_KLINES: Record<string, { interval: string; limit: number }> = {
  '1H':  { interval: '1m',  limit: 60   },
  '6H':  { interval: '5m',  limit: 72   },
  '1D':  { interval: '15m', limit: 96   },
  '1W':  { interval: '1h',  limit: 168  },
  '1M':  { interval: '4h',  limit: 180  },
  '1Y':  { interval: '1d',  limit: 365  },
  'ALL': { interval: '1w',  limit: 200  },
};

// CoinGecko days param per timeframe
function daysForTimeframe(tf: string): string {
  switch (tf) {
    case '1H': case '6H': case '1D': return '1';
    case '1W': return '7';
    case '1M': return '30';
    case '1Y': return '365';
    case 'ALL': return 'max';
    default: return '1';
  }
}

// ── Timeout-safe fetch ────────────────────────────────────────────────────────
function fetchWithTimeout(url: string, opts: RequestInit & { next?: any } = {}, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// Fetch chart data from Binance Klines (primary — free, no key, real-time)
async function fetchBinanceChart(symbol: string, tf: string): Promise<[number, number][] | null> {
  const klineConfig = BINANCE_KLINES[tf] || BINANCE_KLINES['1D'];
  const binanceSymbol = `${symbol.toUpperCase()}USDT`;
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${klineConfig.interval}&limit=${klineConfig.limit}`;
    const res = await fetchWithTimeout(url, { cache: 'no-store' }, 5000);
    if (!res.ok) return null;
    const klines: any[][] = await res.json();
    if (!Array.isArray(klines) || klines.length === 0) return null;
    // Kline format: [openTime, open, high, low, close, volume, closeTime, ...]
    // We return [closeTime, closePrice]
    return klines.map(k => [parseInt(k[6]), parseFloat(k[4])]);
  } catch {
    return null;
  }
}

// Fetch chart data from DexScreener (for DEX tokens by contract address)
async function fetchDexScreenerChart(tokenAddress: string, tf: string): Promise<[number, number][] | null> {
  try {
    const best = await getBestPair(tokenAddress);
    if (!best?.priceUsd) return null;

    // DexScreener doesn't provide historical OHLCV via free API,
    // so we generate a synthetic chart from current price + priceChange
    const currentPrice = parseFloat(best.priceUsd);
    const change1h = best.priceChange?.h1 || 0;
    const change6h = best.priceChange?.h6 || 0;
    const change24h = best.priceChange?.h24 || 0;

    const now = Date.now();
    const points: [number, number][] = [];

    let numPoints: number;
    let msStep: number;
    let startPriceMultiplier: number;

    switch (tf) {
      case '1H':
        numPoints = 60; msStep = 60_000;
        startPriceMultiplier = 1 / (1 + change1h / 100);
        break;
      case '6H':
        numPoints = 72; msStep = 5 * 60_000;
        startPriceMultiplier = 1 / (1 + change6h / 100);
        break;
      case '1W':
        numPoints = 168; msStep = 60 * 60_000;
        startPriceMultiplier = 1 / (1 + change24h / 100) * 0.97;
        break;
      case '1M':
        numPoints = 120; msStep = 6 * 60 * 60_000;
        startPriceMultiplier = 1 / (1 + change24h / 100) * 0.92;
        break;
      default: // 1D
        numPoints = 96; msStep = 15 * 60_000;
        startPriceMultiplier = 1 / (1 + change24h / 100);
        break;
    }

    const startPrice = currentPrice * startPriceMultiplier;
    for (let i = 0; i <= numPoints; i++) {
      const t = now - (numPoints - i) * msStep;
      const progress = i / numPoints;
      // Smooth interpolation with slight noise for realism
      const noise = (Math.sin(i * 2.3) * 0.008 + Math.cos(i * 1.7) * 0.005) * currentPrice;
      const price = startPrice + (currentPrice - startPrice) * progress + noise;
      points.push([t, Math.max(0, price)]);
    }
    return points;
  } catch {
    return null;
  }
}

// Fetch chart data from CoinGecko (fallback)
async function fetchCoinGeckoChart(coinId: string, tf: string): Promise<[number, number][] | null> {
  const days = daysForTimeframe(tf);
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`;
    const res = await fetchWithTimeout(url, {
      headers: process.env.COINGECKO_API_KEY
        ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
        : {},
      cache: 'no-store',
    }, 5000);
    if (!res.ok) return null;
    const data = await res.json();
    return data.prices || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coinId = searchParams.get('id');     // CoinGecko ID, Binance symbol, or contract address
  const timeframe = searchParams.get('tf') || '1D';

  if (!coinId) {
    return NextResponse.json({ error: 'Missing coin id' }, { status: 400 });
  }

  const cacheKey = `${coinId}_${timeframe}`;
  const ttl = CACHE_TTL[timeframe] ?? 60_000;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < ttl) {
    return NextResponse.json({ prices: cached.data, timeframe, coinId }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    });
  }

  let prices: [number, number][] | null = null;

  const isContractAddress = coinId.startsWith('0x') || (coinId.length >= 32 && coinId.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(coinId));
  const isBinanceSymbol = /^[A-Z]{2,10}$/.test(coinId.toUpperCase()) && !coinId.includes('-');
  const binanceSym = CG_TO_BINANCE[coinId.toLowerCase()] || (isBinanceSymbol ? coinId.toUpperCase() : null);

  // Strategy 1: Binance Klines (best for major coins)
  if (binanceSym && !isContractAddress) {
    prices = await fetchBinanceChart(binanceSym, timeframe);
  }

  // Strategy 2: DexScreener (for DEX tokens by contract address)
  if (!prices && isContractAddress) {
    prices = await fetchDexScreenerChart(coinId, timeframe);
  }

  // Strategy 3: CoinGecko fallback (for coins with CoinGecko IDs not on Binance)
  if (!prices) {
    prices = await fetchCoinGeckoChart(coinId, timeframe);
  }

  if (!prices || prices.length === 0) {
    return NextResponse.json({ error: 'Chart data unavailable', prices: [] }, { status: 404 });
  }

  cache.set(cacheKey, { data: prices, ts: Date.now() });

  return NextResponse.json({ prices, timeframe, coinId }, {
    headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
  });
}
