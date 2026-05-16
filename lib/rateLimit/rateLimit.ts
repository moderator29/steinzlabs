import 'server-only';
import { getRedis } from '@/lib/cache/redis';

/**
 * Sliding-window rate limiter backed by Upstash Redis. Single primitive
 * for webhooks, public API endpoints, and any surface that needs a
 * per-key cap. Fails OPEN when Upstash is unreachable so a Redis
 * outage doesn't cascade into a platform outage — the rest of the
 * stack already treats Upstash as a soft dependency.
 *
 * Counter semantics: increment a per-(key, bucket) counter with a TTL
 * equal to the window length; if the incremented value exceeds the
 * limit, deny. Simple, idempotent, no Lua, plays well with Upstash
 * REST.
 *
 * §5.19 — webhook rate limits on /api/sniper-detect, Alchemy webhook,
 * Helius webhook. Per-chain key so a sniper-heavy chain can't starve
 * a quiet one.
 */

export interface RateLimitOptions {
  /** Stable identifier of the surface (e.g. "alchemy-webhook"). */
  scope: string;
  /** Per-caller key (chain, IP, user id, etc.). */
  key: string;
  /** Max requests per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { scope, key, limit, windowSec } = opts;
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSec);
  const resetAt = (bucket + 1) * windowSec;
  const redis = getRedis();
  if (!redis) {
    // Fail open: no Upstash means no rate limit. Surface so callers
    // can log if they care, but never deny on infra absence.
    return { ok: true, remaining: limit, limit, resetAt };
  }
  const redisKey = `rl:${scope}:${key}:${bucket}`;
  try {
    const value = await redis.incr(redisKey);
    if (value === 1) {
      // Expire one second past the window so cross-bucket reads stay
      // consistent under clock skew.
      await redis.expire(redisKey, windowSec + 1);
    }
    const remaining = Math.max(0, limit - value);
    return { ok: value <= limit, remaining, limit, resetAt };
  } catch {
    // Upstash transient — fail open. The withTimeout in lib/cache/redis
    // already protects against hung connections; if we're here the
    // request errored synchronously.
    return { ok: true, remaining: limit, limit, resetAt };
  }
}

export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(r.resetAt),
  };
}
