// Canonical EVM chain → RPC endpoint + capability registry.
//
// Single place that answers three questions for any EVM chain the platform
// touches:
//   1. What RPC URL do I hit?  (getEvmRpcUrl — prefers the shared Alchemy key,
//      falls back to a public RPC so reads still work with no key configured.)
//   2. Is this chain a known EVM chain at all?  (isEvmChain)
//   3. Does our swap aggregator (0x) actually route on it?  (isDexRoutingSupported)
//
// This lets features degrade HONESTLY: a chain can be fully live for holding
// and native ETH/gas send while its DEX routing is still "coming" — instead of
// erroring or pretending liquidity exists.
//
// Non-custodial: this file only maps public infrastructure endpoints and
// capability flags. It never touches keys, signing, or custody.

import { normalizeChainId } from './chainMeta';

export interface EvmChainRpc {
  /** decimal EVM chain id */
  chainId: number;
  /** EIP-1193 hex chain id (window.ethereum) */
  chainIdHex: string;
  /** native gas token symbol */
  nativeSymbol: string;
  /** Alchemy subdomain (e.g. 'base-mainnet'); undefined when not on Alchemy */
  alchemySubdomain?: string;
  /** public RPC fallback — no API key required */
  publicRpc: string;
}

/** Keyed by the canonical chain id returned by normalizeChainId. */
export const EVM_RPC: Record<string, EvmChainRpc> = {
  ethereum:  { chainId: 1,      chainIdHex: '0x1',    nativeSymbol: 'ETH',   alchemySubdomain: 'eth-mainnet',      publicRpc: 'https://eth.llamarpc.com' },
  base:      { chainId: 8453,   chainIdHex: '0x2105', nativeSymbol: 'ETH',   alchemySubdomain: 'base-mainnet',     publicRpc: 'https://mainnet.base.org' },
  arbitrum:  { chainId: 42161,  chainIdHex: '0xa4b1', nativeSymbol: 'ETH',   alchemySubdomain: 'arb-mainnet',      publicRpc: 'https://arb1.arbitrum.io/rpc' },
  optimism:  { chainId: 10,     chainIdHex: '0xa',    nativeSymbol: 'ETH',   alchemySubdomain: 'opt-mainnet',      publicRpc: 'https://mainnet.optimism.io' },
  polygon:   { chainId: 137,    chainIdHex: '0x89',   nativeSymbol: 'MATIC', alchemySubdomain: 'polygon-mainnet',  publicRpc: 'https://polygon-rpc.com' },
  bsc:       { chainId: 56,     chainIdHex: '0x38',   nativeSymbol: 'BNB',   alchemySubdomain: 'bnb-mainnet',      publicRpc: 'https://bsc-dataseed.binance.org' },
  avalanche: { chainId: 43114,  chainIdHex: '0xa86a', nativeSymbol: 'AVAX',  alchemySubdomain: 'avax-mainnet',     publicRpc: 'https://api.avax.network/ext/bc/C/rpc' },
  // Robinhood Chain — Arbitrum-Orbit L2, native gas ETH, mainnet 4663.
  // Alchemy serves it at robinhood-mainnet.g.alchemy.com; public RPC fallback
  // is the chain's own node. No new API key required — reuses ALCHEMY_API_KEY.
  robinhood: { chainId: 4663,   chainIdHex: '0x1237', nativeSymbol: 'ETH',   alchemySubdomain: 'robinhood-mainnet', publicRpc: 'https://rpc.mainnet.chain.robinhood.com' },
};

function alchemyKey(): string {
  return process.env.ALCHEMY_API_KEY || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || '';
}

/**
 * RPC URL for a chain. Prefers the shared Alchemy endpoint when a key is
 * configured (needed for Alchemy's enhanced APIs: token balances, transfers);
 * otherwise the public RPC — native balance + native send still work there.
 * Returns null for a chain we don't recognize.
 */
export function getEvmRpcUrl(chain: string): string | null {
  const meta = EVM_RPC[normalizeChainId(chain)];
  if (!meta) return null;
  const key = alchemyKey();
  if (meta.alchemySubdomain && key) {
    return `https://${meta.alchemySubdomain}.g.alchemy.com/v2/${key}`;
  }
  return meta.publicRpc;
}

export function getEvmChainMeta(chain: string): EvmChainRpc | null {
  return EVM_RPC[normalizeChainId(chain)] ?? null;
}

export function isEvmChain(chain: string): boolean {
  return normalizeChainId(chain) in EVM_RPC;
}

// ─── DEX / swap routing capability ───────────────────────────────────────────
//
// The chains our 0x aggregator (lib/services/zerox.ts ZX_CHAIN_IDS) actually
// lists. Robinhood Chain is a brand-new L2 with NO aggregator coverage yet, so
// it is intentionally ABSENT here: native ETH send is live, DEX routing is
// "coming". UIs should read isDexRoutingSupported() and show that honest state
// rather than attempting a quote that would fail.
export const DEX_SUPPORTED_CHAINS = new Set<string>([
  'ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'avalanche', 'bsc',
]);

/** True when the 0x aggregator can route swaps on this chain. */
export function isDexRoutingSupported(chain: string): boolean {
  return DEX_SUPPORTED_CHAINS.has(normalizeChainId(chain));
}

/**
 * True when non-custodial native gas-token (ETH/BNB/…) send is supported.
 * Every registered EVM chain qualifies — a plain value transfer needs only an
 * RPC, not aggregator liquidity.
 */
export function isNativeSendSupported(chain: string): boolean {
  return isEvmChain(chain);
}
