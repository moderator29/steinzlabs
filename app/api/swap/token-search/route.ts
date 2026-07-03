import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

// Universal token search for the swap token selector. The selector's local
// list only covers ~26 curated symbols; this endpoint lets users find ANY
// token by name/symbol (Trust-Wallet-style) via DexScreener's keyless search
// API, mapped back to the swap page's chain ids. Address pastes stay on the
// existing /api/swap/token-meta path.
//
// Provider: GET https://api.dexscreener.com/latest/dex/search?q=<query>
// (free, no key, all major EVM chains + Solana). Results are deduped by
// (chain, base token address) keeping the highest-liquidity pair so the list
// is real tradeable tokens, not one row per pool.

const DS_CHAIN_TO_SWAP: Record<string, string> = {
  ethereum: 'ethereum',
  base: 'base',
  solana: 'solana',
  bsc: 'bsc',
  polygon: 'polygon',
  avalanche: 'avalanche',
  arbitrum: 'arbitrum',
};

interface DsPair {
  chainId?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceUsd?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  info?: { imageUrl?: string };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const chainFilter = (searchParams.get('chain') || '').toLowerCase();
  if (q.length < 2) {
    return NextResponse.json({ tokens: [] });
  }
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) {
      return NextResponse.json({ tokens: [], error: 'search_upstream_unavailable' }, { status: 502 });
    }
    const data = (await res.json()) as { pairs?: DsPair[] };
    const best = new Map<string, { chain: string; address: string; symbol: string; name: string; logo: string | null; liquidityUsd: number; volume24hUsd: number; priceUsd: number | null }>();
    for (const p of data.pairs ?? []) {
      const chain = DS_CHAIN_TO_SWAP[(p.chainId || '').toLowerCase()];
      const addr = p.baseToken?.address;
      const symbol = p.baseToken?.symbol;
      if (!chain || !addr || !symbol) continue;
      if (chainFilter && chain !== chainFilter) continue;
      const key = `${chain}:${addr.toLowerCase()}`;
      const liq = p.liquidity?.usd ?? 0;
      const existing = best.get(key);
      if (existing && existing.liquidityUsd >= liq) continue;
      best.set(key, {
        chain,
        address: addr,
        symbol,
        name: p.baseToken?.name || symbol,
        logo: p.info?.imageUrl ?? null,
        liquidityUsd: liq,
        volume24hUsd: p.volume?.h24 ?? 0,
        priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
      });
    }
    const tokens = Array.from(best.values())
      .sort((a, b) => b.liquidityUsd - a.liquidityUsd)
      .slice(0, 20);
    return NextResponse.json(
      { tokens },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch {
    return NextResponse.json({ tokens: [], error: 'search_failed' }, { status: 502 });
  }
}
