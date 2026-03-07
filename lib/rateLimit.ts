interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const cache = new Map<string, RateLimitEntry>();
const MAX_CACHE_SIZE = 10000;

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.resetTime) {
      cache.delete(key);
    }
  }
}

export interface RateLimitConfig {
  interval: number;
  maxRequests: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetIn: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig = { interval: 60000, maxRequests: 60 }
): RateLimitResult {
  const now = Date.now();

  if (cache.size > MAX_CACHE_SIZE) {
    evictExpired();
  }

  const entry = cache.get(key);

  if (!entry || now > entry.resetTime) {
    cache.set(key, { count: 1, resetTime: now + config.interval });
    return { success: true, remaining: config.maxRequests - 1, resetIn: config.interval };
  }

  entry.count += 1;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetIn = entry.resetTime - now;

  if (entry.count > config.maxRequests) {
    return { success: false, remaining: 0, resetIn };
  }

  return { success: true, remaining, resetIn };
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
    }
  );
}
