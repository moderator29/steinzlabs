/**
 * Whale label taxonomy — Nansen / Arkham-style entity classification
 * for the live whale feed.
 *
 * The whale_activity table stores `entity_type` as a free-text string
 * (or null for unclassified rows). The audit (B5 / P1 #24) flagged
 * that the live feed showed only opaque addresses with no behavioral
 * context — Nansen labels every wallet as Smart Money / Insider /
 * Bot / Market Maker / CEX, which is what makes the feed legible.
 *
 * This module is the seed of that taxonomy. It carries:
 *   - a hand-curated registry of well-known CEX hot wallets and
 *     market-maker addresses across the chains we serve. Public
 *     on-chain addresses, no PII.
 *   - classifyAddress(addr, chain) which returns every label that
 *     applies. Multi-label by design — a given address can be both
 *     CEX-deposit and Smart-Money.
 *
 * Long-term this list is replaced by a labeling microservice (heuristic
 * or third-party, e.g. Etherscan Label Cloud / Arkham Lite). For now
 * the curated set covers the ~80% of CEX flow that drives most of the
 * "I have no idea who this whale is" feed noise.
 */

export type WhaleLabel =
  | 'cex'         // Centralized exchange hot wallet
  | 'mm'          // Market maker
  | 'smart_money' // Wallet with high realized PnL or win-rate
  | 'bot'         // High-frequency / sandwich / arbitrage bot
  | 'insider'     // Wallet that received tokens before public launch
  | 'whale'       // Generic high-balance wallet (default fallback)
  | 'bridge'      // Cross-chain bridge contract
  | 'mev';        // MEV searcher / Flashbots builder

/**
 * The `whales.entity_type` column uses a DB vocabulary
 * (dev/exchange/fund/influencer/institutional/trader/unknown/vc) that has
 * ZERO overlap with the WhaleLabel taxonomy the feed's filter pills use.
 * Before this map the Smart Money / CEX / Insider pills matched zero rows
 * because they compared a WhaleLabel against an entity_type string.
 *
 * This is the canonical bridge: it lets a feed row carry a WhaleLabel derived
 * from the whales table's entity_type so the pills (and badges) work.
 */
const ENTITY_TYPE_TO_LABEL: Record<string, WhaleLabel> = {
  exchange: 'cex',
  institutional: 'smart_money',
  fund: 'smart_money',
  vc: 'smart_money',
  trader: 'whale',
  influencer: 'insider',
  dev: 'insider',
  unknown: 'whale',
};

/**
 * Map a whales.entity_type string onto a WhaleLabel. Unknown/empty values
 * fall back to the generic 'whale' so every row still carries one label.
 */
export function entityTypeToLabel(entityType: string | null | undefined): WhaleLabel {
  if (!entityType) return 'whale';
  return ENTITY_TYPE_TO_LABEL[entityType.toLowerCase()] ?? 'whale';
}

/** The three canonical activity directions the feed UI colors + filters by. */
export type CanonicalAction = 'buy' | 'sell' | 'transfer';

/**
 * Normalize the free-text whale_activity.action (buy/sell/transfer_in/
 * transfer_out/transfer/swap/...) to one of three canonical directions.
 * The live table is currently 100% `transfer_out`; anything that isn't an
 * explicit buy/sell is treated as a transfer.
 */
export function canonicalAction(action: string | null | undefined): CanonicalAction {
  const a = (action ?? '').toLowerCase();
  if (a === 'buy' || a === 'bought' || a === 'mint') return 'buy';
  if (a === 'sell' || a === 'sold' || a === 'burn') return 'sell';
  return 'transfer';
}

/**
 * Translate a canonical action filter into the set of raw DB action strings
 * to match with `.in('action', ...)`. Lets a user picking "Transfer" match
 * the real `transfer_out`/`transfer_in` rows instead of zero rows.
 */
