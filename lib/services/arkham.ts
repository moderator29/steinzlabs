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
import { getTokenSecurity, getAddressSecurity } from './goplus';

/**
 * Arkham Intelligence Service
 * Wraps the existing ArkhamAPI with the standardized cache layer.
 * Entity labels cached 24h — they rarely change.
 *
 * FREE FALLBACK (2026-07-03): Arkham is a PAID API outside the owner's
 * free-tier matrix, so without ARKHAM_API_KEY every call threw and callers
 * got empty data (ShadowGuardian blocked all trades, bubble-map showed no
 * holders, whale entity labels were blank). The token-holder and
 * address-intel paths now fall back to GoPlus (free, multichain) so the
 * intelligence surfaces work with no paid key. Arkham still wins when a key
 * is present.
 */

const ARKHAM_ENABLED = !!process.env.ARKHAM_API_KEY;

/** Map GoPlus holder rows → ArkhamHolder shape (free multichain top holders). */
async function goplusTokenHolders(
  tokenAddress: string,
  limit: number,
  chain?: string,
): Promise<ArkhamHolder[]> {
  try {
    const sec = await getTokenSecurity(tokenAddress, chain || 'ethereum');
    const raw = (sec as { raw?: { _holders?: Array<Record<string, unknown>> } }).raw;
    const holders = Array.isArray(raw?._holders) ? raw!._holders! : [];
    return holders.slice(0, limit).map((h) => {
      const tag = typeof h.tag === 'string' ? h.tag.toLowerCase() : '';
      const labels: string[] = [];
      if (h.is_contract === 1 || h.is_contract === '1') labels.push('contract');
      if (tag) labels.push(tag);
      if (/scam|phish|rug|blacklist|malicious/.test(tag)) labels.push('scammer');
      return {
        address: String(h.address ?? ''),
        balance: String(h.balance ?? '0'),
        balanceUSD: '0',
        percentage: parseFloat(String(h.percent ?? '0')) * 100 || 0,
        labels: labels.length ? labels : undefined,
      } as ArkhamHolder;
    }).filter((h) => h.address);
  } catch {
    return [];
  }
}

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
    if (ARKHAM_ENABLED) {
      try {
        return await arkhamAPI.getAddressIntel(address, chain);
      } catch { /* fall through to free source */ }
    }
    // Free fallback: GoPlus address security surfaces malicious/scam flags
    // so ShadowGuardian can still flag known-bad holders without Arkham.
    try {
      const sec = await getAddressSecurity(address, chain || 'ethereum');
      const flags = sec as unknown as Record<string, unknown>;
      const isMalicious = Object.entries(flags).some(([k, v]) =>
        /scam|phish|honeypot|blacklist|malicious|fake|stealing|cybercrime/i.test(k) &&
        (v === '1' || v === 1 || v === true));
      if (!isMalicious) return null;
      return {
        address,
        arkhamEntity: { name: 'Flagged address (GoPlus)', type: 'scammer', verified: false },
        scamHistory: { totalRugs: 0, totalStolen: '$0' },
      } as unknown as ArkhamAddress;
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
    if (ARKHAM_ENABLED) {
      try {
        const arkhamHolders = await arkhamAPI.getTokenHolders(tokenAddress, limit, chain);
        if (arkhamHolders.length) return arkhamHolders;
      } catch { /* fall through to free source */ }
    }
    // Free multichain fallback — real top holders from GoPlus.
    return goplusTokenHolders(tokenAddress, limit, chain);
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
