import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 30;
export const runtime = "nodejs";

const NAME = "expired-nonces-cleanup";

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let removed = 0;
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Expired nonces
    const { data: expired, error: e1 } = await supabase
      .from("auth_wallet_nonces")
      .delete()
      .lt("expires_at", now)
      .select("id");
    if (e1) throw e1;
    removed += (expired ?? []).length;

    // Consumed nonces older than 7 days
    const { data: consumed, error: e2 } = await supabase
      .from("auth_wallet_nonces")
      .delete()
      .eq("consumed", true)
      .lt("created_at", sevenDaysAgo)
      .select("id");
    if (e2) throw e2;
    removed += (consumed ?? []).length;

    // Stale Telegram link codes
    const { error: e3 } = await supabase
      .from("user_telegram_links")
      .update({ link_code: null, link_code_expires_at: null })
      .not("link_code", "is", null)
      .lt("link_code_expires_at", now);
    if (e3) throw e3;

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
