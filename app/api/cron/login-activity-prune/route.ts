import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 30;
export const runtime = "nodejs";

const NAME = "login-activity-prune";

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let removed = 0;
  try {
    const supabase = getSupabaseAdmin();
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("login_activity")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    if (error) throw error;
    removed = (data ?? []).length;

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
