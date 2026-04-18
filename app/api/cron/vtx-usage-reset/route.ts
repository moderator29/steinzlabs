import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getRedis } from "@/lib/cache/redis";

export const maxDuration = 30;
export const runtime = "nodejs";

const NAME = "vtx-usage-reset";

/**
 * Deletes VTX per-user daily rate-limit counters from yesterday or earlier.
 * Keys are written as `vtx:rate:<user-or-ip>:<YYYY-MM-DD>` with a 24h EX TTL;
 * this is a belt-and-braces cleanup in case TTLs were lost.
 */
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
      return NextResponse.json({ ok: true, skipped: true });
    }

    const today = new Date().toISOString().split("T")[0];
    let cursor: string | number = 0;
    do {
      const result = (await redis.scan(cursor, { match: "vtx:rate:*", count: 200 })) as [string, string[]];
      cursor = result[0];
      const keys = result[1] ?? [];
      for (const key of keys) {
        if (!key.endsWith(`:${today}`)) {
          await redis.del(key);
          removed++;
        }
      }
    } while (cursor !== "0");

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
