import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/client";
import { sendAlertDigestEmail } from "@/lib/email";
import { inQuietHours, type QuietHoursPrefs } from "@/lib/preferences/quietHours";

interface NotificationPrefs extends QuietHoursPrefs {
  user_id: string;
  email_enabled: boolean | null;
  telegram_enabled: boolean | null;
}

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
    const [{ data: tgLinks }, { data: prefsRows }] = await Promise.all([
      supabase
        .from("user_telegram_links")
        .select("user_id, telegram_chat_id")
        .in("user_id", userIds),
      supabase
        .from("notification_settings")
        .select(
          "user_id, email_enabled, telegram_enabled, quiet_hours_enabled, quiet_hours_start_minute, quiet_hours_end_minute, quiet_hours_timezone",
        )
        .in("user_id", userIds),
    ]);
    const chatByUser = new Map<string, number>();
    (tgLinks ?? []).forEach((r: { user_id: string; telegram_chat_id: number | string }) => {
      chatByUser.set(r.user_id, Number(r.telegram_chat_id));
    });
    const prefsByUser = new Map<string, NotificationPrefs>();
    (prefsRows ?? []).forEach((p: NotificationPrefs) => {
      prefsByUser.set(p.user_id, p);
    });

    // Resolve emails for users we plan to email (those with email_enabled !== false).
    const emailCandidates = userIds.filter((id) => {
      const p = prefsByUser.get(id);
      return !p || p.email_enabled !== false;
    });
    const emailByUser = new Map<string, { email: string; firstName: string | null }>();
    if (emailCandidates.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name")
        .in("id", emailCandidates);
      (profiles ?? []).forEach(
        (r: { id: string; email: string | null; first_name: string | null }) => {
          if (r.email) emailByUser.set(r.id, { email: r.email, firstName: r.first_name });
        },
      );
    }

    const now = new Date();
    for (const [userId, userAlerts] of byUser) {
      const prefs = prefsByUser.get(userId);
      if (prefs && inQuietHours(prefs, now)) continue;

      // Telegram (existing path)
      const tgOn = !prefs || prefs.telegram_enabled !== false;
      const chatId = chatByUser.get(userId);
      if (tgOn && chatId) {
        const lines = userAlerts.slice(0, 10).map((a) => {
          const when = new Date(a.triggered_at).toLocaleString();
          return `• *${a.name ?? "Alert"}* (${a.type ?? "generic"}) — ${when}`;
        });
        const extra = userAlerts.length > 10 ? `\n…and ${userAlerts.length - 10} more.` : "";
        const body = `*Naka Labs digest*\n${userAlerts.length} alert${userAlerts.length === 1 ? "" : "s"} in the last 4 hours:\n\n${lines.join("\n")}${extra}`;
        try {
          const okTg = await sendTelegramMessage(chatId, body);
          if (okTg) sent++;
          else throw new Error('sendTelegramMessage returned falsy');
        } catch (tgErr) {
          // ALERT4: durable retry — write to pending_telegram_messages
          // so the notification-retry cron re-attempts with exponential
          // backoff (1h → 24h → 7d).
          await supabase.from('pending_telegram_messages').insert({
            chat_id: chatId,
            body,
            attempts: 1,
            next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            last_error: tgErr instanceof Error ? tgErr.message : String(tgErr),
          });
        }
      }

      // Email (new path)
      const emailOn = !prefs || prefs.email_enabled !== false;
      const profile = emailByUser.get(userId);
      if (emailOn && profile) {
        const ok = await sendAlertDigestEmail(profile.email, profile.firstName, userAlerts);
        if (ok) sent++;
      }
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
