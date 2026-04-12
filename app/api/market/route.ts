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

// ── Timeout-safe fetch ────────────────────────────────────────────────────────
function fetchWithTimeout(url: string, opts: RequestInit & { next?: any } = {}, ms = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(timer));
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

// CoinGecko ID → logo URL (no API key needed, static CDN)
const COINGECKO_LOGOS: Record<string, string> = {
  BTC: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  ETH: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  BNB: 'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  XRP: 'https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png',
  SOL: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  USDT: 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  USDC: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  ADA: 'https://assets.coingecko.com/coins/images/975/small/cardano.png',
  DOGE: 'https://assets.coingecko.com/coins/images/5/small/dogecoin.png',
  TRX: 'https://assets.coingecko.com/coins/images/1094/small/tron-logo.png',
  TON: 'https://assets.coingecko.com/coins/images/17980/small/ton_symbol.png',
  AVAX: 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  MATIC: 'https://assets.coingecko.com/coins/images/4713/small/polygon.png',
  LINK: 'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  DOT: 'https://assets.coingecko.com/coins/images/12171/small/polkadot.png',
  SHIB: 'https://assets.coingecko.com/coins/images/11939/small/shiba.png',
  UNI: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  LTC: 'https://assets.coingecko.com/coins/images/2/small/litecoin.png',
  BCH: 'https://assets.coingecko.com/coins/images/780/small/bitcoin-cash-circle.png',
  NEAR: 'https://assets.coingecko.com/coins/images/10365/small/near.jpg',
  APT: 'https://assets.coingecko.com/coins/images/26455/small/aptos_round.png',
  ARB: 'https://assets.coingecko.com/coins/images/16547/small/arb.jpg',
  OP: 'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  ATOM: 'https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png',
  XLM: 'https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png',
  FIL: 'https://assets.coingecko.com/coins/images/12817/small/filecoin.png',
  HBAR: 'https://assets.coingecko.com/coins/images/3688/small/hbar.png',
  ICP: 'https://assets.coingecko.com/coins/images/14495/small/Internet_Computer_logo.png',
  VET: 'https://assets.coingecko.com/coins/images/1167/small/VeChain-Logo-768x725.png',
  ALGO: 'https://assets.coingecko.com/coins/images/4380/small/download.png',
  AAVE: 'https://assets.coingecko.com/coins/images/12645/small/aave-token-round.png',
  MKR: 'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
  PEPE: 'https://assets.coingecko.com/coins/images/29850/small/pepe-token.jpeg',
  WIF: 'https://assets.coingecko.com/coins/images/33566/small/dogwifhat.jpg',
  BONK: 'https://assets.coingecko.com/coins/images/28600/small/bonk.jpg',
  JUP: 'https://assets.coingecko.com/coins/images/34188/small/jup.png',
  RAY: 'https://assets.coingecko.com/coins/images/13928/small/PSigc4ie_400x400.jpg',
  WBTC: 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
};

// Binance symbol → full name
const BINANCE_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', BNB: 'BNB', XRP: 'XRP', SOL: 'Solana',
  USDT: 'Tether', USDC: 'USD Coin', ADA: 'Cardano', DOGE: 'Dogecoin', TRX: 'TRON',
  TON: 'Toncoin', AVAX: 'Avalanche', MATIC: 'Polygon', LINK: 'Chainlink',
  DOT: 'Polkadot', SHIB: 'Shiba Inu', UNI: 'Uniswap', LTC: 'Litecoin',
  BCH: 'Bitcoin Cash', NEAR: 'NEAR Protocol', APT: 'Aptos', ARB: 'Arbitrum',
  OP: 'Optimism', ATOM: 'Cosmos', XLM: 'Stellar', FIL: 'Filecoin',
  HBAR: 'Hedera', ICP: 'Internet Computer', VET: 'VeChain', ALGO: 'Algorand',
  AAVE: 'Aave', MKR: 'Maker', PEPE: 'Pepe', WIF: 'dogwifhat', BONK: 'Bonk',
  JUP: 'Jupiter', RAY: 'Raydium', WBTC: 'Wrapped Bitcoin',
};

