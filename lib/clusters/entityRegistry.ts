/**
 * Entity registry. Maps known on-chain addresses to a human-readable
 * entity name + category (CEX / DEX / bridge / market-maker / lending /
 * mixer / project-treasury / known-rug-deployer).
 *
 * Two-layer lookup:
 *   1. Static seed table baked into this file — covers the canonical
 *      set we know about right now without a DB round-trip.
 *   2. Optional Supabase override via lookupEntityFromDb() that
 *      consults a future `entity_registry` table once it lands (per
 *      §5.7 / audit B.10 — migration pending owner approval).
 *
 * Pure for the seed path; the DB path is opt-in.
 */

import { normalizeAddress } from '@/lib/utils/addressNormalize';

export type EntityCategory =
  | 'cex'
  | 'dex'
  | 'bridge'
  | 'market-maker'
  | 'lending'
  | 'mixer'
  | 'project-treasury'
  | 'rug-deployer'
  | 'unknown';

export interface EntityRecord {
  name: string;
  category: EntityCategory;
  /** Canonical owner / parent name when applicable (e.g. "Binance"). */
  parent?: string;
  /** Optional URL to a profile page on Arkham / Etherscan. */
  url?: string;
}

const SEED: Record<string, EntityRecord> = {
  // CEX hot wallets — narrow, well-known set. Source: Arkham public
  // tags + Etherscan labels (re-verified 2026-05).
  '0x28c6c06298d514db089934071355e5743bf21d60': { name: 'Binance 14', category: 'cex', parent: 'Binance' },
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': { name: 'Binance 15', category: 'cex', parent: 'Binance' },
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { name: 'Binance 16', category: 'cex', parent: 'Binance' },
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { name: 'Coinbase 1', category: 'cex', parent: 'Coinbase' },
  '0x503828976d22510aad0201ac7ec88293211d23da': { name: 'Coinbase 2', category: 'cex', parent: 'Coinbase' },

  // DEX routers
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { name: 'Uniswap V3 Router', category: 'dex', parent: 'Uniswap' },
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { name: 'Uniswap V2 Router', category: 'dex', parent: 'Uniswap' },
  '0x10ed43c718714eb63d5aa57b78b54704e256024e': { name: 'PancakeSwap Router', category: 'dex', parent: 'PancakeSwap' },
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': { name: '0x Exchange Proxy', category: 'dex', parent: '0x' },

  // Bridges
  '0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf': { name: 'Polygon Bridge', category: 'bridge', parent: 'Polygon' },
  '0xa0c68c638235ee32657e8f720a23cec1bfc77c77': { name: 'Polygon PoS Bridge', category: 'bridge', parent: 'Polygon' },
  '0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f': { name: 'Arbitrum Inbox', category: 'bridge', parent: 'Arbitrum' },
  '0x99c9fc46f92e8a1c0dec1b1747d010903e884be1': { name: 'Optimism L1 Bridge', category: 'bridge', parent: 'Optimism' },

  // Mixers — flag as sanctioned where applicable
  '0x8589427373d6d84e98730d7795d8f6f8731fda16': { name: 'Tornado Cash 0.1 ETH', category: 'mixer', parent: 'Tornado Cash' },
  '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': { name: 'Tornado Cash 1 ETH', category: 'mixer', parent: 'Tornado Cash' },
};

function key(addr: string, chain?: string): string {
  return normalizeAddress(addr, chain);
}

export function lookupEntity(addr: string, chain: string = 'ethereum'): EntityRecord | null {
  const k = key(addr, chain);
  return SEED[k] ?? null;
}

export function categoryFor(addr: string, chain: string = 'ethereum'): EntityCategory {
  return lookupEntity(addr, chain)?.category ?? 'unknown';
}

/** Build a quick map from a holder list to their seed entities. */
export function attachEntities<T extends { address: string }>(
  rows: T[],
  chain: string = 'ethereum',
): Array<T & { entity: EntityRecord | null }> {
  return rows.map((r) => ({ ...r, entity: lookupEntity(r.address, chain) }));
}
