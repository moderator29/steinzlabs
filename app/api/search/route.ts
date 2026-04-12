import 'server-only';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTokenPairs, searchPairs } from '@/lib/services/dexscreener';
import type { DexPair } from '@/lib/services/dexscreener';

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
    const pairs: DexPair[] = isAddress
      ? await getTokenPairs(query)
      : await searchPairs(query);

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
  } catch {
    return NextResponse.json(
      { results: [], error: 'Search unavailable' },
      { status: 200 }
    );
  }
}
