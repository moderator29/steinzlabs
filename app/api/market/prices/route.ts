import { NextResponse } from 'next/server';

// ISR — regenerate every 5 minutes at the edge so CoinGecko is hit at most once per 5 min
export const revalidate = 300;

const CG_BASE = process.env.COINGECKO_API_KEY
  ? 'https://pro-api.coingecko.com/api/v3'
  : 'https://api.coingecko.com/api/v3';

function cgHeaders() {
  if (!process.env.COINGECKO_API_KEY) return {};
  return { 'x-cg-pro-api-key': process.env.COINGECKO_API_KEY };
}

// CoinCap fallback — free, no key, no rate limit issues
async function fetchCoinCap(limit: number) {
  const res = await fetch(
    `https://api.coincap.io/v2/assets?limit=${limit}`,
    { next: { revalidate: 300 } }
  );
  if (!res.ok) throw new Error('CoinCap failed');
  const { data } = await res.json();
  return (data as any[]).map((c) => ({
    id:                               c.id,
    symbol:                           c.symbol?.toUpperCase() ?? '',
    name:                             c.name ?? '',
    image:                            `https://assets.coincap.io/assets/icons/${c.symbol?.toLowerCase()}@2x.png`,
    current_price:                    parseFloat(c.priceUsd) || 0,
    market_cap:                       parseFloat(c.marketCapUsd) || 0,
    market_cap_rank:                  parseInt(c.rank) || 0,
    fully_diluted_valuation:          null,
    total_volume:                     parseFloat(c.volumeUsd24Hr) || 0,
    high_24h:                         0,
    low_24h:                          0,
    price_change_24h:                 0,
    price_change_percentage_24h:      parseFloat(c.changePercent24Hr) || 0,
    price_change_percentage_1h_in_currency:  0,
    price_change_percentage_7d_in_currency:  0,
    circulating_supply:               parseFloat(c.supply) || 0,
    total_supply:                     parseFloat(c.maxSupply) || null,
    max_supply:                       parseFloat(c.maxSupply) || null,
    ath: 0, ath_change_percentage: 0, ath_date: '',
    sparkline_in_7d:                  undefined,
  }));
}

// CoinGecko category map
const CAT_MAP: Record<string, string> = {
  defi:   'decentralized-finance-defi',
  layer1: 'layer-1',
  layer2: 'layer-2',
  gaming: 'gaming',
  meme:   'meme-token',
  ai:     'artificial-intelligence',
  depin:  'depin',
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page     = searchParams.get('page')     ?? '1';
  const category = searchParams.get('category') ?? 'all';

  const params = new URLSearchParams({
    vs_currency:             'usd',
    order:                   'market_cap_desc',
    per_page:                '100',
    page,
    sparkline:               'true',
    price_change_percentage: '1h,24h,7d',
  });

  if (category && category !== 'all' && category !== 'majors') {
    const slug = CAT_MAP[category];
    if (slug) params.set('category', slug);
  }

  // Try CoinGecko first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`${CG_BASE}/coins/markets?${params}`, {
      headers: cgHeaders(),
      signal:  controller.signal,
      next:    { revalidate: 300 },
    } as RequestInit);
    clearTimeout(timer);

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data, {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      });
    }
  } catch {
    // fall through to CoinCap
  }

  // CoinGecko failed — use CoinCap (only works for 'all' / 'majors')
  try {
    const data = await fetchCoinCap(100);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, s-maxage=60' },
    });
  }
}
