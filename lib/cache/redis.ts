import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";

let _redis: Redis | null = null;
let _warned = false;

export function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (!_warned) {
      console.warn("[redis] UPSTASH_REDIS_REST_URL/TOKEN not set. Cache disabled, falling back to direct fetches.");
      _warned = true;
    }
    return null;
  }
  _redis = new Redis({ url, token });
  return _redis;
}

// ─── Hard timeout wrapper ────────────────────────────────────────────────────
// Upstash REST client doesn't expose a per-call timeout option and its
// internal HTTP timeout defaults to 60s+. When Upstash has a transient blip
// (which it does periodically — see Vercel 504 incident 2026-04-19 06:50 UTC),
// any unwrapped redis call hangs for the full Vercel function lifetime
// (15 minutes) and 504s the route. Every call below is wrapped so a stuck
// Upstash can never block more than `ms` milliseconds.
const REDIS_TIMEOUT_MS = 1500;
const REDIS_TIMEOUT_SYMBOL = Symbol("redis-timeout");

async function withTimeout<T>(promise: Promise<T>, op: string): Promise<T | typeof REDIS_TIMEOUT_SYMBOL> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof REDIS_TIMEOUT_SYMBOL>((resolve) => {
    timer = setTimeout(() => resolve(REDIS_TIMEOUT_SYMBOL), REDIS_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    if (result === REDIS_TIMEOUT_SYMBOL) {
      console.warn(`[redis.${op}] timed out after ${REDIS_TIMEOUT_MS}ms — Upstash slow/down, falling through`);
      Sentry.captureMessage(`Redis ${op} timeout`, { level: "warning", tags: { op } });
    }
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const result = await withTimeout(redis.get(key) as Promise<T | null>, `get:${key}`);
    if (result === REDIS_TIMEOUT_SYMBOL) return null;
    return result as T | null;
  } catch (err) {
    console.error(`[redis.get] ${key}`, err);
    Sentry.captureException(err, { tags: { op: "redis.get", key } });
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await withTimeout(redis.set(key, value, { ex: ttlSeconds }), `set:${key}`);
  } catch (err) {
    console.error(`[redis.set] ${key}`, err);
    Sentry.captureException(err, { tags: { op: "redis.set", key } });
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await withTimeout(redis.del(key), `del:${key}`);
  } catch (err) {
    console.error(`[redis.del] ${key}`, err);
  }
}

export async function cacheWithFallback<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  // cacheGet returns null on timeout / error → falls through to fetcher.
  const cached = await cacheGet<T>(key);
  if (cached !== null && cached !== undefined) return cached;
  const fresh = await fetcher();
  // Don't await — write is best-effort and shouldn't slow the response path.
  // If cacheSet hangs, withTimeout caps it at REDIS_TIMEOUT_MS anyway.
  void cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
  }
  try {
    // Combine all three calls in a single timeout budget. If Upstash is slow
    // we fail-open rather than 504.
    const incrResult = await withTimeout(redis.incr(key), `incr:${key}`);
    if (incrResult === REDIS_TIMEOUT_SYMBOL) {
      return { allowed: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
    }
    const count = incrResult as number;
    if (count === 1) {
      void withTimeout(redis.expire(key, windowSeconds), `expire:${key}`);
    }
    const ttlResult = await withTimeout(redis.ttl(key), `ttl:${key}`);
    const ttl = ttlResult === REDIS_TIMEOUT_SYMBOL ? windowSeconds : (ttlResult as number);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: Date.now() + ttl * 1000,
    };
  } catch (err) {
    console.error(`[rateLimit] ${key}`, err);
    return { allowed: true, remaining: limit, resetAt: Date.now() + windowSeconds * 1000 };
  }
}
