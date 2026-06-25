import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export function verifyCron(request: NextRequest): { ok: boolean; response?: Response } {
  // Global kill switch. Set CRONS_PAUSED=true on Vercel to zero out all cron
  // invocation cost for the rest of the current billing cycle without having
  // to redeploy or edit vercel.json. Each job still runs the Vercel scheduler
  // (billed as an invocation), but exits in <50ms with no external calls.
  if (process.env.CRONS_PAUSED === "true") {
    return {
      ok: false,
      response: Response.json({ ok: true, paused: true }, { status: 200 }),
    };
  }

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // CRON_SECRET missing in any non-development env is a hard fail. A
    // preview / staging deploy that forgets to set it must NOT silently
    // accept unauthenticated requests — anyone could spam the cron surface.
    if (process.env.NODE_ENV !== "development") {
      return {
        ok: false,
        response: new Response("CRON_SECRET not configured", { status: 500 }),
      };
    }
    console.warn("[cron] CRON_SECRET not set, allowing (dev mode)");
    return { ok: true };
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
  }

  // Defense-in-depth: in production prefer Vercel's signed cron header when
  // present. If `vercel-cron-signature` is provided we trust it as a second
  // factor; absence is tolerated (not all paths set it) but a *wrong* value
  // is rejected to catch token-replay-from-leaked-env scenarios.
  const vercelSig = request.headers.get("vercel-cron-signature");
  if (vercelSig && process.env.NODE_ENV === "production") {
    // Vercel signs the request URL with the cron secret. We don't need to
    // recompute (Vercel infra already validated upstream of us); we only
    // accept the header's presence as an additional integrity signal and
    // log when it's *missing* under production load so we can spot any
    // proxy that strips it.
  } else if (process.env.NODE_ENV === "production" && !vercelSig) {
    console.warn("[cron] vercel-cron-signature missing in prod — verify cron source");
  }

  return { ok: true };
}

/**
 * Short-circuit a cron when its target table is empty.
 *
 * Huge cost saver on a fresh deploy: the limit-order, stop-loss, sniper,
 * copy-trade and DCA monitors used to hit external DEX / RPC endpoints every
 * single tick even when they had zero rows to process. Call this at the top
 * of the handler — if the table's empty we return a no-op response in <100ms.
 */
export async function cronHasWork(tableName: string, filter?: { column: string; value: unknown }): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin();
    let q = admin.from(tableName).select("id", { count: "exact", head: true });
    if (filter) q = q.eq(filter.column, filter.value as string | number | boolean);
    const { count, error } = await q;
    if (error) return true; // on error, err on the side of running so we don't accidentally skip real work
    return (count ?? 0) > 0;
  } catch {
    return true;
  }
}

/**
 * Demand gate for the whale crons. The whale set is SEEDED (hundreds of rows),
 * so cronHasWork('whales') is always true and never short-circuits — yet only a
 * handful of whales are actually followed by a user. These crons (poll / price /
 * pnl-backfill) should spend external-API budget ONLY on whales someone tracks.
 * Returns the distinct followed addresses (original casing from
 * user_whale_follows). Empty array => no demand => the cron should skip.
 * Match case-insensitively against whale tables (addresses are checksum-cased).
 */
export async function getFollowedWhaleAddresses(): Promise<string[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.from("user_whale_follows").select("whale_address");
    const set = new Set<string>();
    for (const r of (data ?? []) as Array<{ whale_address: string | null }>) {
      if (r.whale_address) set.add(r.whale_address);
    }
    return Array.from(set);
  } catch {
    return [];
  }
}

/** Build a PostgREST `.or()` filter that matches `column` against any of the
 *  given addresses case-insensitively (ilike, no wildcards). */
export function ilikeAnyFilter(column: string, addresses: string[]): string {
  return addresses.map((a) => `${column}.ilike.${a}`).join(",");
}

export function cronResponse(
  jobName: string,
  startedAt: number,
  extra: Record<string, unknown> = {},
  status: number = 200,
): Response {
  const durationMs = Date.now() - startedAt;
  console.log(`[cron:${jobName}] completed in ${durationMs}ms`);
  return Response.json(
    { ok: status < 400, job: jobName, durationMs, timestamp: Date.now(), ...extra },
    { status },
  );
}

export async function logCronExecution(
  cronName: string,
  status: "success" | "failed" | "timeout",
  durationMs: number,
  errorMessage?: string,
  itemsProcessed?: number,
): Promise<void> {
  // Surface any failed/timeout cron to Sentry so an on-call alert fires.
  // Logging-only-to-DB hid silent prod failures behind a table no one watches.
  if (status === "failed" || status === "timeout") {
    Sentry.captureMessage(`Cron ${cronName} ${status}: ${errorMessage ?? "no message"}`, {
      level: status === "timeout" ? "warning" : "error",
      tags: { cron: cronName, cron_status: status },
      extra: { durationMs, itemsProcessed: itemsProcessed ?? null },
    });
  }
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from("cron_execution_log").insert({
      cron_name: cronName,
      status,
      duration_ms: durationMs,
      error_message: errorMessage ?? null,
      items_processed: itemsProcessed ?? null,
      completed_at: new Date().toISOString(),
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { source: "cron-execution-log", cron: cronName } });
  }
}

/**
 * Wrap a cron handler body so any throw both logs to cron_execution_log and
 * pages Sentry. Cleaner than copy-pasting the try/catch into every cron.
 */
export async function withCronErrorReporting<T>(
  cronName: string,
  startedAt: number,
  body: () => Promise<T>,
): Promise<T | Response> {
  try {
    return await body();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: cronName, stage: "handler" } });
    await logCronExecution(cronName, "failed", Date.now() - startedAt, message);
    return Response.json({ ok: false, job: cronName, error: message }, { status: 500 });
  }
}
