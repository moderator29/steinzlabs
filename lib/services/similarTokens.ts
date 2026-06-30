import 'server-only';
import { searchPairs, type DexPair } from './dexscreener';
import { addressesEqual } from '../utils/addressNormalize';

/**
 * Similar-token discovery for the Contract Analyzer.
 *
 * Surfaces OTHER tokens that share the queried token's ticker/name (the MEVX
 * "Similar Token Info" panel). These are NOT the same token — they are
 * impersonators, older tokens, or unrelated launches that happen to share a
 * symbol. Used to help a user spot a copycat before they trade the wrong one.
 *
 * Real data only — DexScreener `searchPairs`. No fabricated rows; an empty
 * result is returned honestly when nothing matches.
 */

export interface SimilarToken {
  address: string;
  symbol: string;
  name: string;
  chain: string;
  liquidityUsd: number;
  marketCap: number;
  imageUrl: string | null;
  ageMs: number | null;
  url: string;
}

/** Map a DexScreener chainId to the analyzer's chain ids (so re-analyze works). */
const CHAIN_ALIAS: Record<string, string> = {
  ethereum: 'ethereum',
  bsc: 'bsc',
  polygon: 'polygon',
  base: 'base',
  arbitrum: 'arbitrum',
  avalanche: 'avalanche',
  solana: 'solana',
};

function normalizeChain(chainId: string): string {
  return CHAIN_ALIAS[chainId.toLowerCase()] ?? chainId.toLowerCase();
}

/**
 * Find up to `limit` tokens sharing the given symbol, excluding the queried
 * address. Dedupes by base-token address (keeping the highest-liquidity pair
 * per token) and ranks by liquidity descending.
 */
export async function findSimilarTokens(
  query: string,
  excludeAddress: string,
  limit = 6
): Promise<SimilarToken[]> {
  const q = (query || '').trim();
  if (!q) return [];

  let pairs: DexPair[];
  try {
    pairs = await searchPairs(q);
  } catch {
    return [];
  }
  if (!pairs.length) return [];

  const qLower = q.toLowerCase();

  // Keep only pairs whose base token actually matches the symbol/name (search
  // is fuzzy and returns the quote side too) and isn't the queried token.
  const byToken = new Map<string, DexPair>();
  for (const pair of pairs) {
    const base = pair.baseToken;
    if (!base?.address) continue;

    // Exclude the token the user is already analyzing (chain-aware compare).
    if (addressesEqual(base.address, excludeAddress, normalizeChain(pair.chainId))) continue;

    const symbol = (base.symbol || '').toLowerCase();
    const name = (base.name || '').toLowerCase();
    const matches = symbol === qLower || name === qLower || symbol.includes(qLower) || name.includes(qLower);
    if (!matches) continue;

    const existing = byToken.get(base.address);
    if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
      byToken.set(base.address, pair);
    }
  }

  const result: SimilarToken[] = Array.from(byToken.values())
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
    .slice(0, limit)
    .map((pair) => ({
      address: pair.baseToken.address,
      symbol: pair.baseToken.symbol || '',
      name: pair.baseToken.name || pair.baseToken.symbol || '',
      chain: normalizeChain(pair.chainId),
      liquidityUsd: pair.liquidity?.usd ?? 0,
      marketCap: pair.marketCap ?? pair.fdv ?? 0,
      imageUrl: pair.info?.imageUrl ?? null,
      ageMs: pair.pairCreatedAt ? Date.now() - pair.pairCreatedAt : null,
      url: pair.url,
    }));

  return result;
}
