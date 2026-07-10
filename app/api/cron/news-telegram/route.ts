import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { verifyCron, logCronExecution } from '../_shared';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendTelegramMessage } from '@/lib/telegram/client';
import { inQuietHours, type QuietHoursPrefs } from '@/lib/preferences/quietHours';
import { fetchNewsDrop, renderNewsDrop } from '@/lib/telegram/news';
import { resolveTelegramStyle } from '@/lib/telegram/templates';

/**
 * News → Telegram broadcast (the "news drop").
 *
 * A clean, opt-in, idempotent way to push the top Naka news headlines to a
 * user's Telegram using the shared premium template (numbered headline links +
 * a "News feed" button, richer in 'advanced' style).
 *
 * OPT-IN: recipients are exactly the users with
 * notification_settings.telegram_news_drop = true (a DEDICATED flag, default
 * false — distinct from the twice-daily news-digest's news_alerts, so the two
 * channels never double-send). Zero opt-ins → instant no-op.
 *
 * IDEMPOTENT: notification_settings.telegram_news_last_sig stores a signature of
 * the exact headline set last delivered per user. Unchanged set → user skipped,
 * so the same edition never lands twice. Quiet hours are respected.
 *
 * REAL DATA ONLY: headlines come from the shared aggregator (fetchNewsDrop).
 * If aggregation yields nothing, the run exits without sending — never a
 * fabricated drop.
 *
 * NOT auto-scheduled. This endpoint is intentionally NOT registered in
 * app/api/cron/dispatch/[group]/route.ts (that file is outside this change's
 * lane). To schedule it, the lead can add 'news-telegram' to the desired group
 * (e.g. 'twice-daily'); until then it only runs when invoked with CRON_SECRET.
 * Its opt-in + de-dupe guarantees keep it non-spammy however it's triggered.
 */

interface DropPrefs extends QuietHoursPrefs {
  user_id: string;
  telegram_news_drop: boolean | null;
  telegram_style: string | null;
  telegram_news_last_sig: string | null;
}

export const maxDuration = 60;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NAME = 'news-telegram';
const HEADLINES = 8;

export async function GET(request: NextRequest) {
  const auth = verifyCron(request);
  if (!auth.ok) return auth.response!;
  const startedAt = Date.now();
  let sent = 0;

  try {
    const supabase = getSupabaseAdmin();

    // Who opted in? Bail cheaply before any network work if nobody has.
    const { data: prefsRows } = await supabase
      .from('notification_settings')
      .select(
        'user_id, telegram_news_drop, telegram_style, telegram_news_last_sig, quiet_hours_enabled, quiet_hours_start_minute, quiet_hours_end_minute, quiet_hours_timezone',
      )
      .eq('telegram_news_drop', true)
      .limit(5000);

    const optedIn = (prefsRows ?? []) as DropPrefs[];
    if (optedIn.length === 0) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, 'success', duration, undefined, 0);
      return NextResponse.json({ ok: true, durationMs: duration, sent: 0, reason: 'no_opt_in' });
    }

    // Real headlines once, shared across all recipients.
    const drop = await fetchNewsDrop(HEADLINES);
    if (!drop) {
      const duration = Date.now() - startedAt;
      await logCronExecution(NAME, 'success', duration, 'no_news', 0);
      return NextResponse.json({ ok: true, durationMs: duration, sent: 0, reason: 'no_news' });
    }

    // Resolve Telegram chat ids for the opted-in users.
    const userIds = optedIn.map((p) => p.user_id);
    const { data: tgLinks } = await supabase
      .from('user_telegram_links')
      .select('user_id, telegram_chat_id')
      .in('user_id', userIds);
    const chatByUser = new Map<string, number>();
    for (const r of (tgLinks ?? []) as Array<{ user_id: string; telegram_chat_id: number | string }>) {
      chatByUser.set(r.user_id, Number(r.telegram_chat_id));
    }

    const now = new Date();
    const deliveredUsers: string[] = [];

    for (const p of optedIn) {
      const chatId = chatByUser.get(p.user_id);
      if (!chatId) continue; // opted in but hasn't linked a chat
      if (p.telegram_news_last_sig && p.telegram_news_last_sig === drop.signature) continue; // already got this edition
      if (inQuietHours(p, now)) continue;

      const style = resolveTelegramStyle(p);
      const msg = renderNewsDrop(drop, style);
      try {
        const ok = await sendTelegramMessage(chatId, msg.text, {
          parse_mode: msg.parse_mode,
          disable_web_page_preview: msg.disable_web_page_preview,
          reply_markup: msg.reply_markup,
        });
        if (ok) {
          sent++;
          deliveredUsers.push(p.user_id);
        } else {
          // Queue a retry via the same table the news-digest uses.
          await supabase.from('pending_telegram_messages').insert({
            chat_id: chatId,
            body: msg.text,
            attempts: 1,
            next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            last_error: 'sendTelegramMessage returned falsy',
          });
        }
      } catch (err) {
        await supabase.from('pending_telegram_messages').insert({
          chat_id: chatId,
          body: msg.text,
          attempts: 1,
          next_retry_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          last_error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Mark the edition delivered so it never repeats for these users.
    if (deliveredUsers.length > 0) {
      const { error: markErr } = await supabase
        .from('notification_settings')
        .update({ telegram_news_last_sig: drop.signature })
        .in('user_id', deliveredUsers);
      if (markErr) {
        Sentry.captureMessage('[news-telegram] de-dupe marker write failed', {
          level: 'warning',
          tags: { cron: NAME },
          extra: { error: markErr.message, users: deliveredUsers.length },
        });
      }
    }

    const duration = Date.now() - startedAt;
    await logCronExecution(NAME, 'success', duration, undefined, sent);
    return NextResponse.json({ ok: true, durationMs: duration, sent, headlines: drop.headlines.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: NAME } });
    await logCronExecution(NAME, 'failed', Date.now() - startedAt, msg, sent);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
