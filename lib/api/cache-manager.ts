import 'server-only';

/**
 * In-memory response cache with per-data-type TTLs.
 * Prevents redundant API calls across service functions.
 *
 * Cache key format: {service}:{endpoint}:{params_hash}
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

// TTL constants (milliseconds)
export const TTL = {
  TOKEN_PRICE:        30_000,      // 30 seconds
  TOKEN_SECURITY:     5 * 60_000,  // 5 minutes
  WALLET_BALANCE:     60_000,      // 60 seconds
  SOCIAL_SENTIMENT:   3 * 60_000,  // 3 minutes
  ENTITY_LABEL:       24 * 3600_000, // 24 hours
  MARKET_CAP:         2 * 60_000,  // 2 minutes
  NEW_TOKEN:          10_000,      // 10 seconds
  SWAP_ROUTE:         15_000,      // 15 seconds
  SEARCH_RESULT:      60_000,      // 60 seconds
  HOLDER_DATA:        5 * 60_000,  // 5 minutes
  GENERAL:            2 * 60_000,  // 2 minutes default
} as const;

class CacheManager {
  private store: Map<string, CacheEntry> = new Map();
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Run cleanup every 5 minutes to prevent memory leaks
    if (typeof setInterval !== 'undefined') {
      this.cleanupIntervalId = setInterval(() => this.cleanup(), 5 * 60_000);
    }
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set(key: string, data: unknown, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// Single shared cache instance for the process
export const cache = new CacheManager();

/**
 * Generate a deterministic cache key from service name, endpoint, and params.
 * Uses a simple hash to keep keys short.
 */
export function cacheKey(service: string, endpoint: string, params?: Record<string, unknown>): string {
  if (!params) return `${service}:${endpoint}`;
  const paramsStr = JSON.stringify(params, Object.keys(params).sort());
  const hash = simpleHash(paramsStr);
  return `${service}:${endpoint}:${hash}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Wrapper: get from cache or execute fetcher and cache the result.
 */
export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  cache.set(key, data, ttlMs);
  return data;
}
