import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAME = "market-pulse-warm";

/**
 * market-pulse-warm — keeps the AI Market Pulse singleton fresh independent of
 * client traffic. The pulse endpoint only regenerates on a request when its ~8h
 * DB cache is stale, so if no one loads the feed for a while the card sits empty
 * (market_pulse was dormant in prod). This pulls the current top feed events and
 * POSTs them to /api/context-feed/pulse, which regenerates only when stale (the
 * endpoint's own thundering-herd claim makes the call idempotent). Runs in the
 * six-hourly dispatch group.
 */
export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, "no-anthropic-key", 0);
      return NextResponse.json({ ok: true, skipped: "no-anthropic-key" });
    }
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const host = request.headers.get("host") ?? process.env.VERCEL_URL ?? "";
    const base = `${proto}://${host}`;
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (bypass) headers["x-vercel-protection-bypass"] = bypass;

    // 1) Current top events.
    let events: unknown[] = [];
    try {
      const r = await fetch(`${base}/api/context-feed?limit=24&chain=all`, {
        headers, signal: AbortSignal.timeout(20_000),
      });
      if (r.ok) { const j = await r.json(); events = Array.isArray(j.events) ? j.events : []; }
    } catch { /* no feed this tick — nothing to warm */ }

    if (events.length === 0) {
      await logCronExecution(NAME, "success", Date.now() - startedAt, "no-events", 0);
      return NextResponse.json({ ok: true, warmed: false, reason: "no-events" });
    }

    // 2) Warm the pulse (regenerates only when its 8h cache is stale).
    const r2 = await fetch(`${base}/api/context-feed/pulse`, {
      method: "POST",
      headers,
      body: JSON.stringify({ events }),
      signal: AbortSignal.timeout(40_000),
    });
    const warmed = r2.ok;
    await logCronExecution(NAME, warmed ? "success" : "failed", Date.now() - startedAt, warmed ? undefined : `pulse ${r2.status}`, warmed ? 1 : 0);
    return NextResponse.json({ ok: true, warmed, status: r2.status });
  } catch (err) {
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
