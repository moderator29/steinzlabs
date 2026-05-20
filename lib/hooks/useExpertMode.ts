'use client';

import { useEffect, useState } from 'react';

/**
 * Read the user's Expert Mode preference from the same localStorage key
 * that /settings writes to. When ON, the UI is expected to drop the
 * extra-friction confirmation modals and high-impact blocks that
 * normally protect a casual trader from blowing themselves up.
 *
 * The setting is saved at PREFS_KEY = 'steinz_user_preferences' by the
 * settings page; we mirror that key here so the two sides agree
 * without an extra round-trip to Supabase. Settings page also upserts
 * to user_preferences so the value follows the user across devices.
 *
 * Returns `false` during SSR and on the first paint, then flips to the
 * persisted value after hydration. That order is the safe default:
 * expert mode is off until proven on.
 */
const PREFS_KEY = 'steinz_user_preferences';

export function useExpertMode(): boolean {
  const [expert, setExpert] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { expertMode?: boolean };
      if (parsed && typeof parsed.expertMode === 'boolean') {
        setExpert(parsed.expertMode);
      }
    } catch {
      // Malformed JSON in storage; treat as off.
    }
  }, []);
  return expert;
}
