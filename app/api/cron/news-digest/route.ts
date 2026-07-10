import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { verifyCron, logCronExecution } from "../_shared";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendTelegramMessage } from "@/lib/telegram/client";
import { sendNewsDigestEmail } from "@/lib/email";
import { inQuietHours, type QuietHoursPrefs } from "@/lib/preferences/quietHours";
import { aggregate, type NewsItem } from "../../news/route";

/**
 * News digest — twice-daily roundup of top crypto headlines to users who opted
 * in (notification_settings.news_alerts = true) and have a delivery channel on.
 *
 * Real data only: headlines come from the same multi-source aggregator that
 * powers the News tab (CoinTelegraph, WatcherGuru, Decrypt, The Block, Bankless,
 * CoinDesk, CryptoCompare, CoinGecko). If aggregation yields nothing, the cron
 * exits without sending — it never fabricates a digest.
 *
 * De-dupe: notification_settings.news_alerts_last_url stores a signature of the
 * whole headline set we last sent per user. If the set is unchanged, that user
 * is skipped so the same edition never lands twice — and a refreshed edition
 * still goes out even when the #1 story is "sticky" but the rest rotated.
 */

interface DigestPrefs extends QuietHoursPrefs {
  user_id: string;
  news_alerts: boolean | null;
  email_enabled: boolean | null;
  telegram_enabled: boolean | null;
  news_alerts_last_url: string | null;
}

export const maxDuration = 60;
export const runtime = "nodejs";

const NAME = "news-digest";
const HEADLINES = 6;

function esc(s: string): string {
  // Telegram Markdown-safe: strip the few chars that break * _ ` [ parsing.
  return s.replace(/[*_`[\]]/g, "");
}

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let sent = 0;
  try {
    const supabase = getSupabaseAdmin();

    // Who opted in? Bail cheaply before doing any network work if nobody has.
    const { data: prefsRows } = await supabase
      .from("notification_settings")
      .select(
        "user_id, news_alerts, email_enabled, telegram_enabled, news_alerts_last_url, quiet_hours_enabled, quiet_hours_start_minute, quiet_hours_end_minute, quiet_hours_timezone",
      )
      .eq("news_alerts", true)
      .limit(5000);

    const optedIn = (prefsRows ?? []) as DigestPrefs[];
    if (optedIn.length === 0) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, "success", duration, undefined, 0);
      return NextResponse.json({ ok: true, durationMs: duration, sent: 0, reason: "no_opt_in" });
    }

    // Fetch real headlines once, shared across all recipients.
    let items: NewsItem[] = [];
    try {
      items = await aggregate();
    } catch {
      items = [];
    }
    const top = items.slice(0, HEADLINES);
    if (top.length === 0) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, "success", duration, "no_news", 0);
      return NextResponse.json({ ok: true, durationMs: duration, sent: 0, reason: "no_news" });
    }
    // Signature over the WHOLE headline set (not just the lead) so a refreshed
    // edition still sends when the #1 story is sticky but the rest rotated, and
    // an identical set is never re-sent.
    const editionSig = top.map((t) => t.url).join("|");

    const userIds = optedIn.map((p) => p.user_id);
    const [{ data: tgLinks }] = await Promise.all([
      supabase.from("user_telegram_links").select("user_id, telegram_chat_id").in("user_id", userIds),
    ]);
    const chatByUser = new Map<string, number>();
    (tgLinks ?? []).forEach((r: { user_id: string; telegram_chat_id: number | string }) => {
      chatByUser.set(r.user_id, Number(r.telegram_chat_id));
    });

    const tgBody =
      `*Naka Labs — crypto news*\n\n` +
      top
        .map((it, i) => `${i + 1}. [${esc(it.title)}](${it.url})\n_${esc(it.source)}_`)
        .join("\n\n");

    const now = new Date();
    const deliveredUsers: string[] = [];

    for (const p of optedIn) {
      // Skip if this user already got this exact edition (same headline set).
      if (p.news_alerts_last_url && p.news_alerts_last_url === editionSig) continue;
      // Respect quiet hours.
      if (inQuietHours(p, now)) continue;

      let deliveredToUser = false;

      // Telegram.
      const chatId = chatByUser.get(p.user_id);
      if (p.telegram_enabled !== false && chatId) {
        try {
          const okTg = await sendTelegramMessage(chatId, tgBody);
          if (okTg) {
            sent++;
            deliveredToUser = true;
          } else {
            throw new Error("sendTelegramMessage returned falsy");
          }
        } catch (tgErr) {
          await supabase.from("pending_telegram_messages").insert({
            chat_id: chatId,
            body: tgBody,
            attempts: 1,
            next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            last_error: tgErr instanceof Error ? tgErr.message : String(tgErr),
          });
        }
      }

      // Email — only when the user's email channel is enabled. The News "Alerts"
      // bell popover discloses that the digest goes to enabled channels
      // (Telegram / email) and links to settings to manage them, so this honors
      // the user's existing email preference rather than surprising them.
      if (p.email_enabled === true) {
        const { data: authUser } = await supabase.auth.admin.getUserById(p.user_id);
        const email = authUser?.user?.email ?? null;
        if (email) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", p.user_id)
            .maybeSingle();
          const ok = await sendNewsDigestEmail(email, (profile as { first_name: string | null } | null)?.first_name ?? null, top);
          if (ok) {
            sent++;
            deliveredToUser = true;
          }
        }
      }

      if (deliveredToUser) deliveredUsers.push(p.user_id);
    }

    // Mark the edition as delivered so it never repeats for these users. If this
    // write fails after messages already went out, the next run would re-send;
    // surface it so that's observable rather than silent.
    if (deliveredUsers.length > 0) {
      const { error: markErr } = await supabase
        .from("notification_settings")
        .update({ news_alerts_last_url: editionSig })
        .in("user_id", deliveredUsers);
      if (markErr) {
        Sentry.captureMessage("[news-digest] de-dupe marker write failed", {
          level: "warning",
          tags: { cron: NAME },
          extra: { error: markErr.message, users: deliveredUsers.length },
        });
      }
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, "success", duration, undefined, sent);
    return NextResponse.json({ ok: true, durationMs: duration, sent, headlines: top.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, "failed", Date.now() - startedAt, msg, sent);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