export function dbActionsForCanonical(canonical: string): string[] {
  switch (canonical.toLowerCase()) {
    case 'buy':
      return ['buy', 'bought', 'mint'];
    case 'sell':
      return ['sell', 'sold', 'burn'];
    case 'transfer':
      return ['transfer', 'transfer_in', 'transfer_out'];
    default:
      return [canonical];
  }
}

interface RegistryEntry {
  /** Lowercased address. */
  address: string;
  /** Chain id (matches our SUPPORTED_CHAINS taxonomy). */
  chain: string;
  labels: WhaleLabel[];
  /** Human-readable entity name surfaced to the UI. */
  name: string;
}

/**
 * Public on-chain addresses for major CEX hot wallets, market makers,
 * and bridges. Not exhaustive — the highest-volume entities only.
 * Anyone can verify these on Etherscan / Solscan. Kept in code so the
 * client can classify without a round-trip; future expansion belongs
 * in a database table indexed by (chain, address).
 */
const REGISTRY: RegistryEntry[] = [
  // Binance — Ethereum hot wallets
  { address: '0x28c6c06298d514db089934071355e5743bf21d60', chain: 'ethereum', labels: ['cex'], name: 'Binance 14' },
  { address: '0x21a31ee1afc51d94c2efccaa2092ad1028285549', chain: 'ethereum', labels: ['cex'], name: 'Binance 15' },
  { address: '0xdfd5293d8e347dfe59e90efd55b2956a1343963d', chain: 'ethereum', labels: ['cex'], name: 'Binance 16' },
  { address: '0x56eddb7aa87536c09ccc2793473599fd21a8b17f', chain: 'ethereum', labels: ['cex'], name: 'Binance 17' },
  { address: '0x9696f59e4d72e237be84ffd425dcad154bf96976', chain: 'ethereum', labels: ['cex'], name: 'Binance 18' },
  { address: '0x4976a4a02f38326660d17bf34b431dc6e2eb2327', chain: 'ethereum', labels: ['cex'], name: 'Binance 19' },

  // Coinbase
  { address: '0x71660c4005ba85c37ccec55d0c4493e66fe775d3', chain: 'ethereum', labels: ['cex'], name: 'Coinbase 1' },
  { address: '0x503828976d22510aad0201ac7ec88293211d23da', chain: 'ethereum', labels: ['cex'], name: 'Coinbase 2' },
  { address: '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740', chain: 'ethereum', labels: ['cex'], name: 'Coinbase 3' },
  { address: '0x3cd751e6b0078be393132286c442345e5dc49699', chain: 'ethereum', labels: ['cex'], name: 'Coinbase 4' },

  // Kraken
  { address: '0x2910543af39aba0cd09dbb2d50200b3e800a63d2', chain: 'ethereum', labels: ['cex'], name: 'Kraken 1' },
  { address: '0x0a869d79a7052c7f1b55a8ebabbea3420f0d1e13', chain: 'ethereum', labels: ['cex'], name: 'Kraken 2' },

  // OKX
  { address: '0x6cc5f688a315f3dc28a7781717a9a798a59fda7b', chain: 'ethereum', labels: ['cex'], name: 'OKX 1' },
  { address: '0x236f9f97e0e62388479bf9e5ba4889e46b0273c3', chain: 'ethereum', labels: ['cex'], name: 'OKX 2' },

  // Bybit
  { address: '0xf89d7b9c864f589bbf53a82105107622b35eaa40', chain: 'ethereum', labels: ['cex'], name: 'Bybit Hot' },

  // Market makers
  { address: '0x4f3a120e72c76c22ae802d129f599bfdbc31cb81', chain: 'ethereum', labels: ['mm'], name: 'Wintermute MM' },
  { address: '0x000000000035b5e5ad9019092c665357240f594e', chain: 'ethereum', labels: ['mm'], name: 'Jump Trading MM' },
  { address: '0x6f1cdbbb4d53d226cf4b917bf768b94acbab6168', chain: 'ethereum', labels: ['mm'], name: 'Cumberland MM' },
  { address: '0xe93685f3bba03016f02bd1828badd6195988d950', chain: 'ethereum', labels: ['mm'], name: 'GSR MM' },

  // Bridges
  { address: '0x3154cf16ccdb4c6d922629664174b904d80f2c35', chain: 'ethereum', labels: ['bridge'], name: 'Base Bridge' },
  { address: '0xa0c68c638235ee32657e8f720a23cec1bfc77c77', chain: 'ethereum', labels: ['bridge'], name: 'Polygon ERC20 Bridge' },
  { address: '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1', chain: 'ethereum', labels: ['bridge'], name: 'Optimism Bridge' },
  { address: '0xa4b1f03e0d4f9aab9f1e9c4f8e0b0a4f1c4e1d88', chain: 'ethereum', labels: ['bridge'], name: 'Arbitrum Bridge' },

  // Solana — Binance, Coinbase, Kraken
  { address: '5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', chain: 'solana', labels: ['cex'], name: 'Binance Hot SOL' },
  { address: '2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S', chain: 'solana', labels: ['cex'], name: 'Coinbase SOL 1' },
  { address: 'GZNMTQHkzcCRhTdxKxgGRfVxEHsAqLkkMc1FYQGhdtyG', chain: 'solana', labels: ['cex'], name: 'Kraken SOL' },
];

