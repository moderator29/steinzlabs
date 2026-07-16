/**
 * Coins coins feature - shared types.
 *
 * A "Coin" is a graduated-on-DEX token assembled from the platform's
 * existing keyless data rails (DexScreener + GeckoTerminal + Birdeye) and
 * decorated with our own admin flags (verified / featured / hidden) from
 * `coin_registry`. Non-custodial: nothing here holds keys.
 */

/** Chains the coins feature trades on for now. */
export const COIN_CHAINS = ['solana', 'ethereum', 'bsc'] as const;
export type CoinChain = (typeof COIN_CHAINS)[number];

export function isCoinChain(c: string | null | undefined): c is CoinChain {
  return !!c && (COIN_CHAINS as readonly string[]).includes(c);
}

export interface CoinSocials {
  website: string | null;
  twitter: string | null;
  telegram: string | null;
}

export interface Coin {
  chain: string;
  tokenAddress: string;
  tokenKey: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  decimals: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  change5m: number | null;
  change1h: number | null;
  change24h: number | null;
  txns24h: { buys: number; sells: number } | null;
  pairAddress: string | null;
  dex: string | null;
  socials: CoinSocials;
  /** Our verification tick (admin-granted), distinct from any upstream flag. */
  verified: boolean;
  featured: boolean;
  isGraduated: boolean;
  holdersCount: number | null;
  pairCreatedAt: number | null;
}

export interface CoinCandle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type CoinTimeframe = '1H' | '4H' | '1D' | '7D' | '3M' | 'ALL';

export interface CoinTradeRow {
  timestamp: number;
  side: 'buy' | 'sell';
  usdAmount: number;
  tokenAmount: number;
  priceUsd: number;
  marketCapUsd: number | null;
  wallet: string;
  /** Present only for on-platform (our users') trades. */
  user?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  source: 'platform' | 'dex';
  txHash?: string | null;
}

export interface CoinHolderRow {
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  usdValue: number;
  pnlPct: number | null;
  avgHoldMs: number | null;
  thesis?: {
    id: string;
    body: string;
    like_count: number;
    wire_post_id: string | null;
  } | null;
}

export interface CoinStats {
  buys: number | null;
  sells: number | null;
  buyers: number | null;
  sellers: number | null;
  buyVolUsd: number | null;
  sellVolUsd: number | null;
}
