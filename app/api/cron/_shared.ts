import { NextRequest } from "next/server";
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
    console.warn("[cron] CRON_SECRET not set, allowing (dev mode)");
    return { ok: true };
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, response: new Response("Unauthorized", { status: 401 }) };
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

export function cronResponse(
  jobName: string,
  startedAt: number,
  extra: Record<string, unknown> = {},
): Response {
  const durationMs = Date.now() - startedAt;
  console.log(`[cron:${jobName}] completed in ${durationMs}ms`);
  return Response.json({ ok: true, job: jobName, durationMs, timestamp: Date.now(), ...extra });
}

export async function logCronExecution(
  cronName: string,
  status: "success" | "failed" | "timeout",
  durationMs: number,
  errorMessage?: string,
  itemsProcessed?: number,
): Promise<void> {
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
    console.error("[cron] failed to log execution", err);
  }
}
