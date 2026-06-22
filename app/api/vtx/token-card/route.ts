import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getBirdeyeOHLCV } from '@/lib/services/birdeye';

// FIX 5A.1 / Phase 5: returns a short price history for the VTX inline token card's chart.
// Uses DexScreener pair m5 candles (free, no API key) for on-chain tokens.
// Falls back to CoinGecko market_chart for well-known tickers.

export const runtime = 'nodejs';

interface CacheEntry { at: number; data: unknown }
const cache = new Map<string, CacheEntry>();
const TTL = 60 * 1000;

const SYMBOL_TO_CG: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2',
  MATIC: 'matic-network', POL: 'matic-network', ARB: 'arbitrum', SUI: 'sui',
  LINK: 'chainlink', UNI: 'uniswap', AAVE: 'aave', PEPE: 'pepe', SHIB: 'shiba-inu',
  USDT: 'tether', USDC: 'usd-coin', BONK: 'bonk', WIF: 'dogwifcoin', JUP: 'jupiter-exchange-solana',
  TON: 'the-open-network', OP: 'optimism', LTC: 'litecoin', TRX: 'tron',
};

async function fetchCoinGeckoChart(symbol: string, tf: '1h' | '24h' | '7d') {
  const id = SYMBOL_TO_CG[symbol.toUpperCase()];
  if (!id) return null;
  const days = tf === '1h' ? 1 : tf === '7d' ? 7 : 1;
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return null;
  const body = await res.json();
  const prices: [number, number][] = Array.isArray(body?.prices) ? body.prices : [];
  // Downsample to ~48 points so the SVG path stays light.
  const step = Math.max(1, Math.floor(prices.length / 48));
  const points = prices.filter((_, i) => i % step === 0).map((p) => p[1]);
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const changePct = first ? ((last - first) / first) * 100 : 0;
  // Deep-dive fix — return change24h too (was missing). When tf=7d we
  // still want the 24h change for the price-card label, so derive it
  // from the last two points if the requested tf is 7d, else use changePct.
  const change24h = tf === '24h'
    ? changePct
    : (() => {
        const len = points.length;
        if (len < 2) return changePct;
        const cutoff = Math.max(0, len - Math.floor(len / Math.max(1, days)));
        const a = points[cutoff];
        const b = points[len - 1];
        return a ? ((b - a) / a) * 100 : changePct;
      })();
  return { points, changePct, source: 'coingecko', price: last, change24h };
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const symbol = req.nextUrl.searchParams.get('symbol');
  const chain = req.nextUrl.searchParams.get('chain');
  const tf = (req.nextUrl.searchParams.get('tf') || '24h') as '1h' | '24h' | '7d';

  // Symbol-first path: majors render from CoinGecko market_chart — real
  // historical series, not % reconstructions.
  if (!address && symbol) {
    const key = `sym:${symbol.toUpperCase()}:${tf}`;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.at < TTL) {
      return NextResponse.json(cached.data, {
        headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
      });
    }
    const cg = await fetchCoinGeckoChart(symbol, tf);
    if (cg) {
      cache.set(key, { at: Date.now(), data: cg });
      return NextResponse.json(cg, {
        headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
      });
    }
    // Deep-dive fix — empty fallback now includes price + change24h so
    // the VTX TokenCard's destructure (d?.price, d?.change24h) never
    // misses and the LLM-stale value won't be used.
    return NextResponse.json({ points: [], changePct: 0, source: 'none', price: 0, change24h: 0 });
  }

  if (!address) return NextResponse.json({ error: 'missing address or symbol' }, { status: 400 });

  const key = `${chain || ''}:${address}:${tf}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json(cached.data, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  }

  try {
    // DexScreener returns a pair object with priceUsd and priceChange — we derive
    // synthetic history from the h1 / h6 / h24 change points if OHLC isn't available.
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) throw new Error(`dexscreener ${res.status}`);
    const body = await res.json();
    const pair = Array.isArray(body?.pairs)
      ? body.pairs.filter((p: any) => !chain || p.chainId === chain).sort(
          (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0),
        )[0]
      : null;

    if (!pair) {
      // Deep-dive fix — when DexScreener has nothing and the caller
      // also gave us a symbol, fall back to CoinGecko before giving up.
      // Saves a stale-LLM-price moment for any token DexScreener missed.
      if (symbol) {
        const cg = await fetchCoinGeckoChart(symbol, tf);
        if (cg) {
          cache.set(key, { at: Date.now(), data: cg });
          return NextResponse.json(cg);
        }
      }
      const empty = { points: [], changePct: 0, source: 'none', price: 0, change24h: 0 };
      cache.set(key, { at: Date.now(), data: empty });
      return NextResponse.json(empty);
    }

    const price = parseFloat(pair.priceUsd || '0');
    const changes = pair.priceChange || {};
    // Reconstruct a crude price path from DexScreener's % changes over 1h/6h/24h.
    // Not true candles but enough to draw a line that reflects direction + magnitude.
    const window =
      tf === '1h' ? [{ at: -60, pct: changes.h1 }] :
      tf === '7d' ? [
        { at: -7 * 24 * 60, pct: changes.h24 !== undefined ? changes.h24 * 3 : undefined },
        { at: -3 * 24 * 60, pct: changes.h24 !== undefined ? changes.h24 * 2 : undefined },
        { at: -24 * 60, pct: changes.h24 },
        { at: -6 * 60, pct: changes.h6 },
        { at: -60, pct: changes.h1 },
      ] :
      [
        { at: -24 * 60, pct: changes.h24 },
        { at: -6 * 60, pct: changes.h6 },
        { at: -60, pct: changes.h1 },
      ];

    const samples = window.filter((w) => typeof w.pct === 'number');
    const points: number[] = [];
    if (samples.length > 0 && price > 0) {
      // Start from "price N minutes ago" using reverse compounding.
      const base = samples[0];
      const pastPrice = price / (1 + (base.pct! / 100));
      points.push(pastPrice);
      for (let i = 1; i < samples.length; i++) {
        const local = price / (1 + (samples[i].pct! / 100));
        points.push(local);
      }
      points.push(price);
    }

    // Real OHLC candles from Birdeye replace the crude %-reconstruction with
    // an actual price series. Falls back to the synthetic `points` only when
    // Birdeye has no data for this token/chain.
    let realPoints: number[] = [];
    try {
      const tfType = tf === '7d' ? '4H' : '1H';
      const tail = tf === '7d' ? 42 : tf === '1h' ? 6 : 24;
      const ohlcv = await getBirdeyeOHLCV(address, tfType, 200, chain || 'solana');
      realPoints = ohlcv
        .slice(-tail)
        .map((c) => c.close)
        .filter((v) => typeof v === 'number' && v > 0);
    } catch { /* fall back to the synthetic series below */ }

    // Chart source priority: Birdeye OHLC (real candles) -> CoinGecko (for the
    // majors it covers) -> the synthetic %-reconstruction as a last resort.
    let series = points;
    let chartSource = 'dexscreener';
    if (realPoints.length > 1) {
      series = realPoints;
      chartSource = 'birdeye';
    } else {
      const cgSymbol = symbol || pair.baseToken?.symbol;
      if (cgSymbol) {
        const cg = await fetchCoinGeckoChart(cgSymbol, tf);
        if (cg && cg.points.length > 1) { series = cg.points; chartSource = 'coingecko'; }
      }
    }
    const first = series[0] ?? price;
    const last = series[series.length - 1] ?? price;
    const changePct = first ? ((last - first) / first) * 100 : 0;

    const marketCap = pair.marketCap ?? pair.fdv ?? 0;
    const data = {
      points: series,
      changePct,
      source: chartSource,
      price,
      change24h: changes.h24 ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      liquidity: pair.liquidity?.usd ?? 0,
      marketCap,
      fdv: pair.fdv ?? 0,
      // Circulating supply implied by marketCap / price (no fabricated number;
      // null when we can't derive it cleanly).
      supply: price > 0 && marketCap > 0 ? marketCap / price : null,
      symbol: pair.baseToken?.symbol,
      name: pair.baseToken?.name,
      chain: pair.chainId,
      pairAddress: pair.pairAddress,
      dexUrl: pair.url,
    };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    });
  } catch {
    // Deep-dive fix — even the error branch returns the shape the client
    // expects (price + change24h zero) so the TokenCard fallback chain
    // doesn't see undefined and silently keep showing LLM-stale data.
    return NextResponse.json({ points: [], changePct: 0, source: 'error', price: 0, change24h: 0 });
  }
}
