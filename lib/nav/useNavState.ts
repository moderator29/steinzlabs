'use client';

import { useEffect, useRef } from 'react';
import { readNavState, restoreScroll, saveNavState } from './preserveState';

/**
 * useNavState — bind a page's preservable state (tab / filter / search /
 * scroll) to a stable surface key. On mount, hydrates from sessionStorage
 * via `onRestore`. On unmount, persists via the latest `serialize()`
 * snapshot so the user can navigate back to exactly where they were.
 *
 * Each page passes a stable key (e.g. 'context-feed', 'whale-tracker',
 * 'market'). Two pages should never share a key.
 */
export function useNavState<T extends object>(
  key: string,
  serialize: () => T,
  onRestore: (state: T) => void,
): void {
  const serializeRef = useRef(serialize);
  const restoreRef = useRef(onRestore);
  serializeRef.current = serialize;
  restoreRef.current = onRestore;

  useEffect(() => {
    const saved = readNavState<T>(key);
    if (saved) {
      restoreRef.current(saved.data);
      restoreScroll(saved.scrollY);
    }
    return () => {
      saveNavState(key, serializeRef.current());
    };
  }, [key]);
}
