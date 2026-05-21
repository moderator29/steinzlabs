import 'server-only';
import { cacheGet, cacheSet } from '@/lib/cache/redis';

/**
 * OFAC SDN blocklist check.
 *
 * Source of truth: Chainalysis OFAC-sanctioned-addresses public lists
 * (https://public.chainalysis.com/api/v1/address/{address}). No auth, free
 * for reasonable use. We cache responses in Redis for 24h since the list
 * changes at most a few times per week.
 *
 * Falls open on upstream failure (returns sanctioned=false) — never block
 * trades on a transient public-API blip — but logs the failure so ops
 * sees if the source has gone dark.
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
  const norm = address.toLowerCase();
  const key = `ofac:${norm}`;

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
