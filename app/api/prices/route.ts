import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTopTokens, getTokenPrice } from '@/lib/services/coingecko';
import { searchPairs, getBestPair } from '@/lib/services/dexscreener';

// ─── Constants ────────────────────────────────────────────────────────────────

const TOP_SYMBOLS = [
  'BTC','ETH','SOL','BNB','XRP','ADA','DOGE','AVAX','DOT','LINK',
  'UNI','NEAR','APT','ARB','OP','ATOM','LTC','SHIB','TRX','TON',
  'INJ','SUI','PEPE','WIF','BONK','JUP','RAY','AAVE','MKR','GRT',
];

// CoinGecko IDs for the top symbols (used in fallback)
const SYMBOL_TO_CG_ID: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', BNB: 'binancecoin',
  XRP: 'ripple', ADA: 'cardano', DOGE: 'dogecoin', AVAX: 'avalanche-2',
  DOT: 'polkadot', LINK: 'chainlink', UNI: 'uniswap', NEAR: 'near',
  APT: 'aptos', ARB: 'arbitrum', OP: 'optimism', ATOM: 'cosmos',
  LTC: 'litecoin', SHIB: 'shiba-inu', TRX: 'tron', TON: 'toncoin',
  INJ: 'injective', SUI: 'sui', PEPE: 'pepe', WIF: 'dogwifcoin',
  BONK: 'bonk', JUP: 'jupiter-ag', RAY: 'raydium', AAVE: 'aave',
  MKR: 'maker', GRT: 'the-graph',
};

const CG_TO_SYMBOL: Record<string, string> = Object.fromEntries(
  Object.entries(SYMBOL_TO_CG_ID).map(([sym, id]) => [id, sym])
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriceEntry {
  price: number;
  change24h: number;
  volume24h: number;
  name: string;
  symbol?: string;
  address?: string;
  chain?: string;
  liquidity?: number;
  fdv?: number;
}

// ─── Price Fetchers ───────────────────────────────────────────────────────────

/** Fetch top 50 market tokens from CoinGecko service and index by symbol. */
async function getAllPricesBySymbol(): Promise<Record<string, PriceEntry>> {
  try {
    const coins = await getTopTokens(1, 50);
    const map: Record<string, PriceEntry> = {};
    for (const c of coins) {
      const sym = c.symbol.toUpperCase();
      map[sym] = {
        price: c.current_price,
        change24h: c.price_change_percentage_24h ?? 0,
        volume24h: c.total_volume,
        name: c.name,
      };
    }
    return map;
  } catch {
    return {};
  }
}

/** Lookup a DEX token by contract address using DexScreener service. */
async function getDexPrice(address: string): Promise<PriceEntry | null> {
  try {
    const pair = await getBestPair(address);
    if (!pair) return null;
    return {
      price: parseFloat(pair.priceUsd || '0'),
      change24h: pair.priceChange?.h24 ?? 0,
      volume24h: pair.volume?.h24 ?? 0,
      name: pair.baseToken?.name || address,
      symbol: pair.baseToken?.symbol,
      address: pair.baseToken?.address,
      chain: pair.chainId,
      liquidity: pair.liquidity?.usd ?? 0,
      fdv: pair.fdv ?? 0,
    };
  } catch {
    return null;
  }
}

/** Lookup by symbol using DexScreener search when not in CoinGecko map. */
async function getDexPriceBySymbol(symbol: string): Promise<PriceEntry | null> {
  try {
    const pairs = await searchPairs(symbol);
    const top = pairs[0];
    if (!top) return null;
    return {
      price: parseFloat(top.priceUsd || '0'),
      change24h: top.priceChange?.h24 ?? 0,
      volume24h: top.volume?.h24 ?? 0,
      name: top.baseToken?.name || symbol,
      symbol: top.baseToken?.symbol,
      chain: top.chainId,
    };
  } catch {
    return null;
  }
}

// ─── GET Handler ──────────────────────────────────────────────────────────────

const CACHE_HEADERS = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' };

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids');
  const symbols = searchParams.get('symbols');
  const address = searchParams.get('address');

  // Single contract address lookup via DexScreener
  if (address) {
    const entry = await getDexPrice(address);
    if (entry) return NextResponse.json({ [address]: entry }, { headers: CACHE_HEADERS });
    return NextResponse.json({}, { status: 404 });
  }

  // Get full price map from CoinGecko (cached by service layer)
  const priceMap = await getAllPricesBySymbol();

  // Symbol lookup (e.g. ?symbols=BTC,ETH,SOL)
  if (symbols) {
    const symList = symbols.split(',').map(s => s.trim().toUpperCase());
    const result: Record<string, PriceEntry> = {};
    await Promise.all(symList.map(async sym => {
      if (priceMap[sym]) {
        result[sym] = priceMap[sym];
      } else {
        const dex = await getDexPriceBySymbol(sym);
        if (dex) result[sym] = dex;
      }
    }));
    return NextResponse.json(result, { headers: CACHE_HEADERS });
  }

  // CoinGecko ID lookup (e.g. ?ids=bitcoin,ethereum,solana)
  if (ids) {
    const idList = ids.split(',').map(id => id.trim().toLowerCase());
    const result: Record<string, { usd: number; usd_24h_change: number; usd_24h_vol: number }> = {};
    await Promise.all(idList.map(async id => {
      const sym = CG_TO_SYMBOL[id];
      if (sym && priceMap[sym]) {
        result[id] = { usd: priceMap[sym].price, usd_24h_change: priceMap[sym].change24h, usd_24h_vol: priceMap[sym].volume24h };
      } else {
        const price = await getTokenPrice(id).catch(() => 0);
        if (price > 0) result[id] = { usd: price, usd_24h_change: 0, usd_24h_vol: 0 };
      }
    }));
    return NextResponse.json({ prices: result }, { headers: CACHE_HEADERS });
  }

  // Default: return top coins by symbol
  const result: Record<string, PriceEntry> = {};
  for (const sym of TOP_SYMBOLS) {
    if (priceMap[sym]) result[sym] = priceMap[sym];
  }
  return NextResponse.json(result, { headers: CACHE_HEADERS });
}
