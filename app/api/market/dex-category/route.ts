import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 120;

// DexScreener-backed categories for the Market page. Used by the Pump.fun
// and BNB-meme tabs — CoinGecko doesn't index those chains tightly enough,
// so we pull from DexScreener and reshape the rows into the same shape the
// Market page's token table already consumes (same keys as CoinGecko
// /coins/markets).

interface DexPair {
  chainId: string;
  dexId: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  priceChange?: { h1?: number; h24?: number };
  volume?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  info?: { imageUrl?: string };
  pairAddress: string;
}

interface DexResponse { pairs?: DexPair[]; }

function shape(p: DexPair) {
  const price = parseFloat(p.priceUsd ?? '0') || 0;
  return {
    id: `${p.chainId}:${p.baseToken.address.toLowerCase()}`,
    symbol: p.baseToken.symbol.toLowerCase(),
    name: p.baseToken.name,
    image: p.info?.imageUrl ?? '',
    current_price: price,
    market_cap: p.marketCap ?? p.fdv ?? 0,
    market_cap_rank: 0,
    fully_diluted_valuation: p.fdv ?? null,
    total_volume: p.volume?.h24 ?? 0,
    high_24h: 0,
    low_24h: 0,
    price_change_24h: 0,
    price_change_percentage_24h: p.priceChange?.h24 ?? 0,
    price_change_percentage_1h_in_currency: p.priceChange?.h1 ?? 0,
    price_change_percentage_7d_in_currency: 0,
    market_cap_change_24h: 0,
    market_cap_change_percentage_24h: 0,
    circulating_supply: 0,
    total_supply: null,
    max_supply: null,
    ath: 0,
    ath_change_percentage: 0,
    ath_date: '',
    atl: 0,
    atl_change_percentage: 0,
    atl_date: '',
    last_updated: new Date().toISOString(),
    // Extras for routing into terminal:
    _address: p.baseToken.address,
    _chain: p.chainId,
    _pair: p.pairAddress,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const preset = (searchParams.get('preset') || '').toLowerCase();

  // `preset=pumpfun`  -> Solana pump.fun tokens
  // `preset=bnb-meme` -> BNB chain meme tokens (search for "meme" on BSC)
  let searchQuery = '';
  let chainFilter = '';
  if (preset === 'pumpfun') { searchQuery = 'pump.fun'; chainFilter = 'solana'; }
  else if (preset === 'bnb-meme') { searchQuery = 'meme'; chainFilter = 'bsc'; }
  else {
    return NextResponse.json({ tokens: [], error: 'unknown preset' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(searchQuery)}`, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 120 },
    });
    if (!res.ok) throw new Error(`Dex ${res.status}`);
    const json = (await res.json()) as DexResponse;
    const pairs = (json.pairs ?? [])
      .filter((p) => !chainFilter || p.chainId === chainFilter)
      .filter((p) => (p.volume?.h24 ?? 0) > 0)
      .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
      .slice(0, 50);
    // Dedupe by base token address so we don't list the same token across
    // multiple pairs.
    const seen = new Set<string>();
    const tokens = [];
    for (const p of pairs) {
      const k = p.baseToken.address.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      tokens.push(shape(p));
      if (tokens.length >= 20) break;
    }
    return NextResponse.json({ tokens }, {
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=120' },
    });
  } catch (err) {
    console.error('[market/dex-category]', err);
    return NextResponse.json({ tokens: [] }, { status: 502 });
  }
}
