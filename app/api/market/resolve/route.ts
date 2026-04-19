import { NextResponse } from 'next/server';
import { searchTokens, getContractPrice, getTokenDetail } from '@/lib/services/coingecko';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Smart search for the Market page. Accepts a raw query and figures out
// whether the user pasted a contract address or typed a ticker / name.
//
//   EVM address   — 0x + 40 hex chars. We probe every supported chain via
//                   CoinGecko's /simple/token_price/{platform}; first hit
//                   with a non-zero price wins.
//   Solana addr   — base58, 32–44 chars. Resolves against the solana
//                   platform.
//   Anything else — treated as a ticker/name and passed to /search.
//
// Response:
//   { kind: "contract" | "ticker", matches: [ {...} ] }
//
// Matches include enough metadata for the Market page to show a result
// card and link into the terminal at /dashboard/market/{chain}/{idOrAddr}.

interface ResolvedMatch {
  id: string | null;         // CoinGecko id if known, else null
  name: string;
  symbol: string;
  image: string | null;
  chain: string;             // Naka-facing chain id (ethereum, solana, bsc, ...)
  address: string | null;    // contract address if kind=contract
  priceUsd: number;
}

const EVM_PLATFORMS: { chain: string; slug: string }[] = [
  { chain: 'ethereum', slug: 'ethereum' },
  { chain: 'bsc', slug: 'binance-smart-chain' },
  { chain: 'polygon', slug: 'polygon-pos' },
  { chain: 'base', slug: 'base' },
  { chain: 'arbitrum', slug: 'arbitrum-one' },
  { chain: 'optimism', slug: 'optimistic-ethereum' },
  { chain: 'avalanche', slug: 'avalanche' },
];

function isEvmAddress(q: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(q);
}

function isSolanaAddress(q: string): boolean {
  // Base58, 32–44 chars, no 0/O/I/l
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q) && !q.startsWith('0x');
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json({ kind: 'ticker', matches: [] });

  // ─── Contract address path ────────────────────────────────────────────
  if (isEvmAddress(q)) {
    const matches: ResolvedMatch[] = [];
    await Promise.all(EVM_PLATFORMS.map(async ({ chain }) => {
      try {
        const price = await getContractPrice(q, chain);
        if (price > 0) {
          matches.push({
            id: null,
            name: `${chain.toUpperCase()} token`,
            symbol: q.slice(0, 6) + '…',
            image: null,
            chain,
            address: q,
            priceUsd: price,
          });
        }
      } catch { /* chain miss, ignore */ }
    }));
    return NextResponse.json({ kind: 'contract', matches }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  }

  if (isSolanaAddress(q)) {
    try {
      const price = await getContractPrice(q, 'solana');
      if (price > 0) {
        return NextResponse.json({
          kind: 'contract',
          matches: [{
            id: null,
            name: 'Solana token',
            symbol: q.slice(0, 6) + '…',
            image: null,
            chain: 'solana',
            address: q,
            priceUsd: price,
          }],
        });
      }
    } catch { /* no-op */ }
    return NextResponse.json({ kind: 'contract', matches: [] });
  }

  // ─── Ticker / name path ───────────────────────────────────────────────
  try {
    const result = await searchTokens(q);
    const topMatches = (result.coins ?? []).slice(0, 8);
    // Enrich the first match with a live price so the UI can render a
    // price pill alongside the result without waiting for a second call.
    let priceUsd = 0;
    if (topMatches[0]) {
      try {
        const detail = await getTokenDetail(topMatches[0].id);
        priceUsd = detail.market_data?.current_price?.usd ?? 0;
      } catch { /* ignore */ }
    }
    const matches: ResolvedMatch[] = topMatches.map((c, i) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      image: c.thumb,
      chain: 'ethereum', // router will pick the right chain on click
      address: null,
      priceUsd: i === 0 ? priceUsd : 0,
    }));
    return NextResponse.json({ kind: 'ticker', matches }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  } catch (err) {
    console.error('[market/resolve]', err);
    return NextResponse.json({ kind: 'ticker', matches: [] }, { status: 502 });
  }
}
