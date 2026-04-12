import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// --- Normalised token shape returned to the client ---
export interface DexToken {
  id: string;
  name: string;
  symbol: string;
  imageUri?: string;
  contractAddress: string;
  chain: string;
  price?: number;
  marketCap?: number;
  liquidity?: number;
  volume24h?: number;
  change24h?: number;
  createdAt?: number; // unix ms
  graduated?: boolean;
  dexUrl?: string;
  pairAddress?: string;
  holders?: number;
  fdv?: number;
  supply?: number;
  volume5m?: number;
}

// DexScreener chainId values for each supported chain
const CHAIN_IDS: Record<string, string> = {
  solana: 'solana',
  ethereum: 'ethereum',
  bsc: 'bsc',
  polygon: 'polygon',
  avalanche: 'avalanche',
  ton: 'ton',
  base: 'base',
  tron: 'tron',
};

// ── DexScreener helpers ───────────────────────────────────────────────────────
function normaliseDexPair(pair: any): DexToken {
  const chain = pair.chainId ?? 'unknown';
  return {
    id: pair.pairAddress ?? pair.baseToken?.address,
    name: pair.baseToken?.name ?? 'Unknown',
    symbol: pair.baseToken?.symbol ?? '???',
    imageUri: pair.info?.imageUrl,
    contractAddress: pair.baseToken?.address ?? '',
    chain,
    price: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
    marketCap: pair.marketCap,
    liquidity: pair.liquidity?.usd,
    volume24h: pair.volume?.h24,
    volume5m: pair.volume?.m5,
    change24h: pair.priceChange?.h24,
    createdAt: pair.pairCreatedAt,
    graduated: false,
    dexUrl: pair.url,
    pairAddress: pair.pairAddress,
    fdv: pair.fdv,
  };
}

// Fetch latest token profiles across all chains
async function fetchTokenProfiles(): Promise<DexToken[]> {
  const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 5 },
  });
  if (!res.ok) throw new Error(`DexScreener profiles ${res.status}`);
  const profiles: any[] = await res.json();
  const slice = (Array.isArray(profiles) ? profiles : []).slice(0, 50);

  const settled = await Promise.allSettled(
    slice.map(async (p: any): Promise<DexToken> => {
      const chain = p.chainId ?? 'solana';
      const address = p.tokenAddress ?? '';
      try {
        const pairRes = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${address}`,
          { headers: { 'Accept': 'application/json' }, next: { revalidate: 5 } }
        );
        if (pairRes.ok) {
          const pairData = await pairRes.json();
          const topPair = (pairData.pairs ?? [])[0];
          if (topPair) return normaliseDexPair(topPair);
        }
      } catch { /* fall through */ }
      return {
        id: address,
        name: p.description ?? address.slice(0, 8),
        symbol: p.header ?? '???',
        imageUri: p.icon,
        contractAddress: address,
        chain,
        dexUrl: p.url,
        createdAt: Date.now(),
      };
    })
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<DexToken> => r.status === 'fulfilled')
    .map(r => r.value);
}

// Fetch tokens for a specific chain via DexScreener search
async function fetchByChain(chain: string): Promise<DexToken[]> {
  const chainId = CHAIN_IDS[chain] ?? chain;

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${chainId}`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 5 } }
    );
    if (!res.ok) throw new Error(`DexScreener search ${res.status}`);
    const data = await res.json();
    const pairs = (data.pairs ?? [])
      .filter((p: any) => p.chainId === chainId)
      .slice(0, 50)
      .map(normaliseDexPair);
    if (pairs.length > 0) return pairs;
  } catch { /* fall through to profile filter */ }

  // Fallback: filter token profiles by chain
  const all = await fetchTokenProfiles();
  return all.filter(t => t.chain === chainId);
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Support both ?chain= (new) and ?tab= (legacy) params
  const chain = req.nextUrl.searchParams.get('chain') ??
                req.nextUrl.searchParams.get('tab') ?? 'all';

  try {
    let tokens: DexToken[];

    if (chain === 'all') {
      tokens = await fetchTokenProfiles();
    } else {
      tokens = await fetchByChain(chain);
    }

    return NextResponse.json({ tokens, chain, fetchedAt: Date.now() });
  } catch (err: any) {
    return NextResponse.json({ tokens: [], chain, fetchedAt: Date.now(), error: err?.message });
  }
}
