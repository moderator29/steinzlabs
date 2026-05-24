'use client';
import { useCallback, type KeyboardEvent } from 'react';

/**
 * A11Y5: keyboard nav for tablist containers. Apply the returned onKeyDown
 * to the tablist root and the index getter/setter to the active tab.
 * Implements WAI-ARIA APG "Tabs (Automatic Activation)" pattern:
 *   - ArrowLeft / ArrowUp     → previous tab (wraps)
 *   - ArrowRight / ArrowDown  → next tab (wraps)
 *   - Home                    → first tab
 *   - End                     → last tab
 *
 * Caller is responsible for applying `role="tablist"` to the container,
 * `role="tab"` + `aria-selected={i === activeIndex}` + `tabIndex={i === activeIndex ? 0 : -1}`
 * to each tab, and `role="tabpanel"` to the rendered panel. This hook
 * only owns the key-event arithmetic.
 */
export function useTabListKeys<T extends string>(
  tabs: ReadonlyArray<T>,
  activeIndex: number,
  setActive: (next: T) => void,
) {
  return useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (tabs.length === 0) return;
    let next = activeIndex;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        next = (activeIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        next = (activeIndex + 1) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    setActive(tabs[next]);
  }, [tabs, activeIndex, setActive]);
}
