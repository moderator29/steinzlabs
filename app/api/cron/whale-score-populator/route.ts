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
  try {
    const { data, error } = await admin.rpc("populate_whale_score", { p_days: 30 });
    if (error) throw error;
    rowsUpdated = (data as number) ?? 0;
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "cron/whale-score-populator" } });
    return cronResponse("whale-score-populator", startedAt, { error: "rpc_failed" }, 500);
  }
  return cronResponse("whale-score-populator", startedAt, { rows_updated: rowsUpdated });
}
