import 'server-only';
import { rateLimit as upstashRateLimit, rateLimitHeaders } from './rateLimit/rateLimit';

/**
 * Compatibility shim — auth routes (signin / signup / forgot-password) used
 * to call this in-memory limiter directly. Forwards to the Upstash sliding-
 * window primitive in lib/rateLimit/rateLimit.ts so we have one canonical
 * limiter platform-wide. lib/security/rateLimit.ts had zero callers and is
 * being deleted in the same change.
 */

export interface RateLimitConfig {
  interval: number; // ms
  maxRequests: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number; // ms
}

export async function rateLimit(
  key: string,
  config: RateLimitConfig = { interval: 60000, maxRequests: 60 },
): Promise<RateLimitResult> {
  const r = await upstashRateLimit({
    scope: 'auth',
    key,
    limit: config.maxRequests,
    windowSec: Math.max(1, Math.floor(config.interval / 1000)),
  });
  const resetIn = Math.max(0, r.resetAt * 1000 - Date.now());
  return { success: r.ok, remaining: r.remaining, resetIn };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(result.resetIn / 1000)),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000)),
      },
    },
  );
}

export { rateLimitHeaders };
