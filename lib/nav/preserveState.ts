'use client';

/**
 * Navigation state preservation. Mirrors the pattern Twitter / Instagram /
 * Linear use: when the user clicks away from a list/feed page, snapshot
 * scroll + tab + filter + search into sessionStorage keyed by a stable
 * surface id, then restore on remount. The harness explicitly does NOT
 * use a single React context because it has to survive a full Next.js
 * route change.
 *
 * Audit precedent — Bug A (Context Feed → View Proof → Back) and Bug B
 * (Explain page mid-scroll) were both rooted in the lack of a shared
 * preservation primitive. This file is that primitive.
 */

const PREFIX = 'nav_state:';
const TTL_MS = 30 * 60 * 1000;

export interface SavedNavState<T extends object> {
  data: T;
  scrollY: number;
  savedAt: number;
}

export function saveNavState<T extends object>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SavedNavState<T> = {
      data,
      scrollY: window.scrollY,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(PREFIX + key, JSON.stringify(payload));
  } catch {
    /* sessionStorage full / disabled — non-fatal */
  }
}

export function readNavState<T extends object>(key: string): SavedNavState<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedNavState<T>;
    if (!parsed || typeof parsed.savedAt !== 'number') return null;
    if (Date.now() - parsed.savedAt > TTL_MS) {
      sessionStorage.removeItem(PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearNavState(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* non-fatal */
  }
}

/**
 * Restore the scroll position from a previously saved snapshot. Schedules
 * a double rAF so content has at least one paint to lay out before we
 * jump — otherwise the scroll target row may not exist yet and the
 * browser clamps to 0.
 */
export function restoreScroll(scrollY: number): void {
  if (typeof window === 'undefined') return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, left: 0, behavior: 'auto' });
    });
  });
}
