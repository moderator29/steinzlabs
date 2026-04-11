import { NextRequest, NextResponse } from 'next/server';

// CoinGecko ID → Binance symbol mapping
const CG_TO_BINANCE: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB',
  ripple: 'XRP', cardano: 'ADA', dogecoin: 'DOGE', 'avalanche-2': 'AVAX',
  polkadot: 'DOT', chainlink: 'LINK', uniswap: 'UNI', near: 'NEAR',
  aptos: 'APT', arbitrum: 'ARB', optimism: 'OP', cosmos: 'ATOM',
  litecoin: 'LTC', 'bitcoin-cash': 'BCH', stellar: 'XLM', filecoin: 'FIL',
  'hedera-hashgraph': 'HBAR', 'internet-computer': 'ICP', vechain: 'VET',
  algorand: 'ALGO', aave: 'AAVE', maker: 'MKR', pepe: 'PEPE',
  dogwifcoin: 'WIF', bonk: 'BONK', 'jupiter-ag': 'JUP', raydium: 'RAY',
  'wrapped-bitcoin': 'WBTC', tron: 'TRX', toncoin: 'TON', shiba: 'SHIB',
  'shiba-inu': 'SHIB', injective: 'INJ', sui: 'SUI', 'ondo-finance': 'ONDO',
  'render-token': 'RENDER', 'fetch-ai': 'FET', worldcoin: 'WLD',
  'the-graph': 'GRT', 'curve-dao-token': 'CRV', compound: 'COMP',
};

const BINANCE_NAMES: Record<string, string> = {
  BTC: 'Bitcoin', ETH: 'Ethereum', SOL: 'Solana', BNB: 'BNB', XRP: 'XRP',
  ADA: 'Cardano', DOGE: 'Dogecoin', AVAX: 'Avalanche', DOT: 'Polkadot',
  LINK: 'Chainlink', UNI: 'Uniswap', NEAR: 'NEAR Protocol', APT: 'Aptos',
  ARB: 'Arbitrum', OP: 'Optimism', ATOM: 'Cosmos', LTC: 'Litecoin',
  BCH: 'Bitcoin Cash', XLM: 'Stellar', HBAR: 'Hedera', ICP: 'Internet Computer',
  ALGO: 'Algorand', AAVE: 'Aave', MKR: 'Maker', PEPE: 'Pepe',
  WIF: 'dogwifhat', BONK: 'Bonk', JUP: 'Jupiter', RAY: 'Raydium',
  TRX: 'TRON', TON: 'Toncoin', SHIB: 'Shiba Inu', INJ: 'Injective',
  SUI: 'Sui', RENDER: 'Render', WLD: 'Worldcoin', GRT: 'The Graph',
};

// In-memory cache for Binance prices (30s TTL)
let binanceCache: { data: Record<string, any>; ts: number } | null = null;
const BINANCE_CACHE_TTL = 30_000;

async function getBinancePrices(): Promise<Record<string, any>> {
  if (binanceCache && Date.now() - binanceCache.ts < BINANCE_CACHE_TTL) {
    return binanceCache.data;
  }
  try {
    const res = await fetch('https://api.binance.com/api/v3/ticker/24hr', {
      cache: 'no-store',
    });
    if (!res.ok) return {};
    const tickers: any[] = await res.json();
    const priceMap: Record<string, any> = {};
    for (const t of tickers) {
      if (!t.symbol.endsWith('USDT')) continue;
      const sym = t.symbol.replace('USDT', '');
      priceMap[sym] = {
        price: parseFloat(t.lastPrice) || 0,
        change24h: parseFloat(t.priceChangePercent) || 0,
        volume24h: parseFloat(t.quoteVolume) || 0,
        name: BINANCE_NAMES[sym] || sym,
      };
    }
    binanceCache = { data: priceMap, ts: Date.now() };
    return priceMap;
  } catch {
    return {};
  }
}

async function getDexScreenerPrice(query: string): Promise<any | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pair = data.pairs?.[0];
    if (!pair) return null;
    return {
      price: parseFloat(pair.priceUsd) || 0,
      change24h: pair.priceChange?.h24 || 0,
      volume24h: pair.volume?.h24 || 0,
      name: pair.baseToken?.name || query,
      symbol: pair.baseToken?.symbol || query,
      address: pair.baseToken?.address,
      chain: pair.chainId,
      liquidity: pair.liquidity?.usd || 0,
      fdv: pair.fdv || 0,
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids');       // CoinGecko IDs (comma-separated)
  const symbols = searchParams.get('symbols'); // Binance symbols (comma-separated)
  const address = searchParams.get('address'); // Contract address for DEX token

  const binancePrices = await getBinancePrices();

  // Single contract address lookup via DexScreener
  if (address) {
    const dex = await getDexScreenerPrice(address);
    if (dex) {
      return NextResponse.json({ [address]: dex }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }
    return NextResponse.json({}, { status: 404 });
  }

  // Symbol lookup (e.g. ?symbols=BTC,ETH,SOL)
  if (symbols) {
    const symList = symbols.split(',').map(s => s.trim().toUpperCase());
    const result: Record<string, any> = {};
    for (const sym of symList) {
      if (binancePrices[sym]) {
        result[sym] = binancePrices[sym];
      } else {
        // Try DexScreener for unknown symbols
        const dex = await getDexScreenerPrice(sym);
        if (dex) result[sym] = dex;
      }
    }
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  // CoinGecko ID lookup (e.g. ?ids=bitcoin,ethereum,solana)
  if (ids) {
    const idList = ids.split(',').map(id => id.trim().toLowerCase());
    const result: Record<string, any> = {};

    // Map CoinGecko IDs → Binance symbols
    const unmapped: string[] = [];
    for (const id of idList) {
      const binSym = CG_TO_BINANCE[id];
      if (binSym && binancePrices[binSym]) {
        result[id] = {
          usd: binancePrices[binSym].price,
          usd_24h_change: binancePrices[binSym].change24h,
          usd_24h_vol: binancePrices[binSym].volume24h,
        };
      } else {
        unmapped.push(id);
      }
    }

    // Try CoinGecko for any unmapped IDs
    if (unmapped.length > 0) {
      try {
        const cgRes = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${unmapped.join(',')}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
          {
            headers: process.env.COINGECKO_API_KEY
              ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
              : {},
            cache: 'no-store',
          }
        );
        if (cgRes.ok) {
          const cgData = await cgRes.json();
          Object.assign(result, cgData);
        }
      } catch {}
    }

    return NextResponse.json({ prices: result }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  }

  // Default: return all Binance prices (top coins by symbol)
  const TOP_SYMBOLS = [
    'BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','LINK',
    'UNI','NEAR','APT','ARB','OP','ATOM','LTC','SHIB','TRX','TON',
    'INJ','SUI','PEPE','WIF','BONK','JUP','RAY','AAVE','MKR','GRT',
  ];
  const result: Record<string, any> = {};
  for (const sym of TOP_SYMBOLS) {
    if (binancePrices[sym]) {
      result[sym] = {
        price: binancePrices[sym].price,
        change24h: binancePrices[sym].change24h,
        name: binancePrices[sym].name,
        volume: binancePrices[sym].volume24h,
      };
    }
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  });
}
