/**
 * LP lock window evaluator. Given a list of known LP-locker lockup
 * records (Team Finance / Unicrypt / PinkLock) for a pair, return:
 *
 *   • totalLockedPct   what fraction of LP supply is locked vs free
 *   • soonestUnlockAt  the next moment any portion of LP can be
 *                       withdrawn (UNIX seconds)
 *   • daysUntilUnlock  derived convenience
 *   • severity         green (>=180d locked, >=80% supply),
 *                       amber (30..180d), red (<30d), unknown
 *
 * Pure — caller fetches the records. Audit §B.4 P1 LP lock duration.
 */

export interface LpLockRecord {
  locker: 'team-finance' | 'unicrypt' | 'pinklock' | 'other';
  /** UNIX seconds when this portion of LP becomes withdrawable. */
  unlockAt: number;
  /** Share of total LP this record covers (0..1). */
  lpShare: number;
  /** Owner of the locked LP — informational. */
  owner?: string | null;
}

export type LpLockSeverity = 'green' | 'amber' | 'red' | 'unknown';

export interface LpLockVerdict {
  totalLockedPct: number;
  soonestUnlockAt: number | null;
  daysUntilUnlock: number | null;
  severity: LpLockSeverity;
  /** Aggregate by-locker summary for the UI tooltip. */
  byLocker: Array<{ locker: string; lpShare: number; nextUnlockAt: number | null }>;
}

const SEC_PER_DAY = 86_400;

export function evaluateLpLock(records: LpLockRecord[], now: number = Math.floor(Date.now() / 1000)): LpLockVerdict {
  if (records.length === 0) {
    return {
      totalLockedPct: 0,
      soonestUnlockAt: null,
      daysUntilUnlock: null,
      severity: 'unknown',
      byLocker: [],
    };
  }

  let totalShare = 0;
  let soonest = Infinity;
  const byLockerMap = new Map<string, { lpShare: number; nextUnlockAt: number }>();

  for (const r of records) {
    if (r.unlockAt <= now) continue; // already unlocked — not part of 'locked' supply
    totalShare += r.lpShare;
    if (r.unlockAt < soonest) soonest = r.unlockAt;
    const prior = byLockerMap.get(r.locker);
    if (prior) {
      prior.lpShare += r.lpShare;
      if (r.unlockAt < prior.nextUnlockAt) prior.nextUnlockAt = r.unlockAt;
    } else {
      byLockerMap.set(r.locker, { lpShare: r.lpShare, nextUnlockAt: r.unlockAt });
    }
  }

  if (totalShare === 0) {
    return {
      totalLockedPct: 0,
      soonestUnlockAt: null,
      daysUntilUnlock: null,
      severity: 'red',
      byLocker: [],
    };
  }

  const pctLocked = Math.min(100, Math.round(totalShare * 100));
  const daysUntil = Math.floor((soonest - now) / SEC_PER_DAY);

  let severity: LpLockSeverity;
  if (daysUntil >= 180 && pctLocked >= 80) severity = 'green';
  else if (daysUntil >= 30) severity = 'amber';
  else severity = 'red';

  return {
    totalLockedPct: pctLocked,
    soonestUnlockAt: soonest,
    daysUntilUnlock: daysUntil,
    severity,
    byLocker: Array.from(byLockerMap.entries()).map(([locker, info]) => ({
      locker,
      lpShare: info.lpShare,
      nextUnlockAt: info.nextUnlockAt,
    })),
  };
}
