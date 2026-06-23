/**
 * Shared symbol → {address, decimals} resolver for the swap quote path.
 *
 * Why this exists: `/api/swap/price` and the swap cards receive token
 * *symbols* + a *human* amount (e.g. "0.0323 SOL"), but 0x / Jupiter both
 * need canonical *addresses* and a *base-unit* amount (wei / lamports).
 * Converting human → base units requires the token's decimals, and the
 * provider call requires the on-chain address. This module centralises
 * both so the route and the cards agree on one source of truth.
 *
 * EVM addresses delegate to `resolveTokenAddress` (the existing 0x resolver);
 * we only add the per-symbol decimals here. Solana mints live here because
 * the EVM resolver has no Solana table.
 *
 * Unknown tokens return null — the caller surfaces a clear error rather than
 * fabricating a quote with a guessed decimals value (no-mock rule).
 */

import { resolveTokenAddress } from './tokenResolver';

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
// Base58, 32–44 chars, no 0x prefix — a Solana mint/pubkey.
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

// Per-symbol decimals for the platform's supported set. Mirrors the swap
// page TOKEN_LIST; kept here so the server route doesn't import a client
// component. Symbols are uppercased before lookup.
const TOKEN_DECIMALS: Record<string, number> = {
  ETH: 18, WETH: 18, BNB: 18, WBNB: 18, MATIC: 18, WMATIC: 18, AVAX: 18,
  SOL: 9, USDC: 6, USDT: 6, DAI: 18, WBTC: 8, BTC: 8, CBBTC: 8, BTCB: 18,
  LINK: 18, UNI: 18, AAVE: 18, ARB: 18, OP: 18, CRV: 18, MKR: 18,
  PEPE: 18, SHIB: 18, NAKA: 18, DOGE: 8, XRP: 6, ADA: 6,
  WIF: 6, BONK: 5, JUP: 6, RAY: 6,
};

// Canonical Solana mainnet mints for the supported set. Extend carefully —
// cross-reference against a block explorer before adding anything.
const SOLANA_MINTS: Record<string, { mint: string; decimals: number }> = {
  SOL:  { mint: 'So11111111111111111111111111111111111111112', decimals: 9 },
  USDC: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  USDT: { mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
  BONK: { mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
  WIF:  { mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
  JUP:  { mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
  RAY:  { mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6 },
};

export interface SwapTokenMeta {
  /** Canonical on-chain address (EVM contract / 0xEEE… native sentinel / Solana mint). */
  address: string;
  decimals: number;
}

/**
 * Resolve a token symbol *or* address to its canonical on-chain address.
 * Address resolution never needs decimals, so a legacy caller that already
 * has base units can resolve without knowing decimals. Returns null when the
 * symbol is unknown and the input isn't already an address.
 */
export function resolveSwapAddress(token: string, chain: string): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  const upper = trimmed.toUpperCase();

  if (chain.toLowerCase() === 'solana') {
    const known = SOLANA_MINTS[upper];
    if (known) return known.mint;
    if (SOLANA_ADDRESS_RE.test(trimmed)) return trimmed;
    return null;
  }

  if (EVM_ADDRESS_RE.test(trimmed)) return trimmed.toLowerCase();
  return resolveTokenAddress(trimmed, chain);
}

/**
 * Resolve a token's decimals from its symbol, falling back to a caller hint
 * for unknown addresses. Returns null when decimals can't be determined —
 * the caller must then refuse to convert a human amount (no guessed quotes).
 */
export function resolveSwapDecimals(token: string, chain: string, decimalsHint?: number): number | null {
  if (!token) return decimalsHint ?? null;
  const upper = token.trim().toUpperCase();
  if (chain.toLowerCase() === 'solana') {
    const known = SOLANA_MINTS[upper];
    if (known) return known.decimals;
    return decimalsHint ?? null;
  }
  return TOKEN_DECIMALS[upper] ?? decimalsHint ?? null;
}

/**
 * Resolve a token symbol *or* address on a given chain to its canonical
 * address + decimals. Returns null when either can't be determined — used by
 * callers (e.g. the price probe) that always convert a human amount and so
 * need both. Address-only execution callers should use `resolveSwapAddress`.
 *
 * @param token   symbol ("SOL") or address ("0x…" / base58 mint)
 * @param chain   'solana' or an EVM chain name
 * @param decimalsHint optional decimals when the caller already knows them
 */
export function resolveSwapToken(
  token: string,
  chain: string,
  decimalsHint?: number,
): SwapTokenMeta | null {
  const address = resolveSwapAddress(token, chain);
  const decimals = resolveSwapDecimals(token, chain, decimalsHint);
  if (!address || decimals === null) return null;
  return { address, decimals };
}

/**
 * Convert a human amount string ("0.0323") to a base-unit integer string
 * ("32300000") for a token with the given decimals. Uses BigInt-safe
 * rounding so we never emit fractional base units.
 */
export function toBaseUnits(humanAmount: string | number, decimals: number): string {
  const n = typeof humanAmount === 'number' ? humanAmount : parseFloat(humanAmount);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return BigInt(Math.round(n * 10 ** decimals)).toString();
}

/** Convert a base-unit integer string back to a human number. */
export function fromBaseUnits(baseAmount: string | number, decimals: number): number {
  const n = typeof baseAmount === 'number' ? baseAmount : parseFloat(baseAmount);
  if (!Number.isFinite(n)) return 0;
  return n / 10 ** decimals;
}
