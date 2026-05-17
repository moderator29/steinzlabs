/**
 * Launch-bundling detector. Looks at the first N blocks (EVM) or
 * the first ~30s of slots (Solana) after LP add and flags when a
 * suspiciously large share of supply landed in addresses that
 * cluster together (funded by the same source, transferred between
 * each other, or all bought in the same block). These wallets are
 * almost always a single entity holding the token through a sybil
 * spread — a classic 'we lock supply, then dump' rug pattern.
 *
 * Threshold: by default we flag when >= 25% of supply went to a
 * cluster of >= 3 wallets in the launch window. Audit §B.4 P1.
 */

export interface LaunchBuy {
  buyer: string;
  /** UNIX seconds of the buy. */
  at: number;
  /** % of total supply this buy claimed (0..100). */
  pctOfSupply: number;
  /** Cluster id this buyer belongs to, if the cluster pipeline already grouped them. */
  clusterId?: string | null;
}

export interface BundlingVerdict {
  /** True if the launch shows a sybil-bundling pattern. */
  bundled: boolean;
  /** Wallet count in the suspect cluster. */
  bundleSize: number;
  /** Combined supply % the cluster grabbed in the launch window. */
  bundlePctOfSupply: number;
  /** Wallet addresses in the cluster — UI shows them in the warning. */
  bundleAddresses: string[];
}

export interface DetectOptions {
  /** Min number of wallets to count as a bundle. Default 3. */
  minBundleSize?: number;
  /** Min supply % a bundle must claim to flag. Default 25. */
  minBundlePctOfSupply?: number;
}

/**
 * Detect launch bundling. Groups buys by clusterId (when available)
 * or by 'unknown-<i>' singleton; sums supply per cluster; flags the
 * top cluster if it crosses both thresholds.
 */
export function detectLaunchBundling(buys: LaunchBuy[], opts: DetectOptions = {}): BundlingVerdict {
  const minBundle = opts.minBundleSize ?? 3;
  const minPct = opts.minBundlePctOfSupply ?? 25;

  const byCluster = new Map<string, { addresses: Set<string>; pct: number }>();
  for (const b of buys) {
    const key = b.clusterId ?? `solo-${b.buyer}`;
    const prior = byCluster.get(key) ?? { addresses: new Set<string>(), pct: 0 };
    prior.addresses.add(b.buyer);
    prior.pct += b.pctOfSupply;
    byCluster.set(key, prior);
  }

  let topSize = 0;
  let topPct = 0;
  let topAddresses: string[] = [];
  for (const { addresses, pct } of byCluster.values()) {
    if (addresses.size > topSize || (addresses.size === topSize && pct > topPct)) {
      topSize = addresses.size;
      topPct = pct;
      topAddresses = Array.from(addresses);
    }
  }

  const bundled = topSize >= minBundle && topPct >= minPct;
  return {
    bundled,
    bundleSize: topSize,
    bundlePctOfSupply: Math.min(100, topPct),
    bundleAddresses: bundled ? topAddresses : [],
  };
}
