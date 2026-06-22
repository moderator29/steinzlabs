import 'server-only';
import { getBestPair, searchPairs, getPair, type DexPair } from '@/lib/services/dexscreener';

/**
 * Resolve a Conviction Board asset (a token address or a free-text symbol like
 * "$NAKA") to a DEX price + the pair to re-price it against later. Used to
 * capture an entry price at post time so the scoring cron can grade the call.
 * Best-effort and never throws — an unresolvable asset just won't auto-score.
 */

const isEvmAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

function deepestLiquidity(pairs: DexPair[]): DexPair | null {
  if (pairs.length === 0) return null;
  return pairs.slice().sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

export interface ResolvedPrice {
  priceUsd: number;
  pairRef: string;
  pairChain: string;
}

export async function resolveAssetPrice(asset: string, chain?: string | null): Promise<ResolvedPrice | null> {
  const q = asset.replace(/^\$/, '').trim();
  if (!q) return null;
  try {
    let pair: DexPair | null = null;
    if (isEvmAddress(q)) pair = await getBestPair(q);
    if (!pair) {
      const results = await searchPairs(q);
      const scoped = chain ? results.filter((p) => p.chainId.toLowerCase() === chain.toLowerCase()) : results;
      pair = deepestLiquidity(scoped.length > 0 ? scoped : results);
    }
    if (!pair) return null;
    const price = Number(pair.priceUsd);
    if (!Number.isFinite(price) || price <= 0) return null;
    return { priceUsd: price, pairRef: pair.pairAddress, pairChain: pair.chainId };
  } catch {
    return null;
  }
}

export async function currentPairPrice(chain: string, pairAddress: string): Promise<number | null> {
  try {
    const p = await getPair(chain, pairAddress);
    const price = p ? Number(p.priceUsd) : NaN;
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}
