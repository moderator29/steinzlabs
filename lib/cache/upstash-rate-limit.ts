import 'server-only';
import { getRedis } from './redis';

/**
 * Tiny INCR-based rate limiter on top of Upstash. One call = one token
 * consumed. The key holds a counter that auto-expires after refillSec —
 * effectively a fixed-window limiter, not a true token bucket, but
 * sufficient for the "1 Claude narrative per cluster per 24h" use case
 * which is the only current caller.
 *
 * Fail-open semantics: if Upstash is unreachable or env vars are unset,
 * returns true so callers don't block on cache outage. The caller decides
 * whether degraded operation is acceptable.
 */
export async function takeToken(
  key: string,
  opts: { capacity: number; refillSec: number },
): Promise<boolean> {
  const r = getRedis();
  if (!r) return true;
  try {
    const count = await r.incr(`ratelimit:${key}`) as number;
    if (count === 1) {
      // First hit in this window — set expiry.
      await r.expire(`ratelimit:${key}`, opts.refillSec);
    }
    return count <= opts.capacity;
  } catch {
    return true;
  }
}