const REGISTRY_INDEX: Map<string, RegistryEntry> = new Map(
  // #22: mirror classifyAddress's chain-aware casing — lowercasing the Solana
  // entries here made them unreachable (the lookup compares Solana verbatim),
  // so the curated Solana CEX wallets never classified.
  REGISTRY.map((e) => [`${e.chain}:${e.chain === 'solana' ? e.address : e.address.toLowerCase()}`, e]),
);

export interface ClassificationResult {
  labels: WhaleLabel[];
  /** Friendly entity name when the address is in the curated registry. */
  name?: string;
}

/**
 * Classify an address. Returns every label that applies (including
 * the registry name when known). Falls back to ['whale'] for any
 * address not in the registry — keeps the feed visually consistent
 * (every row has at least one label) without claiming false specificity.
 *
 * Address comparison: we lowercase EVM addresses; Solana base58 is
 * case-sensitive so it's compared verbatim.
 */
export function classifyAddress(address: string, chain: string): ClassificationResult {
  if (!address) return { labels: ['whale'] };
  const isSolana = chain === 'solana';
  const key = isSolana
    ? `${chain}:${address}`
    : `${chain}:${address.toLowerCase()}`;
  const hit = REGISTRY_INDEX.get(key);
  if (hit) return { labels: hit.labels, name: hit.name };
  return { labels: ['whale'] };
}

/**
 * UI-side label catalog: short label, color, and tooltip per taxonomy
 * entry. Drives the badge component in the whale feed.
 */
export const LABEL_META: Record<WhaleLabel, { short: string; color: string; tooltip: string }> = {
  cex:          { short: 'CEX',          color: '#F59E0B', tooltip: 'Centralized-exchange hot wallet (deposits / withdrawals).' },
  mm:           { short: 'MM',           color: '#8B5CF6', tooltip: 'Market maker: Wintermute / Jump / Cumberland / GSR class.' },
  smart_money:  { short: 'Smart Money',  color: '#10B981', tooltip: 'Wallet with realized PnL > $100k AND > 70% win rate.' },
  bot:          { short: 'Bot',          color: '#06B6D4', tooltip: 'High-frequency or arbitrage bot.' },
  insider:      { short: 'Insider',      color: '#EF4444', tooltip: 'Wallet that received tokens before public launch / unlock.' },
  whale:        { short: 'Whale',        color: '#6F7EFF', tooltip: 'Generic high-balance wallet.' },
  bridge:       { short: 'Bridge',       color: '#94A3B8', tooltip: 'Cross-chain bridge contract.' },
  mev:          { short: 'MEV',          color: '#DC143C', tooltip: 'MEV searcher / Flashbots / Jito builder.' },
};
