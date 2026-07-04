import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { sendTelegramMessage } from '@/lib/telegram/client';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { inQuietHours, type QuietHoursPrefs } from '@/lib/preferences/quietHours';

// Outbound notification dispatcher. Called server-side whenever the
// platform creates a notification that should also be pushed to the
// user's linked Telegram chat.
//
// A user receives Telegram pushes if:
//   1. They have a row in user_telegram_links.
//   2. Their user_preferences.telegram_notifications flag is not false.
//   3. The notification kind is opted-in (price/whale/security/general).
//
// Delivery: tries Telegram up to 3x with exponential backoff (250ms / 500ms /
// 1000ms). On terminal failure we persist to telegram_delivery_failures so the
// user (and admin) can inspect what didn't reach them.

type NotificationKind = 'price' | 'whale' | 'security' | 'alert' | 'sniper' | 'copy' | 'general';

interface PushInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  url?: string;
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [250, 500, 1000];

function formatMessage(kind: NotificationKind, title: string, body?: string, url?: string): string {
  const ICON: Record<NotificationKind, string> = {
    price:    '📈',
    whale:    '🐋',
    security: '🛡️',
    alert:    '🔔',
    sniper:   '🎯',
    copy:     '👥',
    general:  '💠',
  };
  const icon = ICON[kind] ?? ICON.general;
  const parts = [`${icon} *${title}*`];
  if (body) parts.push('', body);
  if (url) parts.push('', `[Open in Naka](${url})`);
  return parts.join('\n');
}

async function deliverWithRetry(chatId: number, text: string): Promise<{ ok: true } | { ok: false; error: string; attempts: number }> {
  let lastErr = 'unknown';
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      await sendTelegramMessage(chatId, text, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      });
      return { ok: true };
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      }
    }
  }
  return { ok: false, error: lastErr, attempts: MAX_ATTEMPTS };
}

export async function sendTelegramNotification(input: PushInput): Promise<boolean> {
  const admin = getSupabaseAdmin();

  let chatId: number | null = null;
  try {
    const [{ data: link }, { data: prefRow }, { data: settingsRow }] = await Promise.all([
      admin
        .from('user_telegram_links')
        .select('telegram_chat_id')
        .eq('user_id', input.userId)
        .maybeSingle(),
      admin
        .from('user_preferences')
        .select('preferences')
        .eq('user_id', input.userId)
        .maybeSingle(),
      admin
        .from('notification_settings')
        .select('quiet_hours_enabled, quiet_hours_start_minute, quiet_hours_end_minute, quiet_hours_timezone')
        .eq('user_id', input.userId)
        .maybeSingle(),
    ]);

    if (!link?.telegram_chat_id) return false;
    chatId = link.telegram_chat_id as number;

    const prefs = (prefRow?.preferences ?? {}) as Record<string, unknown>;
    if (prefs.telegram_notifications === false) return false;
    const perKindKey = `telegram_${input.kind}` as const;
    if (prefs[perKindKey] === false) return false;

    // Honor Do Not Disturb the same way the digest cron does — but let security
    // alerts pierce quiet hours (a security event is exactly what you want to
    // know at 3am). The durable in-app notification is still written by the
    // caller, and the digest batches what was held, so suppressing here only
    // silences the loud real-time ping, not the information.
    if (input.kind !== 'security' && settingsRow) {
      if (inQuietHours(settingsRow as QuietHoursPrefs, new Date())) return false;
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'telegram/notify', stage: 'preflight' } });
    return false;
  }

  const text = formatMessage(input.kind, input.title, input.body, input.url);
  const result = await deliverWithRetry(chatId, text);
  if (result.ok) return true;

  // Persist failure so it's visible. Best-effort — Sentry on top so we still page if DB fails.
  try {
    await admin.from('telegram_delivery_failures').insert({
      user_id: input.userId,
      chat_id: chatId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      error_message: result.error,
      // Seed attempts=1 so the retry cron's backoff (attempts 2,3,…) actually
      // fires — seeding MAX_ATTEMPTS made every failure look already-exhausted.
      attempts: 1,
      last_attempt_at: new Date().toISOString(),
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'telegram/notify', stage: 'persist-failure' } });
  }
  Sentry.captureMessage(`Telegram delivery failed after ${result.attempts} attempts`, {
    level: 'warning',
    tags: { source: 'telegram/notify', kind: input.kind },
    extra: { user_id: input.userId, error: result.error },
  });
  return false;
}

// Fire-and-forget wrapper for call-sites that don't want to await.
export function queueTelegramNotification(input: PushInput): void {
  void sendTelegramNotification(input);
}
