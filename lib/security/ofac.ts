import 'server-only';
import { cacheGet, cacheSet } from '@/lib/cache/redis';
import { normalizeAddress } from '@/lib/utils/addressNormalize';

/**
 * OFAC SDN blocklist check.
 *
 * Source of truth: Chainalysis OFAC-sanctioned-addresses public lists
 * (https://public.chainalysis.com/api/v1/address/{address}). No auth, free
 * for reasonable use. We cache responses in Redis for 24h since the list
 * changes at most a few times per week.
 *
 * Default mode falls open on upstream failure (returns sanctioned=false) so
 * display surfaces (badge on a profile, sidebar warning) don't break on a
 * transient public-API blip. The swap / fund-movement path MUST use
 * `checkOfacStrict()` which treats 'unavailable' as a hard fail.
 */

const CHAINALYSIS_URL = 'https://public.chainalysis.com/api/v1/address';
const CACHE_TTL_SECONDS = 24 * 60 * 60;

export interface OfacCheckResult {
  address: string;
  sanctioned: boolean;
  identifications: Array<{ category?: string; name?: string; description?: string }>;
  source: 'chainalysis' | 'cache' | 'unavailable';
}

export async function checkOfac(address: string): Promise<OfacCheckResult> {
  // Cache key must preserve Solana case (base58 is case-sensitive); EVM is
  // lowercased. A raw .toLowerCase() collided distinct Solana addresses.
  const key = `ofac:${normalizeAddress(address)}`;

  const cached = await cacheGet<OfacCheckResult>(key);
  if (cached) return { ...cached, source: 'cache' };

  try {
    const res = await fetch(`${CHAINALYSIS_URL}/${address}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) {
      return { address, sanctioned: false, identifications: [], source: 'unavailable' };
    }
    const json = (await res.json()) as { identifications?: OfacCheckResult['identifications'] };
    const result: OfacCheckResult = {
      address,
      sanctioned: Array.isArray(json.identifications) && json.identifications.length > 0,
      identifications: json.identifications ?? [],
      source: 'chainalysis',
    };
    void cacheSet(key, result, CACHE_TTL_SECONDS);
    return result;
  } catch {
    return { address, sanctioned: false, identifications: [], source: 'unavailable' };
  }
}

/**
 * Strict OFAC check for fund-movement / swap-execute / withdrawal paths.
 *
 * Treats `source === 'unavailable'` as sanctioned=true so that an upstream
 * outage CANNOT silently let a sanctioned-wallet trade through. Callers
 * should display a clear "compliance check unavailable, try again later"
 * message to the user instead of executing.
 */
export async function checkOfacStrict(address: string): Promise<OfacCheckResult> {
  const result = await checkOfac(address);
  if (result.source === 'unavailable') {
    return { ...result, sanctioned: true };
  }
  return result;
}
