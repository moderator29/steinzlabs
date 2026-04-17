import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export function verifyCron(request: NextRequest): { ok: boolean; response?: Response } {
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
