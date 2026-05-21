import { NextResponse } from 'next/server';
import { searchTokens, getContractPrice } from '@/lib/services/coingecko';
import { resolveTokenChain } from '@/lib/market/tokenChainResolver';

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
    // Audit M8 #5 — was sequentially fetching getTokenDetail() for the
    // first match (~200-300ms blocking). Search results land WITHOUT
    // a price pill on first paint and the detail page (which the user
    // is about to click anyway) hydrates the price. Drops search
    // latency by ~half for popular tickers (BTC / ETH / SOL).
    // §market-resolve-chain-leak — was hardcoded chain: 'ethereum' with a
    // comment claiming "router will pick the right chain on click". The
    // router doesn't re-resolve; whatever chain we return goes literally
    // into the URL, so SOL landed at /dashboard/market/ethereum/solana
    // and XRP at /dashboard/market/ethereum/ripple. Resolve per match
    // via the same tokenChainResolver the rest of the platform uses, so
    // native L1s + L2-native tokens route to their real chain.
    const matches: ResolvedMatch[] = topMatches.map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      image: c.thumb,
      chain: resolveTokenChain({ id: c.id, symbol: c.symbol }).chain,
      address: null,
      priceUsd: 0,
    }));
    return NextResponse.json({ kind: 'ticker', matches }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  } catch (err) {
    console.error('[market/resolve]', err);
    return NextResponse.json({ kind: 'ticker', matches: [] }, { status: 502 });
  }
}