async function fetchTrending(): Promise<MarketToken[]> {
  const key = 'trending';
  const hit = cached(key);
  if (hit) return hit;

  const results: MarketToken[] = [];

  // PRIMARY: Binance 24hr ticker (no API key, always works, real data)
  try {
    const binRes = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr', {
      next: { revalidate: 30 },
    }, 6000);
    if (binRes.ok) {
      const tickers: any[] = await binRes.json();
      const usdt = tickers
        .filter((t: any) => t.symbol.endsWith('USDT'))
        .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, 100);
      for (const t of usdt) {
        const sym = t.symbol.replace('USDT', '');
        results.push({
          name: BINANCE_NAMES[sym] || sym,
          symbol: sym,
          price: parseFloat(t.lastPrice) || 0,
          change24h: parseFloat(t.priceChangePercent) || 0,
          volume24h: parseFloat(t.quoteVolume) || 0,
          marketCap: 0,
          logo: COINGECKO_LOGOS[sym] || fmtLogoFallback(sym),
          chain: 'multi',
          source: 'binance',
          address: sym.toLowerCase(),
        });
      }
    }
  } catch {}

  // SECONDARY: CoinGecko for market cap data (enriches Binance results)
  try {
    const cgRes = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&sparkline=false',
      {
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
          : {},
        next: { revalidate: 60 },
      },
      6000
    );
    if (cgRes.ok) {
      const coins: any[] = await cgRes.json();
      for (const c of coins) {
        const existing = results.find(r => r.symbol === c.symbol.toUpperCase());
        if (existing) {
          // Enrich with CoinGecko data (mcap, better logo, address)
          existing.marketCap = c.market_cap ?? 0;
          existing.name = c.name;
          existing.logo = c.image || existing.logo;
          existing.address = c.id;
          existing.source = 'coingecko';
        } else {
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
    }
  } catch {}

  // Sort by volume (most liquid first)
  const sorted = results.sort((a, b) => b.volume24h - a.volume24h);
  setCache(key, sorted);
  return sorted;
}

async function fetchLaunches(): Promise<MarketToken[]> {
  const key = 'launches';
  const hit = cached(key);
  if (hit) return hit;

  const results: MarketToken[] = [];

  // pump.fun + pumpswap via DexScreener (reliable, replaces unstable pump.fun direct APIs)
  try {
    const dexRes = await fetchWithTimeout(
      'https://api.dexscreener.com/latest/dex/search?q=pump',
      { cache: 'no-store' },
      5000
    );
    if (dexRes.ok) {
      const dexData = await dexRes.json();
      const solanaPumpPairs = (dexData.pairs || [])
        .filter((p: any) => p.chainId === 'solana' && (p.dexId === 'pump' || p.dexId === 'raydium'))
        .sort((a: any, b: any) => (parseFloat(b.volume?.h24 || 0)) - (parseFloat(a.volume?.h24 || 0)))
        .slice(0, 50);
      for (const p of solanaPumpPairs) {
        const isPumpSwap = p.dexId === 'raydium';
        results.push({
          name: p.baseToken?.name || p.baseToken?.symbol || 'Unknown',
          symbol: (p.baseToken?.symbol || '').toUpperCase(),
          price: parseFloat(p.priceUsd || '0'),
          change24h: p.priceChange?.h24 || 0,
          volume24h: p.volume?.h24 || 0,
          marketCap: p.fdv || 0,
          logo: p.info?.imageUrl || fmtLogoFallback(p.baseToken?.symbol || 'NEW'),
          chain: 'sol',
          source: isPumpSwap ? 'pumpswap' : 'pumpfun',
          address: p.baseToken?.address || '',
          pairAddress: p.pairAddress,
          liquidity: p.liquidity?.usd || 0,
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
    const binRes = await fetchWithTimeout('https://api.binance.com/api/v3/ticker/24hr', {
      next: { revalidate: 30 },
    }, 6000);
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
    const okxRes = await fetchWithTimeout('https://www.okx.com/api/v5/market/tickers?instType=SPOT', {
      next: { revalidate: 30 },
    }, 5000);
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

    return NextResponse.json({ error: 'Failed to fetch market data', tokens: [] }, { status: 500 });
  }
}
