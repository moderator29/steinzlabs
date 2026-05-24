import "server-only";
import { getRedis } from "@/lib/cache/redis";
import * as Sentry from "@sentry/nextjs";

/**
 * Per-source webhook rate limiter.
 *
 * Webhook signature verification stops forged payloads, but a stolen
 * signing key (env dump, supply-chain compromise of the upstream provider)
 * could still be used to flood our handler and burn Vercel invocations +
 * downstream rate budgets. This util caps webhook calls per (source, ip)
 * window so the blast radius of a key compromise is bounded.
 *
 * Returns:
 *   { ok: true, remaining: number }  -> within budget, proceed
 *   { ok: false, retryAfter: number } -> over budget, return 429 to caller
 *   { ok: true, remaining: -1 }      -> Redis unavailable, fail open (don't
 *                                        drop legitimate webhooks during
 *                                        a cache outage)
 */
export async function checkWebhookRateLimit(
  source: string,
  ip: string,
  opts: { limit?: number; windowSeconds?: number } = {},
): Promise<{ ok: boolean; remaining: number; retryAfter?: number }> {
  const limit = opts.limit ?? 60;
  const windowSeconds = opts.windowSeconds ?? 60;
  const redis = getRedis();
  if (!redis) {
    return { ok: true, remaining: -1 };
  }
  const key = `webhook:${source}:${ip}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (count > limit) {
      return { ok: false, remaining: 0, retryAfter: windowSeconds };
    }
    return { ok: true, remaining: limit - count };
  } catch (err) {
    Sentry.captureException(err, { tags: { source: "webhook-rate-limit", webhook: source } });
    // Redis failure -> fail open so we don't drop real webhook deliveries
    return { ok: true, remaining: -1 };
  }
}

/**
 * Extract the client IP from common Vercel / Cloudflare headers, falling
 * back to a sentinel when none are present (e.g. local dev / direct hit).
 */
export function getWebhookClientIp(headers: Headers): string {
  const xff = (headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    (xff || "unknown")
  );
}
