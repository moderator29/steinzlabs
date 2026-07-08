/**
 * Normalized live token-stats shape shared by the API route
 * (`/api/market/token/[id]/stats`) and the terminal TokenStatsPanel.
 *
 * ABSOLUTE RULE: every field here is populated ONLY from a real source
 * (DexScreener pair data, GeckoTerminal pool data, or CoinGecko for majors
 * without a DEX pair). Anything a source doesn't provide stays `null` so the
 * panel renders an honest empty state — never a fabricated number.
 */

export type Win = 'm5' | 'h1' | 'h6' | 'h24';

export interface StatTier {
  m5: number | null;
  h1: number | null;
  h6: number | null;
  h24: number | null;
}

export interface TxnTier {
  m5: { buys: number; sells: number } | null;
  h1: { buys: number; sells: number } | null;
  h6: { buys: number; sells: number } | null;
  h24: { buys: number; sells: number } | null;
}

export interface TokenStats {
  /** Which real source populated the bulk of this payload. */
  source: 'dexscreener' | 'geckoterminal' | 'coingecko';
  name: string;
  symbol: string;
  logo: string | null;
  chain: string;
  /** On-chain contract, when known. */
  address: string | null;
  pairAddress: string | null;
  dexId: string | null;

  website: string | null;
  twitter: string | null;
  telegram: string | null;

  priceUsd: number | null;
  /** Price denominated in the pool's quote token (e.g. "0.00042"). */
  priceNative: string | null;
  /** Quote-token symbol for the native price (e.g. "WETH", "SOL"). */
  nativeSymbol: string | null;

  liquidityUsd: number | null;
  fdv: number | null;
  marketCap: number | null;

  /** % price change per window. */
  change: StatTier;
  /** Total USD volume per window. */
  volume: StatTier;
  /** Buy/sell transaction COUNTS per window. */
  txns: TxnTier;

  /** Unique buyers / sellers over 24h (GeckoTerminal). null when unavailable. */
  buyers24h: number | null;
  sellers24h: number | null;

  /** Directional 24h volume. Neither DexScreener nor GeckoTerminal's public
   *  API splits volume by side, so these are honestly null today — the panel
   *  hides the split rather than inventing it. */
  buyVol24h: number | null;
  sellVol24h: number | null;

  /** Epoch ms this snapshot was assembled (drives the live "updated" pulse). */
  updatedAt: number;
}
