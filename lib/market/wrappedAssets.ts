/**
 * Wrapped-asset registry.
 *
 * The platform is EVM-first (0x for swaps), so canonical assets like
 * BTC, ETH (on L2s), SOL (on EVM chains), DOGE etc can't be traded
 * natively — they have to route through wrapped representations.
 *
 * Industry parity:
 *   - Uniswap explicitly says "WBTC (Wrapped Bitcoin)" with a badge so
 *     users don't think they're getting native BTC.
 *   - 1inch shows "WBTC" with a "Wrapped 1:1 by BitGo" tooltip.
 *   - DexScreener shows the actual on-chain pair (WBTC/USDC).
 *
 * Audit B4 / P0 — the detail page was rendering "Buy BTC" while
 * silently routing to WBTC, with a header that said
 * "Network: ETHEREUM · Contract: bitcoin" — three lies in one panel.
 *
 * This module is the single source of truth for:
 *   1. Which asset (canonical) the user thinks they're trading
 *   2. Which contract (per chain) actually backs the trade
 *   3. The wrapper provenance (issuer + 1:1 backing claim) so the UI
 *      can render an honest "Trading WBTC · Wraps BTC 1:1 by BitGo"
 *      label every place a wrapped asset shows up.
 *
 * Addresses are public on-chain WETH/WBTC/etc tokens — verifiable by
 * anyone on Etherscan/Solscan. No PII, no secrets.
 */

export interface WrappedAsset {
  /** Canonical symbol the user sees in the price layer (BTC, ETH, SOL). */
  canonicalSymbol: string;
  /** Wrapped symbol used in trade execution (WBTC, WETH, etc). */
  wrappedSymbol: string;
  /** Chain id this contract lives on. */
  chain: string;
  /** Contract address — lowercase for EVM, base58 for Solana. */
  contract: string;
  /** Decimals — for BigInt math at execute time. */
  decimals: number;
  /** Wrapper issuer / custodian for the trust footnote. */
  issuer: string;
  /** Backing ratio — almost always 1, but explicit so we never assume. */
  backingRatio: number;
}

/**
 * Curated registry — the canonical assets users routinely click that
 * AREN'T natively tradable on the active EVM chain. Extending: add a
 * new row keyed by `${canonical.toUpperCase()}:${chain}` is the only
 * thing required.
 */
const REGISTRY: WrappedAsset[] = [
  // BTC — wrapped onto every EVM chain via BitGo's WBTC.
  {
    canonicalSymbol: 'BTC',
    wrappedSymbol: 'WBTC',
    chain: 'ethereum',
    contract: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    decimals: 8,
    issuer: 'BitGo',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'BTC',
    wrappedSymbol: 'WBTC',
    chain: 'arbitrum',
    contract: '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f',
    decimals: 8,
    issuer: 'BitGo (bridged)',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'BTC',
    wrappedSymbol: 'WBTC',
    chain: 'polygon',
    contract: '0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6',
    decimals: 8,
    issuer: 'BitGo (bridged)',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'BTC',
    wrappedSymbol: 'WBTC',
    chain: 'optimism',
    contract: '0x68f180fcce6836688e9084f035309e29bf0a2095',
    decimals: 8,
    issuer: 'BitGo (bridged)',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'BTC',
    wrappedSymbol: 'BTCB',
    chain: 'bsc',
    contract: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
    decimals: 18,
    issuer: 'Binance',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'BTC',
    wrappedSymbol: 'BTC.b',
    chain: 'avalanche',
    contract: '0x152b9d0fdc40c096757f570a51e494bd4b943e50',
    decimals: 8,
    issuer: 'Avalanche Bridge',
    backingRatio: 1,
  },

  // ETH on non-Ethereum EVMs — wrapped via canonical bridge.
  {
    canonicalSymbol: 'ETH',
    wrappedSymbol: 'WETH',
    chain: 'ethereum',
    contract: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    decimals: 18,
    issuer: 'WETH9 (canonical)',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'ETH',
    wrappedSymbol: 'WETH',
    chain: 'base',
    contract: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    issuer: 'Base canonical bridge',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'ETH',
    wrappedSymbol: 'WETH',
    chain: 'arbitrum',
    contract: '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
    decimals: 18,
    issuer: 'Arbitrum canonical bridge',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'ETH',
    wrappedSymbol: 'WETH',
    chain: 'optimism',
    contract: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    issuer: 'Optimism canonical bridge',
    backingRatio: 1,
  },
  {
    canonicalSymbol: 'ETH',
    wrappedSymbol: 'WETH',
    chain: 'polygon',
    contract: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
    decimals: 18,
    issuer: 'Polygon PoS bridge',
    backingRatio: 1,
  },
];

const INDEX = new Map<string, WrappedAsset>(
  REGISTRY.map((r) => [`${r.canonicalSymbol.toUpperCase()}:${r.chain}`, r]),
);

/**
 * Resolve the chain-specific wrapped contract for a canonical asset.
 * Returns null when the canonical asset is native to the chain
 * (USDC on ethereum, MATIC on polygon) — in that case the caller
 * should treat the asset as native and skip wrapped labeling.
 */
export function resolveWrappedAsset(canonicalSymbol: string, chain: string): WrappedAsset | null {
  if (!canonicalSymbol || !chain) return null;
  return INDEX.get(`${canonicalSymbol.toUpperCase()}:${chain.toLowerCase()}`) ?? null;
}

/**
 * True when the canonical asset has any wrapped representation on
 * any chain — used to decide whether to surface the wrap-explainer
 * UI at all on the detail page.
 */
export function isWrappable(canonicalSymbol: string): boolean {
  if (!canonicalSymbol) return false;
  const upper = canonicalSymbol.toUpperCase();
  return REGISTRY.some((r) => r.canonicalSymbol === upper);
}

/**
 * All chains where a canonical asset has a wrapped form. Lets the
 * detail page show "Also tradable on: ARB · BASE · POLYGON".
 */
export function chainsForCanonical(canonicalSymbol: string): string[] {
  const upper = canonicalSymbol.toUpperCase();
  return REGISTRY.filter((r) => r.canonicalSymbol === upper).map((r) => r.chain);
}

export const ETHERSCAN_BY_CHAIN: Record<string, string> = {
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  arbitrum: 'https://arbiscan.io',
  optimism: 'https://optimistic.etherscan.io',
  polygon: 'https://polygonscan.com',
  bsc: 'https://bscscan.com',
  avalanche: 'https://snowtrace.io',
};

/**
 * Convenience — produce a verifiable explorer URL for a wrapped
 * asset's contract so the UI can render a "verify ↗" affordance
 * next to any wrapped label.
 */
export function explorerUrlFor(asset: WrappedAsset): string | null {
  const base = ETHERSCAN_BY_CHAIN[asset.chain];
  if (!base) return null;
  return `${base}/token/${asset.contract}`;
}
