import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { fetchWithRetry } from "@/lib/api/fetchWithRetry";

export const maxDuration = 15;
export const runtime = "nodejs";

const NAME = "telegram-heartbeat";

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, "success", duration, "token not configured", 0);
      return NextResponse.json({ ok: true, skipped: true });
    }
    const res = await fetchWithRetry(`https://api.telegram.org/bot${token}/getMe`, {
      source: "telegram.getMe",
      timeoutMs: 5000,
      retries: 1,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !(body as { ok?: boolean }).ok) {
      throw new Error(`telegram getMe failed: HTTP ${res.status}`);
    }
    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, 1);
    return NextResponse.json({ ok: true, durationMs: duration, bot: (body as { result?: unknown }).result ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, 0);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
