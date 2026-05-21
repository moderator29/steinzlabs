'use client';

/**
 * follow-cache — small client-side store that mirrors the user's follow
 * graph so every FollowButton across the platform agrees on state.
 *
 * Why: every surface that renders a FollowButton (leaderboards, user
 * profile, search results, the followers / following lists, the
 * RecommendationsStrip) fetches its own `initialState` from its own
 * API call. When a user follows someone in panel A and then navigates
 * to panel B, panel B's stale response shows "Follow" again because
 * the new API roundtrip hasn't happened yet. This cache lets every
 * mounted FollowButton reconcile from a single in-process source of
 * truth + persists across tabs via localStorage.
 *
 * API surface:
 *   getCachedFollowState(targetId)   → 'not_following' | 'pending' | 'accepted' | undefined
 *   setCachedFollowState(targetId, state)  // writes + dispatches event
 *   onFollowChange(cb)               → unsubscribe
 *
 * Storage shape (localStorage key 'steinz_follow_cache_v1'):
 *   { [targetId]: { state: 'pending' | 'accepted' | 'not_following', t: epoch_ms } }
 *
 * Entries older than 24h are evicted lazily on read; the API is the
 * source of truth and the cache is purely a UI-sync layer.
 */

const STORAGE_KEY = 'steinz_follow_cache_v1';
const EVENT = 'steinz:follow-change';
const TTL_MS = 24 * 60 * 60 * 1000;

export type FollowState = 'not_following' | 'pending' | 'accepted';

interface CacheEntry { state: FollowState; t: number }
type CacheShape = Record<string, CacheEntry>;

function readAll(): CacheShape {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheShape;
  } catch {
    return {};
  }
}

function writeAll(c: CacheShape) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // Quota / disabled storage; cache becomes session-memory only.
  }
}

export function getCachedFollowState(targetId: string): FollowState | undefined {
  if (!targetId) return undefined;
  const all = readAll();
  const entry = all[targetId];
  if (!entry) return undefined;
  if (Date.now() - entry.t > TTL_MS) {
    delete all[targetId];
    writeAll(all);
    return undefined;
  }
  return entry.state;
}

export function setCachedFollowState(targetId: string, state: FollowState): void {
  if (!targetId) return;
  const all = readAll();
  all[targetId] = { state, t: Date.now() };
  writeAll(all);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<{ targetId: string; state: FollowState }>(EVENT, {
    detail: { targetId, state },
  }));
}

export function onFollowChange(cb: (targetId: string, state: FollowState) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ targetId: string; state: FollowState }>).detail;
    if (detail) cb(detail.targetId, detail.state);
  };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
