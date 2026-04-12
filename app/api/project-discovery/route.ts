import 'server-only';
import { NextResponse } from 'next/server';

const MANUALLY_LISTED: any[] = [];

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 120000;

async function fetchTopCoins() {
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (process.env.COINGECKO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;

    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h',
      { headers, next: { revalidate: 120 } }
    );
    if (!res.ok) return [];
    const coins = await res.json();
    if (!Array.isArray(coins)) return [];

    return coins
      .filter((c: any) => (c.market_cap || 0) >= 500000)
      .map((c: any) => {
        let chain = 'ethereum';
        const sym = c.symbol?.toLowerCase();
        if (['sol', 'jto', 'pyth', 'jup', 'bonk', 'wif', 'ray'].includes(sym)) chain = 'solana';
        else if (['bnb', 'cake', 'bake'].includes(sym)) chain = 'bsc';
        else if (['matic', 'pol', 'quick'].includes(sym)) chain = 'polygon';
        else if (['avax', 'joe', 'png'].includes(sym)) chain = 'avalanche';
        else if (c.id?.includes('base') || sym === 'aerodrome') chain = 'base';

        return {
          name: c.name || 'Unknown',
          symbol: c.symbol?.toUpperCase() || '?',
          slug: c.id || '',
          description: `Rank #${c.market_cap_rank || '?'} — $${(c.market_cap / 1e9).toFixed(2)}B market cap`,
          category: 'Trending',
          price: c.current_price != null ? `$${c.current_price < 0.01 ? c.current_price.toFixed(8) : c.current_price < 1 ? c.current_price.toFixed(4) : c.current_price.toLocaleString()}` : '—',
          priceChange24h: c.price_change_percentage_24h?.toFixed(1) || '0',
          marketCap: c.market_cap ? `$${c.market_cap >= 1e9 ? (c.market_cap / 1e9).toFixed(2) + 'B' : (c.market_cap / 1e6).toFixed(2) + 'M'}` : '—',
          marketCapRaw: c.market_cap || 0,
          volume24h: c.total_volume ? `$${c.total_volume >= 1e9 ? (c.total_volume / 1e9).toFixed(2) + 'B' : (c.total_volume / 1e6).toFixed(1) + 'M'}` : '—',
          liquidity: '—',
          thumb: c.image || '',
          verified: (c.market_cap_rank || 999) <= 200,
          pinned: false,
          source: 'coingecko',
          chain,
          pairAddress: '',
          dexUrl: `https://www.coingecko.com/en/coins/${c.id}`,
        };
      });
  } catch (e) {

    return [];
  }
}

async function fetchDexScreenerTrending() {
  try {
    const res = await fetch('https://api.dexscreener.com/token-boosts/top/v1', {
      next: { revalidate: 120 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.slice(0, 10).map((token: any) => {
      const chain = token.chainId || 'unknown';
      return {
        name: token.description?.split(' ')[0] || token.tokenAddress?.slice(0, 8) + '...',
        symbol: chain.toUpperCase(),
        slug: token.tokenAddress || '',
        description: token.description || `Boosted on ${chain} — ${token.amount || 0} boosts`,
        category: 'DexScreener',
        price: '—',
        priceChange24h: '0',
        marketCap: '—',
        marketCapRaw: 0,
        volume24h: '—',
        liquidity: '—',
        thumb: token.icon || '',
        verified: false,
        pinned: false,
        source: 'dexscreener',
        chain: chain === 'ethereum' ? 'ethereum' : chain === 'solana' ? 'solana' : chain === 'bsc' ? 'bsc' : chain === 'polygon' ? 'polygon' : chain === 'avalanche' ? 'avalanche' : chain === 'base' ? 'base' : chain,
        pairAddress: '',
        dexUrl: token.url || `https://dexscreener.com/${chain}/${token.tokenAddress}`,
      };
    });
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chainFilter = searchParams.get('chain') || 'all';

    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      let projects = cache.data;
      if (chainFilter !== 'all') {
        const pinned = projects.filter((p: any) => p.pinned);
        const rest = projects.filter((p: any) => !p.pinned && p.chain === chainFilter);
        projects = [...pinned, ...rest];
      }
      return NextResponse.json({ projects, timestamp: new Date().toISOString() });
    }

    const [topCoins, dexTrending] = await Promise.all([
      fetchTopCoins(),
      fetchDexScreenerTrending(),
    ]);

    const allProjects: any[] = [];

    for (const listed of MANUALLY_LISTED) {
      allProjects.push({ ...listed, pinned: false, source: 'manual', verified: true });
    }

    allProjects.push(...topCoins);
    allProjects.push(...dexTrending);

    cache = { data: allProjects, timestamp: Date.now() };

    let projects = allProjects;
    if (chainFilter !== 'all') {
      const pinned = projects.filter((p: any) => p.pinned);
      const rest = projects.filter((p: any) => !p.pinned && p.chain === chainFilter);
      projects = [...pinned, ...rest];
    }

    return NextResponse.json({ projects, timestamp: new Date().toISOString() }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {

    return NextResponse.json({ projects: [], error: 'Failed to fetch' }, { status: 500 });
  }
}
