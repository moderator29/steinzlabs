/**
 * Pure, IO-free helpers for the activity streak + XP surface.
 *
 * Everything here is derived from REAL activity, never fabricated. Callers pass
 * in the list of UTC day strings on which a user actually had a coin_trades or
 * wire_posts row, plus the real trade/post counts. There is no points economy
 * and XP is not a spendable currency: it is a plainly derived "activity score"
 * off real counts (trades * 10 + posts * 5) with a simple level band.
 */

export const XP_PER_TRADE = 10;
export const XP_PER_POST = 5;

export type StreakResult = {
  /** Consecutive UTC days of activity up to today (or yesterday), inclusive. */
  currentStreak: number;
  /** Longest consecutive run of active days in the supplied history. */
  bestStreak: number;
};

export type LevelResult = {
  level: number;
  xp: number;
  /** Cumulative XP required to have reached the current level. */
  currentFloor: number;
  /** Cumulative XP required to reach the next level. */
  nextFloor: number;
  /** XP earned inside the current level band. */
  intoLevel: number;
  /** Total width of the current level band. */
  span: number;
  /** 0..1 progress toward the next level. */
  progress: number;
  /** XP still needed to reach the next level. */
  xpToNext: number;
};

/** Turn a millisecond timestamp or ISO string into a UTC YYYY-MM-DD day key. */
export function utcDayKey(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toISOString().slice(0, 10);
}

/** Number of whole UTC days between two YYYY-MM-DD keys (b - a). */
function dayDiff(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((tb - ta) / 86_400_000);
}

/**
 * Compute current and best streaks from a list of UTC day strings.
 *
 * The list may be unsorted and may contain duplicates; both are handled. The
 * current streak counts consecutive days ending today or yesterday (so a day
 * that has not yet seen activity does not break a live streak until it lapses).
 *
 * @param days     UTC day strings (YYYY-MM-DD) on which real activity occurred.
 * @param todayUtc Optional reference day (YYYY-MM-DD). Defaults to the real
 *                 current UTC day. Passing it keeps this function deterministic.
 */
export function computeStreaks(days: string[], todayUtc?: string): StreakResult {
  const unique = Array.from(new Set(days.filter(Boolean))).sort();
  if (unique.length === 0) return { currentStreak: 0, bestStreak: 0 };

  // Best streak: longest run of consecutive days anywhere in history.
  let bestStreak = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    if (dayDiff(unique[i - 1], unique[i]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
  }

  // Current streak: walk backward from the most recent active day, but only if
  // that day is today or yesterday (otherwise the streak has already lapsed).
  const today = todayUtc ?? utcDayKey(new Date());
  const last = unique[unique.length - 1];
  const gapFromToday = dayDiff(last, today);

  let currentStreak = 0;
  if (gapFromToday === 0 || gapFromToday === 1) {
    currentStreak = 1;
    for (let i = unique.length - 1; i > 0; i--) {
      if (dayDiff(unique[i - 1], unique[i]) === 1) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return { currentStreak, bestStreak };
}

/** Honest activity XP from real counts. Not a spendable balance. */
export function xpFromCounts(tradeCount: number, postCount: number): number {
  const t = Number.isFinite(tradeCount) ? Math.max(0, Math.floor(tradeCount)) : 0;
  const p = Number.isFinite(postCount) ? Math.max(0, Math.floor(postCount)) : 0;
  return t * XP_PER_TRADE + p * XP_PER_POST;
}

/** Cumulative XP needed to have reached a given level (level 1 starts at 0). */
export function levelFloor(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 25 * (l - 1) * l;
}

/** Map honest XP to a simple level band plus progress toward the next level. */
export function levelFromXp(xp: number): LevelResult {
  const safeXp = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  let level = 1;
  while (levelFloor(level + 1) <= safeXp) level += 1;

  const currentFloor = levelFloor(level);
  const nextFloor = levelFloor(level + 1);
  const intoLevel = safeXp - currentFloor;
  const span = nextFloor - currentFloor;
  const progress = span > 0 ? Math.min(1, Math.max(0, intoLevel / span)) : 0;

  return {
    level,
    xp: safeXp,
    currentFloor,
    nextFloor,
    intoLevel,
    span,
    progress,
    xpToNext: Math.max(0, nextFloor - safeXp),
  };
}
