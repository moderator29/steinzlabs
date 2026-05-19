import 'server-only';

/**
 * Lightweight in-memory token-bucket rate limiter for social writes.
 * Used on follow / unfollow / DM / report endpoints to stop spam +
 * brute follower farming.
 *
 * Per-instance (not distributed) — Vercel serverless functions warm-
 * starts share the bucket per region; cold starts reset it. Good
 * enough for v1 floor; upgrade to Redis (Upstash) when traffic
 * justifies it. The hot-path cost is one Map lookup.
 */

interface Bucket {
  tokens: number;
  refilledAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  capacity: number;
  refillPerSecond: number;
}

export const RATES = {
  follow:  { capacity: 30,  refillPerSecond: 30  / 3600 },   // 30 per hour
  dmSend:  { capacity: 60,  refillPerSecond: 60  / 60   },   // 60 per minute
  report:  { capacity: 5,   refillPerSecond: 5   / 3600 },   // 5 per hour
  block:   { capacity: 20,  refillPerSecond: 20  / 600  },   // 20 per 10 min
} as const satisfies Record<string, RateLimitConfig>;

export function takeToken(key: string, cfg: RateLimitConfig): boolean {
  const now = Date.now() / 1000;
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: cfg.capacity - 1, refilledAt: now };
    buckets.set(key, b);
    return true;
  }
  const elapsed = now - b.refilledAt;
  b.tokens = Math.min(cfg.capacity, b.tokens + elapsed * cfg.refillPerSecond);
  b.refilledAt = now;
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}
