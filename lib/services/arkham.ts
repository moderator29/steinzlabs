import 'server-only';
import { arkhamAPI } from '../arkham/api';
import {
  ArkhamEntity,
  ArkhamAddress,
  ArkhamHolder,
  ArkhamConnection,
  ArkhamTransaction,
  EntityPortfolio,
  EntityPerformance,
} from '../arkham/types';
import { cacheKey, TTL, withCache } from '../api/cache-manager';

/**
 * Arkham Intelligence Service
 * Wraps the existing ArkhamAPI with the standardized cache layer.
 * Entity labels cached 24h — they rarely change.
 */

export type {
  ArkhamEntity,
  ArkhamAddress,
  ArkhamHolder,
  ArkhamConnection,
  ArkhamTransaction,
  EntityPortfolio,
  EntityPerformance,
};

export interface EntityLabel {
  entity: string;
  type: string;
  confidence: number;
  verified: boolean;
  logo?: string;
  website?: string;
  // WI4: which provider answered. 'arkham' when Arkham was authoritative,
  // 'nansen' when we fell back to Nansen due to low Arkham confidence,
  // 'fallback' when neither responded (Unknown).
  source?: 'arkham' | 'nansen' | 'fallback';
}

const FALLBACK_LABEL: EntityLabel = {
  entity: 'Unknown',
  type: 'unknown',
  confidence: 0,
  verified: false,
  source: 'fallback',
};

/**
 * WI4: when Arkham confidence is below 70, query Nansen as a secondary
 * label source. Nansen results are merged in via a `source: 'nansen'`
 * tag so callers can downstream-display the provider. Fail-open: any
 * Nansen failure returns the original Arkham label.
 *
 * Nansen API surface: GET https://api.nansen.ai/api/beta/profiler/address/{address}
 * Auth: ?apiKey=$NANSEN_API_KEY in query string. We expose label
 * fields {label, type, confidence} which their endpoint provides under
 * a similar shape.
 */
async function fetchNansenLabel(address: string, chain?: string): Promise<Partial<EntityLabel> | null> {
  const key = process.env.NANSEN_API_KEY;
  if (!key) return null;
  try {
    const url = new URL(`https://api.nansen.ai/api/beta/profiler/address/${encodeURIComponent(address)}`);
    if (chain) url.searchParams.set('chain', chain);
    const res = await fetch(url.toString(), {
      headers: { apiKey: key, accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const j = await res.json() as { label?: string; entityType?: string; confidence?: number; verified?: boolean; logo?: string };
    if (!j.label) return null;
    return {
      entity: j.label,
      type: (j.entityType ?? 'unknown').toLowerCase(),
      confidence: typeof j.confidence === 'number' ? j.confidence : 75,
      verified: Boolean(j.verified),
      logo: j.logo,
      source: 'nansen',
    };
  } catch {
    return null;
  }
}

export async function getEntityLabel(
  address: string,
  chain?: string
): Promise<EntityLabel> {
  const key = cacheKey('arkham', 'entity_label', { address: address.toLowerCase(), chain: chain ?? 'all' });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    let arkhamLabel: EntityLabel | null = null;
    try {
      const intel = await arkhamAPI.getAddressIntel(address, chain);
      if (intel.arkhamEntity) {
        arkhamLabel = {
          entity: intel.arkhamEntity.name,
          type: intel.arkhamEntity.type,
          confidence: intel.arkhamEntity.verified ? 95 : 60,
          verified: intel.arkhamEntity.verified,
          logo: intel.arkhamEntity.logo,
          website: intel.arkhamEntity.website,
          source: 'arkham',
        };
      }
    } catch { /* fall through to Nansen */ }

    // WI4: confidence below 70 → consult Nansen.
    if (!arkhamLabel || arkhamLabel.confidence < 70) {
      const nansen = await fetchNansenLabel(address, chain);
      if (nansen && nansen.entity) {
        // Take Nansen wholesale; preserve Arkham website/logo when Nansen
        // didn't provide its own.
        return {
          entity: nansen.entity,
          type: nansen.type ?? arkhamLabel?.type ?? 'unknown',
          confidence: nansen.confidence ?? 75,
          verified: nansen.verified ?? false,
          logo: nansen.logo ?? arkhamLabel?.logo,
          website: arkhamLabel?.website,
          source: 'nansen',
        };
      }
    }

    return arkhamLabel ?? FALLBACK_LABEL;
  });
}

export async function getAddressIntel(
  address: string,
  chain?: string
): Promise<ArkhamAddress | null> {
  const key = cacheKey('arkham', 'address_intel', { address: address.toLowerCase(), chain: chain ?? 'all' });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      return await arkhamAPI.getAddressIntel(address, chain);
    } catch {
      return null;
    }
  });
}

export async function getEntity(entityId: string): Promise<ArkhamEntity | null> {
  const key = cacheKey('arkham', 'entity', { entityId });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      return await arkhamAPI.getEntity(entityId);
    } catch {
      return null;
    }
  });
}

export async function getAddressTransfers(
  address: string,
  limit = 50,
  chain?: string
): Promise<ArkhamTransaction[]> {
  const key = cacheKey('arkham', 'transfers', { address: address.toLowerCase(), limit, chain: chain ?? 'all' });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      return await arkhamAPI.getAddressTransfers(address, limit, chain);
    } catch {
      return [];
    }
  });
}

export async function getWalletConnections(
  address: string,
  limit = 50
): Promise<ArkhamConnection[]> {
  const key = cacheKey('arkham', 'connections', { address: address.toLowerCase(), limit });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      return await arkhamAPI.getWalletConnections(address, limit);
    } catch {
      return [];
    }
  });
}

export async function getTokenHolders(
  tokenAddress: string,
  limit = 20,
  chain?: string
): Promise<ArkhamHolder[]> {
  const key = cacheKey('arkham', 'holders', { tokenAddress: tokenAddress.toLowerCase(), limit, chain: chain ?? 'all' });
  return withCache(key, TTL.HOLDER_DATA, async () => {
    try {
      return await arkhamAPI.getTokenHolders(tokenAddress, limit, chain);
    } catch {
      return [];
    }
  });
}

export async function getEntityPortfolio(entityId: string): Promise<EntityPortfolio | null> {
  const key = cacheKey('arkham', 'portfolio', { entityId });
  return withCache(key, TTL.WALLET_BALANCE, async () => {
    try {
      return await arkhamAPI.getEntityPortfolio(entityId);
    } catch {
      return null;
    }
  });
}

export async function getEntityPerformance(entityId: string): Promise<EntityPerformance | null> {
  const key = cacheKey('arkham', 'performance', { entityId });
  return withCache(key, TTL.MARKET_CAP, async () => {
    try {
      return await arkhamAPI.getEntityPerformance(entityId);
    } catch {
      return null;
    }
  });
}

export async function searchEntities(query: string): Promise<ArkhamEntity[]> {
  const key = cacheKey('arkham', 'search', { query });
  return withCache(key, TTL.SEARCH_RESULT, async () => {
    try {
      return await arkhamAPI.searchEntities(query);
    } catch {
      return [];
    }
  });
}

export async function isScammer(address: string): Promise<boolean> {
  const key = cacheKey('arkham', 'is_scammer', { address: address.toLowerCase() });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      return await arkhamAPI.isScammer(address);
    } catch {
      return false;
    }
  });
}

export async function getEntityByAddress(address: string): Promise<ArkhamEntity | null> {
  const key = cacheKey('arkham', 'entity_by_address', { address: address.toLowerCase() });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      return await arkhamAPI.getEntityByAddress(address);
    } catch {
      return null;
    }
  });
}
