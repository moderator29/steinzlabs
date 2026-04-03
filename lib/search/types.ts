export interface SearchResult {
  symbol: string;
  name: string;
  address: string;
  chain: string;
  price: number;
  priceUSD: number;
  volume24h: number;
  volumeUSD: number;
  liquidity: number;
  liquidityUSD: number;
  priceChange24h: number;
  marketCap?: number;
  holders?: number;
  age?: string;
  logo?: string;
  verified?: boolean;
  arkhamVerified: boolean;
  topHolderEntity?: string;
  safetyScore: number;
  scammerPresent: boolean;
}
