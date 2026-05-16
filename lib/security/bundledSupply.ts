/**
 * Bundled-supply detector. A "bundle" is when one entity sniped a
 * meaningful share of token supply in the first N blocks after
 * liquidity was added — usually via multiple wallets all funded by
 * the same source. The pattern correlates almost perfectly with
 * rug events; bundled tokens dump within hours of launch.
 *
 * Audit §5.8 B.4 — fresh primitive. Pure detector — caller provides
 * first-N-block buy events that have already been clustered into
 * entities (via the existing wallet-clustering pipeline). Output:
 * top bundled entities + total bundled %.
 */

export interface EarlyBuy {
  /** Wallet that received tokens. */
  wallet: string;
  /** Entity / cluster id this wallet belongs to. Falls back to wallet itself. */
  entity?: string;
  /** Block number relative to liquidity add (0 = same block). */
  blocksSinceLp: number;
  /** Fraction of total supply received (0..1). */
  supplyShare: number;
}

export interface BundledEntity {
  entity: string;
  walletCount: number;
  totalShare: number;
  firstBlock: number;
  lastBlock: number;
}

export interface BundledSupplyResult {
  /** Aggregated bundled share across all flagged entities (0..1). */
  bundledShare: number;
  /** Top bundled entities ordered by total share desc. */
  entities: BundledEntity[];
  /** Convenience flag: >5% bundled supply is the audit cutoff. */
  isBundled: boolean;
}

const DEFAULT_WINDOW_BLOCKS = 5;
const DEFAULT_BUNDLE_THRESHOLD = 0.005; // 0.5% per entity to count

export interface DetectBundledOptions {
  /** How many blocks past LP-add count as "early". Default 5. */
  windowBlocks?: number;
  /** Per-entity supply-share floor to be considered a bundle. */
  entityThreshold?: number;
}

export function detectBundledSupply(
  buys: EarlyBuy[],
  options: DetectBundledOptions = {},
): BundledSupplyResult {
  const windowBlocks = options.windowBlocks ?? DEFAULT_WINDOW_BLOCKS;
  const entityThreshold = options.entityThreshold ?? DEFAULT_BUNDLE_THRESHOLD;

  const groups = new Map<string, { walletCount: number; totalShare: number; firstBlock: number; lastBlock: number; wallets: Set<string> }>();

  for (const b of buys) {
    if (b.blocksSinceLp < 0 || b.blocksSinceLp > windowBlocks) continue;
    if (!Number.isFinite(b.supplyShare) || b.supplyShare <= 0) continue;
    const key = b.entity ?? b.wallet;
    if (!groups.has(key)) {
      groups.set(key, {
        walletCount: 0,
        totalShare: 0,
        firstBlock: b.blocksSinceLp,
        lastBlock: b.blocksSinceLp,
        wallets: new Set<string>(),
      });
    }
    const row = groups.get(key)!;
    row.wallets.add(b.wallet);
    row.walletCount = row.wallets.size;
    row.totalShare += b.supplyShare;
    if (b.blocksSinceLp < row.firstBlock) row.firstBlock = b.blocksSinceLp;
    if (b.blocksSinceLp > row.lastBlock) row.lastBlock = b.blocksSinceLp;
  }

  const entities: BundledEntity[] = Array.from(groups.entries())
    .filter(([, v]) => v.totalShare >= entityThreshold)
    .map(([k, v]) => ({
      entity: k,
      walletCount: v.walletCount,
      totalShare: v.totalShare,
      firstBlock: v.firstBlock,
      lastBlock: v.lastBlock,
    }))
    .sort((a, b) => b.totalShare - a.totalShare);

  const bundledShare = entities.reduce((s, e) => s + e.totalShare, 0);
  return { bundledShare, entities, isBundled: bundledShare > 0.05 };
}
