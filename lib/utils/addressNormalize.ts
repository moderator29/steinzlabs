/**
 * Canonical chain-aware address normalization.
 *
 * Why: handoff §6 explicitly warns — Solana base58 mints are
 * CASE-SENSITIVE. Lowercasing produces a different valid-looking
 * address that won't resolve on-chain. EVM addresses are
 * case-insensitive hex; lowercasing them is correct (and standard).
 *
 * Use this everywhere you persist a token / wallet / contract
 * address keyed by chain. The §13 audit found 4 routes that
 * unconditionally lowercased every address — sniper matcher, copy
 * matcher, whale AI summary, whale logo. All silently broke Solana.
 *
 *   import { normalizeAddress, isEvmChain } from "@/lib/utils/addressNormalize";
 *   const key = normalizeAddress(chain, address);
 *
 * For SQL filter helpers, see chainAwareEq() — picks .eq() (Solana,
 * case-sensitive) vs .ilike() (EVM, case-insensitive) so a single
 * call site handles both worlds correctly.
 */

const EVM_CHAINS: ReadonlySet<string> = new Set([
  'ethereum',
  'bsc',
  'base',
  'arbitrum',
  'optimism',
  'polygon',
  'avalanche',
]);

export function isEvmChain(chain: string | null | undefined): boolean {
  if (!chain) return false;
  return EVM_CHAINS.has(chain.toLowerCase());
}

/**
 * Returns the address in its canonical form for the chain:
 *  - EVM:    lowercase
 *  - Solana / TON / unknown: as-is
 *
 * Pass null/undefined and you get '' back so callers don't have to
 * triple-guard before persisting.
 */
export function normalizeAddress(chain: string | null | undefined, address: string | null | undefined): string {
  if (!address) return '';
  return isEvmChain(chain) ? address.toLowerCase() : address;
}
