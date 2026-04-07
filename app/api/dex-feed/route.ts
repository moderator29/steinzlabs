import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // switch from edge - edge can't reach pump.fun

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
    change24h: pair.priceChange?.h24,
    createdAt: pair.pairCreatedAt,
    graduated: false,
    dexUrl: pair.url,
    pairAddress: pair.pairAddress,
  };
}

async function fetchDexScreenerLatest(): Promise<DexToken[]> {
  const res = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 20 },
  });
  if (!res.ok) throw new Error(`DexScreener profiles ${res.status}`);
  const profiles: any[] = await res.json();
  const slice = (Array.isArray(profiles) ? profiles : []).slice(0, 30);

  const settled = await Promise.allSettled(
    slice.map(async (p: any): Promise<DexToken> => {
      const chain = p.chainId ?? 'solana';
      const address = p.tokenAddress ?? '';
      try {
        const pairRes = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${address}`,
          { headers: { 'Accept': 'application/json' }, next: { revalidate: 20 } }
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

async function fetchPumpFunViaDex(): Promise<DexToken[]> {
  // Use DexScreener's search for pump.fun tokens as primary source
  // (pump.fun's own API blocks edge/serverless environments)
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/search?q=pump',
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 20 } }
    );
    if (!res.ok) throw new Error(`DexScreener pump search ${res.status}`);
    const data = await res.json();
    const pairs = (data.pairs ?? [])
      .filter((p: any) => p.chainId === 'solana' && p.dexId === 'pump')
      .slice(0, 50);
    if (pairs.length > 0) return pairs.map(normaliseDexPair);
  } catch { /* fall through */ }

  // Fallback: latest profiles from DexScreener (solana filter)
  const all = await fetchDexScreenerLatest();
  return all.filter(t => t.chain === 'solana').slice(0, 40);
}

async function fetchPumpSwap(): Promise<DexToken[]> {
  // PumpSwap = graduated pump.fun tokens now on Raydium
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/search?q=pumpswap',
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 20 } }
    );
    if (!res.ok) throw new Error(`DexScreener pumpswap ${res.status}`);
    const data = await res.json();
    return (data.pairs ?? [])
      .filter((p: any) => p.chainId === 'solana')
      .slice(0, 50)
      .map((p: any) => ({ ...normaliseDexPair(p), graduated: true }));
  } catch {
    return fetchDexScreenerLatest().then(t => t.filter(x => x.chain === 'solana').slice(0, 30));
  }
}

async function fetchBonk(): Promise<DexToken[]> {
  try {
    const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=bonk', {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 20 },
    });
    if (!res.ok) throw new Error(`DexScreener BONK ${res.status}`);
    const data = await res.json();
    return (data.pairs ?? []).slice(0, 50).map(normaliseDexPair);
  } catch {
    return [];
  }
}

async function fetchFourMeme(): Promise<DexToken[]> {
  // FourMeme is BSC-native. Use DexScreener to find new BSC token pairs.
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/search?q=bsc new',
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 20 } }
    );
    if (!res.ok) throw new Error(`DexScreener BSC ${res.status}`);
    const data = await res.json();
    return (data.pairs ?? [])
      .filter((p: any) => p.chainId === 'bsc')
      .slice(0, 50)
      .map(normaliseDexPair);
  } catch {
    // Fallback: get latest from BSC chain
    const all = await fetchDexScreenerLatest();
    return all.filter(t => t.chain === 'bsc').slice(0, 30);
  }
}

async function fetchRaydium(): Promise<DexToken[]> {
  // Raydium = Solana DEX. Search for Raydium pairs on DexScreener.
  try {
    const res = await fetch(
      'https://api.dexscreener.com/latest/dex/search?q=raydium',
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 20 } }
    );
    if (!res.ok) throw new Error(`DexScreener Raydium ${res.status}`);
    const data = await res.json();
    return (data.pairs ?? [])
      .filter((p: any) => p.chainId === 'solana' && p.dexId === 'raydium')
      .slice(0, 50)
      .map(normaliseDexPair);
  } catch {
    const all = await fetchDexScreenerLatest();
    return all.filter(t => t.chain === 'solana').slice(0, 30);
  }
}

async function fetchNewPairs(): Promise<DexToken[]> {
  return fetchDexScreenerLatest();
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get('tab') ?? 'pumpfun';

  try {
    let tokens: DexToken[];
    switch (tab) {
      case 'pumpswap':
        tokens = await fetchPumpSwap();
        break;
      case 'bonk':
        tokens = await fetchBonk();
        break;
      case 'fourmeme':
        tokens = await fetchFourMeme();
        break;
      case 'raydium':
        tokens = await fetchRaydium();
        break;
      case 'new':
        tokens = await fetchNewPairs();
        break;
      case 'pumpfun':
      default:
        tokens = await fetchPumpFunViaDex();
    }
    return NextResponse.json({ tokens, tab, fetchedAt: Date.now() });
  } catch (err: any) {
    console.error('[dex-feed]', err);
    // Return empty array with 200 instead of 502 - UI handles gracefully
    return NextResponse.json({ tokens: [], tab, fetchedAt: Date.now(), error: err?.message });
  }
}
