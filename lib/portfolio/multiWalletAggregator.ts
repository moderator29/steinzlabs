/**
 * Multi-wallet portfolio aggregator. Combines holdings from N wallets
 * (possibly across multiple chains) into a single deduplicated
 * HoldingRow[] so the UI can render 'all wallets' view without
 * showing the same token twice.
 *
 * Pure transform — caller fetches the per-wallet holdings; this lib
 * dedupes + sums. Audit §B.1 multi-wallet aggregation.
 */

export interface RawHolding {
  walletAddress: string;
  chain: string;
  tokenAddress: string;
  symbol: string;
  name: string | null;
  balance: number;
  valueUsd: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  iconUrl: string | null;
}

export interface AggregatedHolding {
  chain: string;
  tokenAddress: string;
  symbol: string;
  name: string | null;
  totalBalance: number;
  totalValueUsd: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  iconUrl: string | null;
  /** Per-wallet breakdown so the UI can expand to show 'in 0xabc: 1.2 / in 0xdef: 0.4'. */
  walletBreakdown: Array<{ walletAddress: string; balance: number; valueUsd: number }>;
}

/**
 * Build the dedupe key. token addresses are case-sensitive on Solana,
 * lowercase on EVM — caller is responsible for passing already-
 * normalized addresses (lib/utils/addressNormalize.ts).
 */
function makeKey(h: RawHolding): string {
  return `${h.chain}:${h.tokenAddress}`;
}

export function aggregateHoldings(rows: RawHolding[]): AggregatedHolding[] {
  const map = new Map<string, AggregatedHolding>();
  for (const h of rows) {
    const key = makeKey(h);
    const prior = map.get(key);
    if (prior) {
      prior.totalBalance += h.balance;
      prior.totalValueUsd += h.valueUsd;
      prior.walletBreakdown.push({ walletAddress: h.walletAddress, balance: h.balance, valueUsd: h.valueUsd });
      // Latest price wins — different wallets see the same global price.
      if (h.priceUsd !== null) prior.priceUsd = h.priceUsd;
      if (h.priceChange24h !== null) prior.priceChange24h = h.priceChange24h;
      if (!prior.iconUrl && h.iconUrl) prior.iconUrl = h.iconUrl;
    } else {
      map.set(key, {
        chain: h.chain,
        tokenAddress: h.tokenAddress,
        symbol: h.symbol,
        name: h.name,
        totalBalance: h.balance,
        totalValueUsd: h.valueUsd,
        priceUsd: h.priceUsd,
        priceChange24h: h.priceChange24h,
        iconUrl: h.iconUrl,
        walletBreakdown: [{ walletAddress: h.walletAddress, balance: h.balance, valueUsd: h.valueUsd }],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.totalValueUsd - a.totalValueUsd);
}

/**
 * Totals across the aggregated set. Caller renders these in the
 * portfolio header.
 */
export interface MultiWalletTotals {
  totalValueUsd: number;
  walletsCounted: number;
  uniqueTokens: number;
  chains: string[];
}

export function totalsFor(
  rows: RawHolding[],
  aggregated: AggregatedHolding[],
): MultiWalletTotals {
  const walletSet = new Set<string>();
  for (const r of rows) walletSet.add(r.walletAddress);
  const chains = Array.from(new Set(aggregated.map((a) => a.chain)));
  return {
    totalValueUsd: aggregated.reduce((s, a) => s + a.totalValueUsd, 0),
    walletsCounted: walletSet.size,
    uniqueTokens: aggregated.length,
    chains,
  };
}
