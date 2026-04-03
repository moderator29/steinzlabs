import { SearchResult } from './types';

export async function searchDEXScreener(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) return [];

    const data = await response.json();

    return (data.pairs || []).map((pair: any) => ({
      symbol: pair.baseToken.symbol,
      name: pair.baseToken.name,
      address: pair.baseToken.address,
      chain: pair.chainId,
      price: parseFloat(pair.priceNative || '0'),
      priceUSD: parseFloat(pair.priceUsd || '0'),
      volume24h: parseFloat(pair.volume?.h24 || '0'),
      volumeUSD: parseFloat(pair.volume?.h24 || '0'),
      liquidity: parseFloat(pair.liquidity?.base || '0'),
      liquidityUSD: parseFloat(pair.liquidity?.usd || '0'),
      priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
      logo: pair.info?.imageUrl,
      arkhamVerified: false,
      safetyScore: 5,
      scammerPresent: false,
    }));
  } catch (error) {
    console.error('DEXScreener search failed:', error);
    return [];
  }
}
