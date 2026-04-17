import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/client";

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "notification-digest";

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let sent = 0;
  try {
    const supabase = getSupabaseAdmin();
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

    const { data: alerts } = await supabase
      .from("alerts")
      .select("id, user_id, name, type, triggered_at")
      .eq("triggered", true)
      .gt("triggered_at", since)
      .limit(5000);

    if (!alerts || alerts.length === 0) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, "success", duration, undefined, 0);
      return NextResponse.json({ ok: true, durationMs: duration, sent: 0 });
    }

    // Group by user
    const byUser = new Map<string, typeof alerts>();
    for (const a of alerts as Array<{ id: string; user_id: string; name: string | null; type: string | null; triggered_at: string }>) {
      const arr = byUser.get(a.user_id) ?? [];
      arr.push(a);
      byUser.set(a.user_id, arr);
    }

    // Find Telegram-linked users with digest enabled
    const userIds = Array.from(byUser.keys());
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, durationMs: Date.now() - startedAt, sent: 0 });
    }
    const { data: tgLinks } = await supabase
      .from("user_telegram_links")
      .select("user_id, telegram_chat_id")
      .in("user_id", userIds);
    const chatByUser = new Map<string, number>();
    (tgLinks ?? []).forEach((r: { user_id: string; telegram_chat_id: number | string }) => {
      chatByUser.set(r.user_id, Number(r.telegram_chat_id));
    });

    for (const [userId, userAlerts] of byUser) {
      const chatId = chatByUser.get(userId);
      if (!chatId) continue;
      const lines = userAlerts.slice(0, 10).map((a) => {
        const when = new Date(a.triggered_at).toLocaleString();
        return `• *${a.name ?? "Alert"}* (${a.type ?? "generic"}) — ${when}`;
      });
      const extra = userAlerts.length > 10 ? `\n…and ${userAlerts.length - 10} more.` : "";
      await sendTelegramMessage(
        chatId,
        `*Naka Labs digest*\n${userAlerts.length} alert${userAlerts.length === 1 ? "" : "s"} in the last 4 hours:\n\n${lines.join("\n")}${extra}`,
      );
      sent++;
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, sent);
    return NextResponse.json({ ok: true, durationMs: duration, sent });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, sent);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
