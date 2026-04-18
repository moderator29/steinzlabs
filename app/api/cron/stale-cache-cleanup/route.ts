import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getRedis } from "@/lib/cache/redis";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "stale-cache-cleanup";

/**
 * Weekly Redis housekeeping.
 *
 * Upstash Redis entries already carry an EX TTL at write time, so technically
 * nothing should outlive its TTL. This job handles keys that were written
 * without EX (forgotten) or that intentionally use very long TTLs — we scan
 * and delete any key whose backing TTL is -1 (persistent) for patterns that
 * should never be persistent.
 */
const SCANNABLE_PATTERNS = [
  "vtx:rate:*",
  "search:cg:*",
  "watchlist:snap:*",
  "dashboard:*",
];

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let removed = 0;
  try {
    const redis = getRedis();
    if (!redis) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, "success", duration, "redis not configured", 0);
      return NextResponse.json({ ok: true, skipped: true, durationMs: duration });
    }

    for (const pattern of SCANNABLE_PATTERNS) {
      let cursor: string | number = 0;
      do {
        const result = (await redis.scan(cursor, { match: pattern, count: 200 })) as [string, string[]];
        cursor = result[0];
        const keys = result[1] ?? [];
        for (const key of keys) {
          const ttl = await redis.ttl(key);
          if (ttl === -1) {
            await redis.del(key);
            removed++;
          }
        }
      } while (cursor !== "0" && cursor !== 0);
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, removed);
    return NextResponse.json({ ok: true, durationMs: duration, removed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, removed);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
