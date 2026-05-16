/**
 * Daily-streak tracker. Pure date arithmetic — caller passes the
 * timestamps of past activity + 'now'; this lib computes current
 * streak length, longest streak, and whether today's check-in is
 * still pending.
 *
 * Audit §5.4 / B.17 — fresh primitive for the onboarding engagement
 * loop. UI surfaces this as a fire-emoji counter on the dashboard.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface StreakResult {
  current: number;
  longest: number;
  /** True when the user hasn't checked in today yet. */
  pendingToday: boolean;
  /** Unix seconds of the last counted check-in, or null. */
  lastCheckinAt: number | null;
}

/** Floor a millisecond timestamp to the start of that user-local day. */
function dayKey(ms: number, tzOffsetMinutes = 0): number {
  const local = ms - tzOffsetMinutes * 60_000;
  return Math.floor(local / MS_PER_DAY);
}

export interface ComputeStreakOptions {
  /** Unix seconds for "now". Allows deterministic tests. */
  nowSec?: number;
  /** Timezone offset in minutes (e.g. -240 for EDT). Default UTC. */
  tzOffsetMinutes?: number;
}

export function computeStreak(
  activityTimestampsSec: number[],
  options: ComputeStreakOptions = {},
): StreakResult {
  if (activityTimestampsSec.length === 0) {
    return { current: 0, longest: 0, pendingToday: true, lastCheckinAt: null };
  }
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const tz = options.tzOffsetMinutes ?? 0;
  const today = dayKey(nowSec * 1000, tz);
  const days = new Set<number>(
    activityTimestampsSec
      .filter((s) => Number.isFinite(s) && s > 0)
      .map((s) => dayKey(s * 1000, tz)),
  );
  if (days.size === 0) {
    return { current: 0, longest: 0, pendingToday: true, lastCheckinAt: null };
  }
  const lastCheckinAt = Math.max(...activityTimestampsSec);
  const pendingToday = !days.has(today);

  // Current streak — walk backwards from today (or yesterday if today
  // hasn't checked in yet, so the streak doesn't break the moment a
  // user opens the app at 12:01 AM).
  let cursor = pendingToday ? today - 1 : today;
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor -= 1;
  }

  // Longest streak — sort unique days, scan for consecutive runs.
  const sortedDays = Array.from(days).sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sortedDays) {
    if (prev === null || d === prev + 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = d;
  }
  longest = Math.max(longest, current);

  return { current, longest, pendingToday, lastCheckinAt };
}
