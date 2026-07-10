import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveTelegramStyle, type TelegramStyle } from '@/lib/telegram/templates';

/**
 * Read a user's Telegram message style ('normal' | 'advanced') from
 * notification_settings.telegram_style. Missing row / column / value → 'normal'
 * (the default). Best-effort: any DB error resolves to 'normal' so a style
 * lookup can never block a delivery.
 *
 * The column is added by
 * supabase/migrations/20260710_notification_settings_telegram_style.sql.
 */
export async function fetchTelegramStyle(
  admin: SupabaseClient,
  userId: string,
): Promise<TelegramStyle> {
  try {
    const { data } = await admin
      .from('notification_settings')
      .select('telegram_style')
      .eq('user_id', userId)
      .maybeSingle();
    return resolveTelegramStyle(data as { telegram_style?: unknown } | null);
  } catch {
    return 'normal';
  }
}

/**
 * Batch variant — one query for many users. Returns a Map keyed by user_id;
 * users without a row default to 'normal' at read time (use `.get(id) ??
 * 'normal'`).
 */
export async function fetchTelegramStyles(
  admin: SupabaseClient,
  userIds: string[],
): Promise<Map<string, TelegramStyle>> {
  const out = new Map<string, TelegramStyle>();
  if (userIds.length === 0) return out;
  try {
    const { data } = await admin
      .from('notification_settings')
      .select('user_id, telegram_style')
      .in('user_id', userIds);
    for (const row of (data ?? []) as Array<{ user_id: string; telegram_style?: unknown }>) {
      out.set(row.user_id, resolveTelegramStyle(row));
    }
  } catch {
    /* fall through — callers default missing entries to 'normal' */
  }
  return out;
}
