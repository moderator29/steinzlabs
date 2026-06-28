import 'server-only';

/**
 * Shared "Do Not Disturb" gate. The canonical quiet-hours config lives on
 * public.notification_settings (quiet_hours_enabled / *_start_minute /
 * *_end_minute / *_timezone). Both the batched notification-digest cron and the
 * immediate telegram dispatcher must agree on the window, so the logic lives
 * here once instead of being re-implemented (and drifting) per call-site.
 */
export interface QuietHoursPrefs {
  quiet_hours_enabled: boolean | null;
  quiet_hours_start_minute: number | null;
  quiet_hours_end_minute: number | null;
  quiet_hours_timezone: string | null;
}

/**
 * True when `now` falls inside the user's configured quiet-hours window.
 * Handles windows that wrap past midnight (start > end) and falls back to UTC
 * when the stored timezone is missing or invalid. Disabled / unconfigured
 * windows are never "quiet".
 */
export function inQuietHours(prefs: QuietHoursPrefs, now: Date): boolean {
  if (!prefs.quiet_hours_enabled) return false;
  const start = prefs.quiet_hours_start_minute;
  const end = prefs.quiet_hours_end_minute;
  if (start == null || end == null) return false;
  let local: Date;
  try {
    const tz = prefs.quiet_hours_timezone || 'UTC';
    local = new Date(now.toLocaleString(undefined, { timeZone: tz }));
  } catch {
    local = now;
  }
  const minutes = local.getHours() * 60 + local.getMinutes();
  return start <= end
    ? minutes >= start && minutes < end
    : minutes >= start || minutes < end;
}
