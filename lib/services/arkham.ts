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
}

const FALLBACK_LABEL: EntityLabel = {
  entity: 'Unknown',
  type: 'unknown',
  confidence: 0,
  verified: false,
};

export async function getEntityLabel(
  address: string,
  chain?: string
): Promise<EntityLabel> {
  const key = cacheKey('arkham', 'entity_label', { address: address.toLowerCase(), chain: chain ?? 'all' });
  return withCache(key, TTL.ENTITY_LABEL, async () => {
    try {
      const intel = await arkhamAPI.getAddressIntel(address, chain);
      if (!intel.arkhamEntity) return FALLBACK_LABEL;
      return {
        entity: intel.arkhamEntity.name,
        type: intel.arkhamEntity.type,
        confidence: intel.arkhamEntity.verified ? 95 : 60,
        verified: intel.arkhamEntity.verified,
        logo: intel.arkhamEntity.logo,
        website: intel.arkhamEntity.website,
      };
    } catch {
      return FALLBACK_LABEL;
    }
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
