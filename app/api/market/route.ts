import { NextRequest, NextResponse } from 'next/server';

export interface MarketToken {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  logo: string;
  chain: string;
  source: 'coingecko' | 'dexscreener' | 'pumpfun' | 'pumpswap' | 'binance' | 'okx';
  address?: string;
  pairAddress?: string;
  dexChain?: string;
  liquidity?: number;
}

// Simple in-memory cache
const cache: Record<string, { data: MarketToken[]; ts: number }> = {};
const CACHE_TTL = 30_000; // 30 seconds

function cached(key: string): MarketToken[] | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key: string, data: MarketToken[]) {
  cache[key] = { data, ts: Date.now() };
}

function fmtLogoFallback(symbol: string): string {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(symbol)}&background=0A1EFF&color=fff&size=64&rounded=true&bold=true`;
}

async function fetchTrending(): Promise<MarketToken[]> {
  const key = 'trending';
  const hit = cached(key);
  if (hit) return hit;

  const results: MarketToken[] = [];

  // CoinGecko top 50 by market cap
  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&sparkline=false',
      {
        headers: { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '' },
        next: { revalidate: 30 },
      }
    );
    if (cgRes.ok) {
      const coins: any[] = await cgRes.json();
      for (const c of coins) {
        results.push({
          name: c.name,
          symbol: c.symbol.toUpperCase(),
          price: c.current_price ?? 0,
          change24h: c.price_change_percentage_24h ?? 0,
          volume24h: c.total_volume ?? 0,
          marketCap: c.market_cap ?? 0,
          logo: c.image || fmtLogoFallback(c.symbol),
          chain: 'multi',
          source: 'coingecko',
          address: c.id,
        });
      }
    }
  } catch {}

  // DexScreener token boosts (trending)
  try {
    const dexRes = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      next: { revalidate: 30 },
    });
    if (dexRes.ok) {
      const boosts: any[] = await dexRes.json();
      for (const b of (boosts || []).slice(0, 50)) {
        const sym = (b.tokenAddress || b.url || '').split('/').pop()?.slice(0, 8).toUpperCase() || 'UNK';
        // Avoid duplicates by symbol
        const exists = results.find(r => r.symbol === (b.symbol || sym));
        if (exists) continue;
        results.push({
          name: b.description || b.symbol || sym,
          symbol: b.symbol || sym,
          price: 0,
          change24h: 0,
          volume24h: 0,
          marketCap: 0,
          logo: b.icon || b.header || fmtLogoFallback(b.symbol || sym),
          chain: b.chainId || 'unknown',
          source: 'dexscreener',
          address: b.tokenAddress,
          dexChain: b.chainId,
        });
      }
    }
  } catch {}

  // Sort: CoinGecko items by volume first
  const sorted = results
    .filter(t => t.source === 'coingecko')
    .sort((a, b) => b.volume24h - a.volume24h)
    .concat(results.filter(t => t.source !== 'coingecko'));

  setCache(key, sorted);
  return sorted;
}

async function fetchLaunches(): Promise<MarketToken[]> {
  const key = 'launches';
  const hit = cached(key);
  if (hit) return hit;

  const results: MarketToken[] = [];

  // pump.fun new coins
  try {
    const newRes = await fetch(
      'https://frontend-api.pump.fun/coins?sort=created_timestamp&order=DESC&limit=50',
      { next: { revalidate: 30 } }
    );
    if (newRes.ok) {
      const coins: any[] = await newRes.json();
      for (const c of (coins || [])) {
        results.push({
          name: c.name || c.symbol,
          symbol: (c.symbol || '').toUpperCase(),
          price: c.usd_market_cap && c.total_supply ? c.usd_market_cap / c.total_supply : 0,
          change24h: 0,
          volume24h: 0,
          marketCap: c.usd_market_cap ?? 0,
          logo: c.image_uri || c.metadata_uri || fmtLogoFallback(c.symbol || 'NEW'),
          chain: 'sol',
          source: 'pumpfun',
          address: c.mint,
        });
      }
    }
  } catch {}

  // PumpSwap graduated coins
  try {
    const gradRes = await fetch(
      'https://frontend-api.pump.fun/coins?sort=last_trade_timestamp&order=DESC&limit=30&complete=true',
      { next: { revalidate: 30 } }
    );
    if (gradRes.ok) {
      const coins: any[] = await gradRes.json();
      for (const c of (coins || [])) {
        const exists = results.find(r => r.address === c.mint);
        if (exists) { exists.source = 'pumpswap'; continue; }
        results.push({
          name: c.name || c.symbol,
          symbol: (c.symbol || '').toUpperCase(),
          price: c.usd_market_cap && c.total_supply ? c.usd_market_cap / c.total_supply : 0,
          change24h: 0,
          volume24h: 0,
          marketCap: c.usd_market_cap ?? 0,
          logo: c.image_uri || fmtLogoFallback(c.symbol || 'GRAD'),
          chain: 'sol',
          source: 'pumpswap',
          address: c.mint,
        });
      }
    }
  } catch {}

  setCache(key, results);
  return results;
}

async function fetchCex(): Promise<MarketToken[]> {
  const key = 'cex';
  const hit = cached(key);
  if (hit) return hit;

  const results: MarketToken[] = [];

  // Binance top 50 by quoteVolume
  try {
    const binRes = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
      next: { revalidate: 30 },
    });
    if (binRes.ok) {
      const tickers: any[] = await binRes.json();
      const usdt = tickers
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 50);
      for (const t of usdt) {
        const sym = t.symbol.replace('USDT', '');
        results.push({
          name: sym,
          symbol: sym,
          price: parseFloat(t.lastPrice) || 0,
          change24h: parseFloat(t.priceChangePercent) || 0,
          volume24h: parseFloat(t.quoteVolume) || 0,
          marketCap: 0,
          logo: fmtLogoFallback(sym),
          chain: 'cex',
          source: 'binance',
          address: t.symbol,
        });
      }
    }
  } catch {}

  // OKX top 50 by volCcy24h
  try {
    const okxRes = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {
      next: { revalidate: 30 },
    });
    if (okxRes.ok) {
      const okxData = await okxRes.json();
      const tickers: any[] = okxData?.data || [];
      const usdt = tickers
        .filter((t: any) => t.instId.endsWith('-USDT'))
        .sort((a: any, b: any) => parseFloat(b.volCcy24h) - parseFloat(a.volCcy24h))
        .slice(0, 50);
      for (const t of usdt) {
        const sym = t.instId.replace('-USDT', '');
        // Avoid duplicates from Binance
        const exists = results.find(r => r.symbol === sym);
        if (exists) continue;
        results.push({
          name: sym,
          symbol: sym,
          price: parseFloat(t.last) || 0,
          change24h: t.open24h && t.last
            ? ((parseFloat(t.last) - parseFloat(t.open24h)) / parseFloat(t.open24h)) * 100
            : 0,
          volume24h: parseFloat(t.volCcy24h) || 0,
          marketCap: 0,
          logo: fmtLogoFallback(sym),
          chain: 'cex',
          source: 'okx',
          address: t.instId,
        });
      }
    }
  } catch {}

  const sorted = results.sort((a, b) => b.volume24h - a.volume24h);
  setCache(key, sorted);
  return sorted;
}

async function fetchAll(chain: string): Promise<MarketToken[]> {
  const key = `all_${chain}`;
  const hit = cached(key);
  if (hit) return hit;

  const [trending, launches, cex] = await Promise.allSettled([
    fetchTrending(),
    fetchLaunches(),
    fetchCex(),
  ]);

  let all: MarketToken[] = [];
  if (trending.status === 'fulfilled') all = all.concat(trending.value);
  if (launches.status === 'fulfilled') all = all.concat(launches.value);
  if (cex.status === 'fulfilled') all = all.concat(cex.value);

  // Deduplicate by symbol+source
  const seen = new Set<string>();
  const deduped = all.filter(t => {
    const dedupeKey = `${t.symbol}__${t.source}`;
    if (seen.has(dedupeKey)) return false;
    seen.add(dedupeKey);
    return true;
  });

  let filtered = deduped;
  if (chain && chain !== 'all') {
    filtered = deduped.filter(t => t.chain.toLowerCase() === chain.toLowerCase());
  }

  setCache(key, filtered);
  return filtered;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get('tab') || 'trending';
    const chain = searchParams.get('chain') || 'all';

    let tokens: MarketToken[] = [];

    switch (tab) {
      case 'trending':
        tokens = await fetchTrending();
        break;
      case 'launches':
        tokens = await fetchLaunches();
        break;
      case 'cex':
        tokens = await fetchCex();
        break;
      case 'all':
      default:
        tokens = await fetchAll(chain);
        break;
    }

    // Apply chain filter (except for 'all' tab which handles it internally)
    if (chain && chain !== 'all' && tab !== 'all') {
      tokens = tokens.filter(t => t.chain.toLowerCase() === chain.toLowerCase());
    }

    return NextResponse.json(
      { tokens, tab, chain, total: tokens.length, timestamp: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('Market API error:', error);
    return NextResponse.json({ error: 'Failed to fetch market data', tokens: [] }, { status: 500 });
  }
}
