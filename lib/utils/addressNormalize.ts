/**
 * Canonical address normalization for cross-chain comparisons.
 *
 * EVM addresses are case-insensitive at the protocol level — Ethereum,
 * Polygon, BSC, Base, Arbitrum, Avalanche, Optimism all treat
 * 0xABCD... and 0xabcd... as the same account. Lower-casing for
 * comparison/storage is safe and standard.
 *
 * Solana addresses are base58-encoded and CASE-SENSITIVE. The address
 * "So11111111111111111111111111111111111111112" is not the same as
 * "so11111111111111111111111111111111111111112" — lower-casing breaks
 * lookups, comparisons, and signature verification.
 *
 * TON, Bitcoin (bech32 lower / base58 mixed), and other chains have
 * their own rules; for now we treat anything that doesn't match
 * 0x-hex as case-preserving and trim whitespace.
 *
 * Use this function whenever you compare two addresses or store one
 * for later lookup. Never call .toLowerCase() on a raw address.
 */

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export type Chain =
  | 'ethereum' | 'polygon' | 'bsc' | 'base' | 'arbitrum'
  | 'avalanche' | 'optimism' | 'solana' | 'ton' | 'bitcoin'
  | string;

const EVM_CHAINS: ReadonlySet<string> = new Set([
  'ethereum', 'polygon', 'bsc', 'binance', 'bnb',
  'base', 'arbitrum', 'arbitrum-one', 'avalanche', 'avax',
  'optimism', 'op', 'fantom', 'gnosis', 'linea', 'scroll', 'zksync',
]);

export function isEvmChain(chain: Chain | undefined | null): boolean {
  if (!chain) return false;
  return EVM_CHAINS.has(chain.toLowerCase());
}

export function isEvmAddress(addr: string): boolean {
  return EVM_RE.test(addr);
}

export function isSolanaAddress(addr: string): boolean {
  return SOLANA_RE.test(addr) && !EVM_RE.test(addr);
}

/**
 * Returns the address in canonical form for storage/comparison.
 * - EVM: lowercase
 * - Solana / unknown: trimmed, case preserved
 */
export function normalizeAddress(addr: string, chain?: Chain): string {
  if (typeof addr !== 'string') return '';
  const trimmed = addr.trim();
  if (!trimmed) return '';
  if (chain && isEvmChain(chain)) return trimmed.toLowerCase();
  if (isEvmAddress(trimmed)) return trimmed.toLowerCase();
  return trimmed;
}

/**
 * True if two addresses refer to the same on-chain account, accounting
 * for chain-specific case rules. If chain is unknown, falls back to
 * shape-based detection.
 */
export function addressesEqual(a: string, b: string, chain?: Chain): boolean {
  if (!a || !b) return false;
  return normalizeAddress(a, chain) === normalizeAddress(b, chain);
}
