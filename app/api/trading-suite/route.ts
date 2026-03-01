import { NextResponse } from 'next/server';

let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 30000;

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const [trendingRes, topRes, fearRes] = await Promise.allSettled([
      fetch('https://api.coingecko.com/api/v3/search/trending'),
      fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=1h,24h,7d'),
      fetch('https://api.alternative.me/fng/?limit=1'),
    ]);

    let trending: any[] = [];
    if (trendingRes.status === 'fulfilled' && trendingRes.value.ok) {
      const data = await trendingRes.value.json();
      trending = (data.coins || []).slice(0, 15).map((c: any) => ({
        id: c.item?.id,
        name: c.item?.name,
        symbol: c.item?.symbol?.toUpperCase(),
        thumb: c.item?.thumb,
        marketCapRank: c.item?.market_cap_rank,
        price: c.item?.data?.price,
        priceChange24h: c.item?.data?.price_change_percentage_24h?.usd || 0,
        marketCap: c.item?.data?.market_cap,
        volume: c.item?.data?.total_volume,
        sparkline: c.item?.data?.sparkline,
        score: c.item?.score,
      }));
    }

    let topTokens: any[] = [];
    if (topRes.status === 'fulfilled' && topRes.value.ok) {
      const data = await topRes.value.json();
      topTokens = data.map((t: any) => ({
        id: t.id,
        name: t.name,
        symbol: t.symbol?.toUpperCase(),
        image: t.image,
        price: t.current_price,
        priceChange1h: t.price_change_percentage_1h_in_currency,
        priceChange24h: t.price_change_percentage_24h,
        priceChange7d: t.price_change_percentage_7d_in_currency,
        volume: t.total_volume,
        marketCap: t.market_cap,
        sparkline: t.sparkline_in_7d?.price?.slice(-24) || [],
        high24h: t.high_24h,
        low24h: t.low_24h,
        ath: t.ath,
        athChange: t.ath_change_percentage,
        circulatingSupply: t.circulating_supply,
        totalSupply: t.total_supply,
        rank: t.market_cap_rank,
      }));
    }

    let fearGreed = { value: '50', classification: 'Neutral' };
    if (fearRes.status === 'fulfilled' && fearRes.value.ok) {
      const data = await fearRes.value.json();
      if (data.data?.[0]) {
        fearGreed = { value: data.data[0].value, classification: data.data[0].value_classification };
      }
    }

    let newPairs: any[] = [];
    try {
      const dexRes = await fetch('https://api.dexscreener.com/token-profiles/latest/v1', { signal: AbortSignal.timeout(5000) });
      if (dexRes.ok) {
        const dexData = await dexRes.json();
        newPairs = (Array.isArray(dexData) ? dexData : []).slice(0, 12).map((p: any) => ({
          address: p.tokenAddress,
          chain: p.chainId,
          icon: p.icon,
          description: p.description?.slice(0, 80),
          links: p.links?.slice(0, 2),
        }));
      }
    } catch {}

    const result = { trending, topTokens, newPairs, fearGreed, timestamp: Date.now() };
    cache = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ trending: [], topTokens: [], newPairs: [], fearGreed: { value: '50', classification: 'Neutral' }, timestamp: Date.now() });
  }
}
