import { SearchResult } from './types';

export async function searchCoinGecko(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
    );

    if (!response.ok) return [];

    const data = await response.json();

    return (data.coins || []).slice(0, 10).map((coin: any) => ({
      symbol: coin.symbol?.toUpperCase() || '',
      name: coin.name,
      address: coin.id,
      chain: 'multiple',
      price: 0,
      priceUSD: 0,
      volume24h: 0,
      volumeUSD: 0,
      liquidity: 0,
      liquidityUSD: 0,
      priceChange24h: 0,
      marketCap: coin.market_cap_rank,
      logo: coin.large,
      arkhamVerified: false,
      safetyScore: 5,
      scammerPresent: false,
    }));
  } catch (error) {
    console.error('CoinGecko search failed:', error);
    return [];
  }
}
