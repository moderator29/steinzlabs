import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { resolveCoin } from '@/lib/coins/coinService';
import { universalSearch } from '@/lib/search/universalSearch';
import { isCoinChain } from '@/lib/coins/types';

export const dynamic = 'force-dynamic';

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOL_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Resolve a coin reference from a ticker or contract address, for coin cards in
 * The Wire and Groups. Returns a minimal coin or null. Real data only.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const chainHint = req.nextUrl.searchParams.get('chain') || undefined;
  if (!q) return NextResponse.json({ coin: null });

  // Contract address: resolve directly on the matching chain(s).
  if (EVM_RE.test(q) || SOL_RE.test(q)) {
    const chains = chainHint && isCoinChain(chainHint) ? [chainHint] : EVM_RE.test(q) ? ['ethereum', 'bsc'] : ['solana'];
    for (const c of chains) {
      const coin = await resolveCoin(c, q).catch(() => null);
      if (coin) return NextResponse.json({ coin: minimal(coin) });
    }
    return NextResponse.json({ coin: null });
  }

  // Ticker: best graduated match by volume across our chains.
  const sym = q.replace(/^\$/, '').toUpperCase();
  try {
    const results = await universalSearch(sym);
    const best = results
      .filter((r) => isCoinChain(r.chain) && r.symbol?.toUpperCase() === sym)
      .filter((r) => (r.liquidityUSD ?? r.liquidity ?? 0) >= 1000 || (r.marketCap ?? 0) > 0)
      .sort((a, b) => (b.volumeUSD ?? 0) - (a.volumeUSD ?? 0))[0];
    if (!best) return NextResponse.json({ coin: null });
    return NextResponse.json({
      coin: {
        chain: best.chain, tokenAddress: best.address, symbol: best.symbol, name: best.name,
        logoUrl: best.logo ?? null, priceUsd: best.priceUSD ?? best.price ?? null,
        marketCapUsd: best.marketCap ?? null, change24h: best.priceChange24h ?? null,
        verified: !!best.verified,
      },
    });
  } catch {
    return NextResponse.json({ coin: null });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function minimal(c: any) {
  return { chain: c.chain, tokenAddress: c.tokenAddress, symbol: c.symbol, name: c.name, logoUrl: c.logoUrl, priceUsd: c.priceUsd, marketCapUsd: c.marketCapUsd, change24h: c.change24h, verified: c.verified };
}
