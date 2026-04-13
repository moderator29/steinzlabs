import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SearchResult {
  id: string;
  name: string;
  symbol: string;
  thumb?: string;
  price?: number;
  change24h?: number;
  marketCap?: number;
  chain?: string;
  source: 'coingecko' | 'dexscreener' | 'birdeye' | 'alchemy';
  pairAddress?: string;
  contractAddress?: string;
}

const CG_BASE = 'https://api.coingecko.com/api/v3';

function cgHeaders(): Record<string, string> {
  return process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : {};
}

async function searchCoinGecko(q: string): Promise<SearchResult[]> {
  const res = await fetch(`${CG_BASE}/search?query=${encodeURIComponent(q)}`, {
    headers: cgHeaders(),
    next: { revalidate: 60 },
  } as RequestInit);
  if (!res.ok) return [];
  const data = await res.json() as {
    coins: { id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }[];
  };
  return (data.coins ?? []).slice(0, 20).map(c => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol?.toUpperCase() ?? '',
    thumb: c.thumb,
    source: 'coingecko' as const,
  }));
}

async function searchDexScreener(q: string): Promise<SearchResult[]> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, {
    next: { revalidate: 30 },
  } as RequestInit);
  if (!res.ok) return [];
  const data = await res.json() as {
    pairs?: {
      chainId: string;
      pairAddress: string;
      baseToken: { address: string; name: string; symbol: string };
      priceUsd?: string;
      priceChange?: { h24?: number };
      liquidity?: { usd?: number };
      volume?: { h24?: number };
    }[];
  };
  const pairs = data.pairs ?? [];
  return pairs.slice(0, 15).map(p => ({
    id: p.baseToken.address || p.pairAddress,
    name: p.baseToken.name,
    symbol: p.baseToken.symbol?.toUpperCase() ?? '',
    price: parseFloat(p.priceUsd ?? '0') || 0,
    change24h: p.priceChange?.h24 ?? 0,
    marketCap: p.liquidity?.usd ?? 0,
    chain: p.chainId,
    source: 'dexscreener' as const,
    pairAddress: p.pairAddress,
    contractAddress: p.baseToken.address,
  }));
}

async function searchBirdeye(q: string): Promise<SearchResult[]> {
  if (!process.env.BIRDEYE_API_KEY) return [];
  const url = `https://public-api.birdeye.so/defi/tokenlist?search_address=${encodeURIComponent(q)}&sort_by=v24hUSD&sort_type=desc&offset=0&limit=20&min_liquidity=100`;
  const res = await fetch(url, {
    headers: { 'X-API-KEY': process.env.BIRDEYE_API_KEY },
    next: { revalidate: 30 },
  } as RequestInit);
  if (!res.ok) return [];
  const data = await res.json() as {
    data?: {
      tokens?: {
        address: string;
        name: string;
        symbol: string;
        logoURI?: string;
        price?: number;
        priceChange24h?: number;
        mc?: number;
      }[];
    };
  };
  return (data.data?.tokens ?? []).map(t => ({
    id: t.address,
    name: t.name,
    symbol: t.symbol?.toUpperCase() ?? '',
    thumb: t.logoURI,
    price: t.price ?? 0,
    change24h: t.priceChange24h ?? 0,
    marketCap: t.mc ?? 0,
    chain: 'solana',
    source: 'birdeye' as const,
    contractAddress: t.address,
  }));
}

async function searchAlchemy(address: string): Promise<SearchResult[]> {
  if (!process.env.ALCHEMY_API_KEY) return [];
  const url = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}/getTokenMetadata?contractAddress=${address}`;
  const res = await fetch(url, { next: { revalidate: 300 } } as RequestInit);
  if (!res.ok) return [];
  const data = await res.json() as {
    result?: { name?: string; symbol?: string; logo?: string; decimals?: number };
    error?: unknown;
  };
  if (!data.result || data.error) return [];
  const r = data.result;
  if (!r.name && !r.symbol) return [];
  return [{
    id: address,
    name: r.name ?? address,
    symbol: (r.symbol ?? '').toUpperCase(),
    thumb: r.logo ?? undefined,
    chain: 'ethereum',
    source: 'alchemy' as const,
    contractAddress: address,
  }];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json([]);

  const isContractAddress = q.startsWith('0x') && q.length === 42;

  const tasks: Promise<SearchResult[]>[] = [
    searchCoinGecko(q).catch(() => []),
    searchDexScreener(q).catch(() => []),
    searchBirdeye(q).catch(() => []),
  ];
  if (isContractAddress) {
    tasks.push(searchAlchemy(q).catch(() => []));
  }

  const settled = await Promise.allSettled(tasks);
  const allResults: SearchResult[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }

  // Deduplicate by symbol+name (case-insensitive)
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];
  for (const r of allResults) {
    const key = `${r.symbol.toLowerCase()}|${r.name.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  return NextResponse.json(deduped.slice(0, 30));
}
