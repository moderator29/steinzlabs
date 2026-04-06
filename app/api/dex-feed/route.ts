import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

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

// ── pump.fun helpers ──────────────────────────────────────────────────────────
async function fetchPumpFun(complete = false): Promise<DexToken[]> {
  const params = complete
    ? 'sort=last_trade_timestamp&order=DESC&limit=50&complete=true'
    : 'sort=created_timestamp&order=DESC&limit=50&offset=0';
  const url = `https://frontend-api.pump.fun/coins?${params}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`pump.fun API error ${res.status}`);
  const data = await res.json();

  return (Array.isArray(data) ? data : []).map((c: any): DexToken => ({
    id: c.mint ?? c.name,
    name: c.name ?? 'Unknown',
    symbol: c.symbol ?? '???',
    imageUri: c.image_uri,
    contractAddress: c.mint ?? '',
    chain: 'solana',
    price: c.usd_market_cap && c.total_supply ? c.usd_market_cap / c.total_supply : undefined,
    marketCap: c.usd_market_cap,
    volume24h: undefined,
    change24h: undefined,
    createdAt: c.created_timestamp ? c.created_timestamp * 1000 : undefined,
    graduated: complete,
    dexUrl: c.mint ? `https://dexscreener.com/solana/${c.mint}` : undefined,
  }));
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

async function fetchBonk(): Promise<DexToken[]> {
  const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=bonk', {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 30 },
  });
  if (!res.ok) throw new Error(`DexScreener BONK error ${res.status}`);
  const data = await res.json();
  return (data.pairs ?? []).slice(0, 50).map(normaliseDexPair);
}

async function fetchNewPairs(): Promise<DexToken[]> {
  // DexScreener token profiles (recent) – gives us new tokens across chains
  const profilesRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', {
    headers: { 'Accept': 'application/json' },
    next: { revalidate: 30 },
  });
  if (!profilesRes.ok) throw new Error(`DexScreener profiles error ${profilesRes.status}`);
  const profiles: any[] = await profilesRes.json();

  // Batch requests: group by chain and take first 20 profiles
  const slice = (Array.isArray(profiles) ? profiles : []).slice(0, 20);

  const results: DexToken[] = await Promise.all(
    slice.map(async (p: any): Promise<DexToken> => {
      const chain = p.chainId ?? 'solana';
      const address = p.tokenAddress ?? '';
      try {
        const pairRes = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${address}`,
          { headers: { 'Accept': 'application/json' }, next: { revalidate: 30 } }
        );
        if (pairRes.ok) {
          const pairData = await pairRes.json();
          const topPair = (pairData.pairs ?? [])[0];
          if (topPair) return normaliseDexPair(topPair);
        }
      } catch { /* fall through */ }
      // Fallback: just use profile data
      return {
        id: address,
        name: p.description ?? address.slice(0, 8),
        symbol: '???',
        imageUri: p.icon,
        contractAddress: address,
        chain,
        dexUrl: p.url,
      };
    })
  );

  return results;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get('tab') ?? 'pumpfun';

  try {
    let tokens: DexToken[];
    switch (tab) {
      case 'pumpswap':
        tokens = await fetchPumpFun(true);
        break;
      case 'bonk':
        tokens = await fetchBonk();
        break;
      case 'new':
        tokens = await fetchNewPairs();
        break;
      case 'pumpfun':
      default:
        tokens = await fetchPumpFun(false);
    }
    return NextResponse.json({ tokens, tab, fetchedAt: Date.now() });
  } catch (err: any) {
    console.error('[dex-feed]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Unknown error', tokens: [], tab },
      { status: 502 }
    );
  }
}
