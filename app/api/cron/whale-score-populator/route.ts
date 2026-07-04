import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, cronResponse } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;

  const admin = getSupabaseAdmin();
  let rowsUpdated = 0;
  let metricsUpdated = 0;
  try {
    const { data, error } = await admin.rpc("populate_whale_score", { p_days: 30 });
    if (error) throw error;
    rowsUpdated = (data as number) ?? 0;
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "cron/whale-score-populator" } });
    return cronResponse("whale-score-populator", startedAt, { error: "rpc_failed" }, 500);
  }
  // Also refresh the real activity metrics the tracker surfaces (7d volume, 30d
  // trade count, last-active). Non-fatal: a score refresh still succeeds if this
  // secondary aggregate errors.
  try {
    const { data, error } = await admin.rpc("populate_whale_metrics", { p_days: 30 });
    if (error) throw error;
    metricsUpdated = (data as number) ?? 0;
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "cron/whale-score-populator", step: "metrics" } });
  }
  return cronResponse("whale-score-populator", startedAt, { rows_updated: rowsUpdated, metrics_updated: metricsUpdated });
}
