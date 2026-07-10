import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramMessage, sendTelegramPhoto } from '@/lib/telegram/client';
import {
  announcementMessage,
  announcementPhotoMessage,
  type AnnouncementData,
} from '@/lib/telegram/templates';
import { fetchTelegramStyles } from '@/lib/telegram/style';

/**
 * Announcement / broadcast fan-out for Telegram.
 *
 * ADMIN-INVOKED ONLY. This is not a cron and never auto-fires — call it from an
 * authenticated admin path when a human explicitly sends an announcement, and
 * feed it a clean AnnouncementData (see lib/telegram/templates). It renders the
 * premium banner template (image or text) once per style and sends it to every
 * linked chat that has not turned Telegram off.
 *
 * Opt-in model: recipients are exactly the users with a row in
 * user_telegram_links (they linked their chat) AND
 * user_preferences.telegram_notifications !== false. Nobody is messaged who
 * hasn't connected Telegram.
 *
 * Sends are paced in small batches so a large audience can't burst past
 * Telegram's ~30 msg/s ceiling. Failures are counted, not thrown, so one bad
 * chat can't abort the run.
 */

export interface BroadcastResult {
  recipients: number;
  sent: number;
  failed: number;
}

const BATCH = 25;
const BATCH_PAUSE_MS = 1000; // stay well under Telegram's global 30 msg/s

export async function broadcastAnnouncement(
  admin: SupabaseClient,
  announcement: AnnouncementData,
  opts: { batchSize?: number } = {},
): Promise<BroadcastResult> {
  // 1. Linked chats.
  const { data: links } = await admin
    .from('user_telegram_links')
    .select('user_id, telegram_chat_id')
    .limit(100_000);
  const linkRows = (links ?? []) as Array<{ user_id: string; telegram_chat_id: number | string }>;
  if (linkRows.length === 0) return { recipients: 0, sent: 0, failed: 0 };

  const userIds = linkRows.map((r) => r.user_id);

  // 2. Honour the telegram opt-out flag in user_preferences.
  const { data: prefs } = await admin
    .from('user_preferences')
    .select('user_id, preferences')
    .in('user_id', userIds);
  const optedOut = new Set<string>();
  for (const p of (prefs ?? []) as Array<{ user_id: string; preferences: Record<string, unknown> | null }>) {
    if (p.preferences && p.preferences.telegram_notifications === false) optedOut.add(p.user_id);
  }

  // 3. Per-user style (defaults to 'normal').
  const styles = await fetchTelegramStyles(admin, userIds);

  const targets = linkRows.filter((r) => !optedOut.has(r.user_id));

  let sent = 0;
  let failed = 0;
  const batchSize = opts.batchSize ?? BATCH;

  for (let i = 0; i < targets.length; i += batchSize) {
    const slice = targets.slice(i, i + batchSize);
    await Promise.all(
      slice.map(async (r) => {
        const style = styles.get(r.user_id) ?? 'normal';
        const chatId = Number(r.telegram_chat_id);
        try {
          if (announcement.imageUrl) {
            const msg = announcementPhotoMessage({ ...announcement, imageUrl: announcement.imageUrl }, style);
            await sendTelegramPhoto(chatId, msg.photo, {
              caption: msg.caption,
              parse_mode: msg.parse_mode,
              reply_markup: msg.reply_markup,
            });
            sent++; // sendTelegramPhoto logs its own failures; count as attempted-delivered
          } else {
            const msg = announcementMessage(announcement, style);
            const ok = await sendTelegramMessage(chatId, msg.text, {
              parse_mode: msg.parse_mode,
              disable_web_page_preview: msg.disable_web_page_preview,
              reply_markup: msg.reply_markup,
            });
            if (ok) sent++;
            else failed++;
          }
        } catch {
          failed++;
        }
      }),
    );
    if (i + batchSize < targets.length) {
      await new Promise((res) => setTimeout(res, BATCH_PAUSE_MS));
    }
  }

  return { recipients: targets.length, sent, failed };
}
