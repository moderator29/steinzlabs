import 'server-only';
import { sendTelegramMessage } from '@/lib/telegram/client';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// Outbound notification dispatcher. Called server-side whenever the
// platform creates a notification that should also be pushed to the
// user's linked Telegram chat.
//
// A user receives Telegram pushes if:
//   1. They have a row in user_telegram_links.
//   2. Their user_preferences.telegram_notifications flag is not false.
//   3. The notification kind is opted-in (price/whale/security/general).

type NotificationKind = 'price' | 'whale' | 'security' | 'alert' | 'sniper' | 'copy' | 'general';

interface PushInput {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  url?: string;
}

function formatMessage(kind: NotificationKind, title: string, body?: string, url?: string): string {
  const ICON: Record<NotificationKind, string> = {
    price:    '\uD83D\uDCC8', // chart up
    whale:    '\uD83D\uDC0B', // whale
    security: '\uD83D\uDEE1\uFE0F', // shield
    alert:    '\uD83D\uDD14', // bell
    sniper:   '\uD83C\uDFAF', // target
    copy:     '\uD83D\uDC65', // users
    general:  '\uD83D\uDCA0', // dotted flower
  };
  const icon = ICON[kind] ?? ICON.general;
  const parts = [`${icon} *${title}*`];
  if (body) parts.push('', body);
  if (url) parts.push('', `[Open in Naka](${url})`);
  return parts.join('\n');
}

export async function sendTelegramNotification(input: PushInput): Promise<boolean> {
  try {
    const admin = getSupabaseAdmin();

    // Fetch link + preferences in one roundtrip each.
    const [{ data: link }, { data: prefRow }] = await Promise.all([
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
    ]);

    if (!link?.telegram_chat_id) return false; // not linked

    const prefs = (prefRow?.preferences ?? {}) as Record<string, unknown>;
    // Master switch — defaults to ON once linked.
    if (prefs.telegram_notifications === false) return false;

    // Per-category opt-outs.
    const perKindKey = `telegram_${input.kind}` as const;
    if (prefs[perKindKey] === false) return false;

    const text = formatMessage(input.kind, input.title, input.body, input.url);
    await sendTelegramMessage(link.telegram_chat_id as number, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    return true;
  } catch (err) {
    console.error('[telegram/notify] failed:', err);
    return false;
  }
}

// Fire-and-forget wrapper for call-sites that don't want to await.
export function queueTelegramNotification(input: PushInput): void {
  void sendTelegramNotification(input);
}
