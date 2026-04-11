import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DexToken {
  id: string;
  name: string;
  symbol: string;
  imageUri: string;
  contractAddress: string;
  chain: string;
  price: number;
  marketCap: number;
  liquidity: number;
  volume24h: number;
  volume5m: number;
  change24h: number;
  createdAt: number;
  fdv: number;
  supply: number;
  holders: number;
  dexUrl: string;
  pairAddress: string;
}

// ── Chain native symbol map ───────────────────────────────────────────────────

const NATIVE_SYMBOLS: Record<string, string> = {
  ethereum: 'WETH',
  solana: 'SOL',
  bsc: 'WBNB',
  base: 'WETH',
  polygon: 'WMATIC',
  avalanche: 'WAVAX',
  tron: 'TRX',
  arbitrum: 'WETH',
  ton: 'TON',
  optimism: 'WETH',
  fantom: 'FTM',
  sui: 'SUI',
};

// ── Per-chain in-memory cache (20s TTL) ───────────────────────────────────────

const cache: Record<string, { tokens: DexToken[]; ts: number }> = {};
const CACHE_TTL = 20_000;

// ── Normalise a DexScreener pair to DexToken ─────────────────────────────────

function normalisePair(pair: any): DexToken {
  return {
    id: pair.pairAddress,
    name: pair.baseToken?.name ?? 'Unknown',
    symbol: pair.baseToken?.symbol ?? '???',
    imageUri: pair.info?.imageUrl || '',
    contractAddress: pair.baseToken?.address ?? '',
    chain: pair.chainId ?? 'unknown',
    price: parseFloat(pair.priceUsd || '0'),
    marketCap: pair.marketCap || pair.fdv || 0,
    liquidity: pair.liquidity?.usd || 0,
    volume24h: pair.volume?.h24 || 0,
    volume5m: pair.volume?.m5 || 0,
    change24h: pair.priceChange?.h24 || 0,
    createdAt: pair.pairCreatedAt || Date.now(),
    fdv: pair.fdv || 0,
    supply: 0,
    holders: 0,
    dexUrl: pair.url || '',
    pairAddress: pair.pairAddress,
  };
}

async function fetchByChain(chain: string, limit: number): Promise<DexToken[]> {
  const nativeSymbol = NATIVE_SYMBOLS[chain] ?? 'WETH';
  const url = `https://api.dexscreener.com/latest/dex/search?q=${nativeSymbol}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 20 },
  });
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);

  const data = await res.json();
  const pairs: any[] = (data.pairs ?? [])
    .filter((p: any) => p.chainId === chain)
    .sort((a: any, b: any) => (b.pairCreatedAt || 0) - (a.pairCreatedAt || 0))
    .slice(0, limit);

  return pairs.map(normalisePair);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const chain = (req.nextUrl.searchParams.get('chain') || 'solana').toLowerCase();
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') || '50'), 100);

  // Serve from cache if fresh
  const cached = cache[chain];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({
      tokens: cached.tokens.slice(0, limit),
      chain,
      total: cached.tokens.slice(0, limit).length,
      cached: true,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const tokens = await fetchByChain(chain, limit);
    cache[chain] = { tokens, ts: Date.now() };

    return NextResponse.json({
      tokens,
      chain,
      total: tokens.length,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { tokens: [], chain, total: 0, error: err.message, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
