import "server-only";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/cache/redis";
import { verifyAdminRequest, unauthorizedResponse } from "@/lib/auth/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Real Upstash Redis health check. Runs PING with a hard 2s ceiling so this
 * endpoint can never itself be the thing that hangs the admin page. Returns
 * status, latency, and a human-readable message.
 *
 * Status mapping:
 *   - active   → PING ok, latency < 300ms
 *   - warning  → PING ok, latency 300-1500ms (degraded but functional)
 *   - error    → PING failed or timed out
 *   - inactive → UPSTASH_REDIS_REST_URL not configured (cache disabled)
 */
export async function GET(request: Request) {
  const adminId = await verifyAdminRequest(request);
  if (!adminId) return unauthorizedResponse();

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({
      status: "inactive",
      latencyMs: 0,
      message: "Cache disabled — UPSTASH_REDIS_REST_URL/TOKEN not configured",
    });
  }

  const start = Date.now();
  try {
    // Race PING against a 2s timeout. Don't call redis.ping() directly —
    // older @upstash/redis versions don't expose it, so use a sentinel SET.
    const sentinelKey = `naka:health:${start}`;
    const ping = redis.set(sentinelKey, "ok", { ex: 5 });
    const result = await Promise.race([
      ping.then(() => "ok" as const),
      new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 2000)),
    ]);
    const latencyMs = Date.now() - start;

    if (result === "timeout") {
      return NextResponse.json({
        status: "error",
        latencyMs,
        message: "Upstash timed out (>2s) — connectivity issue or rate limit",
      });
    }

    if (latencyMs > 1500) {
      return NextResponse.json({
        status: "warning",
        latencyMs,
        message: `Upstash slow (${latencyMs}ms) — degraded but functional`,
      });
    }
    if (latencyMs > 300) {
      return NextResponse.json({
        status: "warning",
        latencyMs,
        message: `Upstash latency elevated (${latencyMs}ms)`,
      });
    }

    return NextResponse.json({
      status: "active",
      latencyMs,
      message: `OK (${latencyMs}ms)`,
    });
  } catch (err) {
    return NextResponse.json({
      status: "error",
      latencyMs: Date.now() - start,
      message: err instanceof Error ? err.message : "Upstash error",
    });
  }
}
