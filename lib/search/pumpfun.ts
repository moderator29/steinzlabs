import { SearchResult } from './types';

export async function searchPumpFun(query: string): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `https://frontend-api.pump.fun/coins?search=${encodeURIComponent(query)}&limit=20`
    );

    if (!response.ok) return [];

    const data = await response.json();

    return (data || []).map((token: any) => ({
      symbol: token.symbol,
      name: token.name,
      address: token.mint,
      chain: 'solana',
      price: 0,
      priceUSD: parseFloat(token.usd_market_cap || '0') / parseFloat(token.total_supply || '1'),
      volume24h: 0,
      volumeUSD: 0,
      liquidity: 0,
      liquidityUSD: 0,
      priceChange24h: 0,
      marketCap: parseFloat(token.usd_market_cap || '0'),
      logo: token.image_uri,
      arkhamVerified: false,
      safetyScore: 4,
      scammerPresent: false,
    }));
  } catch (error) {

    return [];
  }
}
