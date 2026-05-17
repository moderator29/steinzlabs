import 'server-only';

/**
 * Sliding-window rate limiter. Backed by an injectable KV store
 * (defaults to in-memory; production uses Upstash Redis via
 * lib/security/upstash.ts once that lands). The window is sliding
 * — we count requests within the last `windowSeconds` rather than
 * a fixed clock-aligned bucket, which prevents the boundary-burst
 * attack where a client times their burst to span two buckets and
 * doubles the effective limit.
 *
 * Audit §B.19 infra P1 + §B.13 webhook rate-limiting.
 */

export interface RateLimitKv {
  /** Record a hit + return the unique-hit-count within the window. */
  hit(key: string, windowSeconds: number): Promise<number>;
  /** Reset a key (used by admin endpoints when a user is unbanned). */
  reset(key: string): Promise<void>;
}

export interface RateLimitOptions {
  windowSeconds: number;
  maxHits: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds?: number;
}

export async function checkRateLimit(
  kv: RateLimitKv,
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitVerdict> {
  const hits = await kv.hit(key, opts.windowSeconds);
  if (hits <= opts.maxHits) {
    return { allowed: true, remaining: opts.maxHits - hits };
  }
  return {
    allowed: false,
    remaining: 0,
    // Worst-case retry — the oldest hit ages out in <= windowSeconds.
    retryAfterSeconds: opts.windowSeconds,
  };
}

/**
 * Default in-memory KV — good for dev + single-instance deploys.
 * Production deploys with >1 worker MUST swap this for the Upstash
 * impl so counts converge across instances.
 */
export class InMemoryRateLimitKv implements RateLimitKv {
  private events = new Map<string, number[]>();

  async hit(key: string, windowSeconds: number): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const cutoff = now - windowSeconds;
    const arr = (this.events.get(key) ?? []).filter((t) => t > cutoff);
    arr.push(now);
    this.events.set(key, arr);
    return arr.length;
  }

  async reset(key: string): Promise<void> {
    this.events.delete(key);
  }
}

let defaultKv: RateLimitKv | null = null;

/**
 * Lazy singleton — caller doesn't need to manage the KV lifecycle in
 * the common case. Swap via setRateLimitKv() for tests / Upstash.
 */
export function getRateLimitKv(): RateLimitKv {
  if (!defaultKv) defaultKv = new InMemoryRateLimitKv();
  return defaultKv;
}

export function setRateLimitKv(kv: RateLimitKv): void {
  defaultKv = kv;
}

/**
 * Convenience — derive a stable key from an incoming request +
 * optional bucket name. IP is read from x-forwarded-for first to
 * survive the Vercel edge proxy.
 */
export function keyFromRequest(request: Request, bucket = 'global'): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  return `rl:${bucket}:${ip}`;
}
