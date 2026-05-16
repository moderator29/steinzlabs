/**
 * LP lock duration parser. GoPlus reports whether LP is locked but
 * NOT how long it's locked for — a 24-hour lock and a 100-year lock
 * read identically in the current SecurityPanel. This module turns
 * lock-contract data (fetched from Team Finance / Unicrypt / Pinklock
 * etc.) into a human-readable duration + a severity tier the UI can
 * surface as a chip.
 *
 * Audit §5.8 B.4 — provider fetchers wire in later; this file only
 * implements the parsing + tiering so it stays pure and testable.
 */

export type LockTier =
  | 'unknown'       // no lock info available
  | 'rugbait'       // < 24h
  | 'short'         // 24h - 30d
  | 'standard'      // 30d - 6mo
  | 'long'          // 6mo - 2y
  | 'forever';      // > 2y or burn address

export interface LpLockEntry {
  /** Locker contract name (Team Finance / Unicrypt / Pinklock / etc.). */
  provider: string;
  /** Unix seconds when the lock expires. Pass Infinity for burn. */
  unlockAtSec: number;
  /** Share of LP this lock covers (0..1). */
  lpShare: number;
}

export interface LpLockSummary {
  /** Lock tier of the longest-running lock by share-weighted duration. */
  tier: LockTier;
  /** Human-readable summary line for the SecurityPanel ("LP locked 6mo via Team Finance"). */
  label: string;
  /** Earliest unlock among all locks (Infinity if all burned). */
  earliestUnlockAtSec: number;
  /** Total LP share covered by ANY lock. */
  totalLockedShare: number;
}

const SEC_PER_DAY = 86_400;

function tierFor(durationSec: number): LockTier {
  if (!Number.isFinite(durationSec)) return 'forever';
  if (durationSec < SEC_PER_DAY) return 'rugbait';
  if (durationSec < 30 * SEC_PER_DAY) return 'short';
  if (durationSec < 180 * SEC_PER_DAY) return 'standard';
  if (durationSec < 730 * SEC_PER_DAY) return 'long';
  return 'forever';
}

function formatDuration(durationSec: number): string {
  if (!Number.isFinite(durationSec)) return 'burn';
  const days = durationSec / SEC_PER_DAY;
  if (days < 1) return `${Math.max(1, Math.round(days * 24))}h`;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

export function summarizeLpLock(entries: LpLockEntry[], nowSec: number = Math.floor(Date.now() / 1000)): LpLockSummary {
  if (entries.length === 0) {
    return { tier: 'unknown', label: 'LP lock unknown', earliestUnlockAtSec: 0, totalLockedShare: 0 };
  }
  const totalLockedShare = Math.min(
    1,
    entries.reduce((s, e) => s + Math.max(0, Math.min(1, e.lpShare || 0)), 0),
  );
  const earliestUnlockAtSec = Math.min(...entries.map((e) => e.unlockAtSec));
  // Share-weighted average duration so a 1% rug-bait lock + 99% 2y
  // lock reads as long, not short.
  let weightedDuration = 0;
  let weightSum = 0;
  let dominantProvider = entries[0].provider;
  let dominantShare = 0;
  for (const e of entries) {
    const dur = Math.max(0, e.unlockAtSec - nowSec);
    const share = Math.max(0, Math.min(1, e.lpShare || 0));
    weightedDuration += dur * share;
    weightSum += share;
    if (share > dominantShare) {
      dominantShare = share;
      dominantProvider = e.provider;
    }
  }
  const avgDuration = weightSum > 0 ? weightedDuration / weightSum : 0;
  const tier = tierFor(avgDuration);
  const label =
    tier === 'forever'
      ? `LP burned / locked >2y via ${dominantProvider}`
      : tier === 'unknown'
        ? 'LP lock unknown'
        : `LP locked ${formatDuration(avgDuration)} via ${dominantProvider}`;
  return { tier, label, earliestUnlockAtSec, totalLockedShare };
}
