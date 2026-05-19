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
  let rowsWritten = 0;
  try {
    const { data, error } = await admin.rpc("refresh_smart_money_convergence", { p_window_hours: 24 });
    if (error) throw error;
    rowsWritten = (data as number) ?? 0;
  } catch (err) {
    Sentry.captureException(err, { tags: { route: "cron/smart-money-convergence" } });
    return cronResponse("smart-money-convergence", startedAt, { error: "rpc_failed" }, 500);
  }
  return cronResponse("smart-money-convergence", startedAt, { rows_written: rowsWritten });
}
