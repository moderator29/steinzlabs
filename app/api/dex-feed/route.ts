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

// ── Timeout-safe fetch (aborts after `ms` milliseconds) ──────────────────────
function fetchWithTimeout(url: string, opts: RequestInit & { next?: any } = {}, ms = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...opts, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

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

// Run an array of async tasks in chunks to limit concurrency
async function runInBatches<T>(tasks: (() => Promise<T>)[], batchSize: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const chunk = tasks.slice(i, i + batchSize);
    const settled = await Promise.allSettled(chunk.map(fn => fn()));
    for (const r of settled) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }
  return results;
}

// Fetch latest token profiles across all chains
async function fetchTokenProfiles(): Promise<DexToken[]> {
  const res = await fetchWithTimeout(
    'https://api.dexscreener.com/token-profiles/latest/v1',
    { headers: { 'Accept': 'application/json' }, next: { revalidate: 5 } },
    6000
  );
  if (!res.ok) throw new Error(`DexScreener profiles ${res.status}`);
  const profiles: any[] = await res.json();
  const slice = (Array.isArray(profiles) ? profiles : []).slice(0, 30); // reduced from 50

  const tasks = slice.map((p: any) => async (): Promise<DexToken> => {
    const chain = p.chainId ?? 'solana';
    const address = p.tokenAddress ?? '';
    try {
      const pairRes = await fetchWithTimeout(
        `https://api.dexscreener.com/latest/dex/tokens/${address}`,
        { headers: { 'Accept': 'application/json' }, next: { revalidate: 5 } },
        3500
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
  });

  // Process 10 at a time to avoid hammering the API
  return runInBatches(tasks, 10);
}

// Fetch tokens for a specific chain via DexScreener search
async function fetchByChain(chain: string): Promise<DexToken[]> {
  const chainId = CHAIN_IDS[chain] ?? chain;

  try {
    const res = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/search?q=${chainId}`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 5 } },
      6000
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

  // Overall 12s deadline — prevents Vercel/edge idle-stream timeouts
  const result = await Promise.race([
    (async () => {
      let tokens: DexToken[];
      if (chain === 'all') {
        tokens = await fetchTokenProfiles();
      } else {
        tokens = await fetchByChain(chain);
      }
      return NextResponse.json({ tokens, chain, fetchedAt: Date.now() });
    })(),
    new Promise<NextResponse>(resolve =>
      setTimeout(() => resolve(
        NextResponse.json({ tokens: [], chain, fetchedAt: Date.now(), error: 'timeout' })
      ), 12000)
    ),
  ]);

  return result;
}
