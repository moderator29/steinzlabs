import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [trendingRes, topRes] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/search/trending', {
        headers: process.env.COINGECKO_API_KEY
          ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
          : {},
        next: { revalidate: 120 },
      }),
      fetch('https://api.dexscreener.com/token-boosts/top/v1', {
        next: { revalidate: 120 },
      }),
    ]);

    const projects: any[] = [];

    if (trendingRes.ok) {
      const trendingData = await trendingRes.json();
      const coins = trendingData.coins || [];
      for (const coin of coins.slice(0, 8)) {
        const item = coin.item;
        projects.push({
          name: item.name || 'Unknown',
          symbol: item.symbol || '?',
          slug: item.id || item.slug || '',
          description: `Rank #${item.market_cap_rank || '?'} — ${item.name} trending on CoinGecko`,
          category: 'Trending',
          price: item.data?.price ? `$${parseFloat(item.data.price).toFixed(item.data.price < 1 ? 6 : 2)}` : '—',
          priceChange24h: item.data?.price_change_percentage_24h?.usd?.toFixed(1) || '0',
          marketCap: item.data?.market_cap || '—',
          thumb: item.thumb || '',
          verified: (item.market_cap_rank || 999) <= 100,
          source: 'coingecko',
        });
      }
    }

    if (topRes.ok) {
      const topData = await topRes.json();
      if (Array.isArray(topData)) {
        for (const token of topData.slice(0, 6)) {
          projects.push({
            name: token.tokenAddress?.slice(0, 8) + '...' || 'Unknown',
            symbol: token.chainId?.toUpperCase() || '?',
            slug: token.tokenAddress || '',
            description: token.description || `Trending on ${token.chainId} — ${token.amount || 0} boosts`,
            category: 'DexScreener',
            price: '—',
            priceChange24h: '0',
            marketCap: '—',
            thumb: token.icon || '',
            verified: false,
            source: 'dexscreener',
            url: token.url || '',
          });
        }
      }
    }

    return NextResponse.json({ projects, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Project discovery error:', error);
    return NextResponse.json({ projects: [], error: 'Failed to fetch' }, { status: 500 });
  }
}
