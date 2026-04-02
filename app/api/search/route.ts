import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

interface DexPair {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd?: string;
  volume?: { h24?: number; h6?: number; h1?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number };
  liquidity?: { usd?: number; base?: number; quote?: number };
  fdv?: number;
  marketCap?: number;
  txns?: { h24?: { buys?: number; sells?: number } };
}

interface SearchResult {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  liquidity: number;
  fdv: number;
  dexUrl: string;
  pairAddress: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query || query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    const isAddress = /^0x[a-fA-F0-9]{40}$/.test(query) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query);
    const endpoint = isAddress
      ? `https://api.dexscreener.com/latest/dex/tokens/${query}`
      : `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`;

    const res = await fetch(endpoint, {
      headers: { 'User-Agent': 'NakaLabs/1.0' },
      next: { revalidate: 30 },
    });

    if (!res.ok) {
      throw new Error(`DexScreener returned ${res.status}`);
    }

    const data = await res.json();
    const pairs: DexPair[] = data.pairs || [];

    const seen = new Set<string>();
    const results: SearchResult[] = [];

    for (const pair of pairs.slice(0, 50)) {
      const key = `${pair.chainId}:${pair.baseToken.address}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const priceUsd = parseFloat(pair.priceUsd || '0') || 0;

      results.push({
        symbol: pair.baseToken.symbol,
        name: pair.baseToken.name,
        address: pair.baseToken.address,
        chain: pair.chainId,
        price: pair.priceUsd ? `$${parseFloat(pair.priceUsd).toFixed(priceUsd >= 1 ? 2 : priceUsd >= 0.01 ? 4 : 8)}` : '--',
        priceUsd,
        change24h: pair.priceChange?.h24 ?? 0,
        volume24h: pair.volume?.h24 ?? 0,
        liquidity: pair.liquidity?.usd ?? 0,
        fdv: pair.fdv ?? 0,
        dexUrl: pair.url,
        pairAddress: pair.pairAddress,
      });

      if (results.length >= 20) break;
    }

    return NextResponse.json({ results, source: 'dexscreener' });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { results: [], error: 'Search unavailable' },
      { status: 200 }
    );
  }
}
