'use client';

import { useEffect, useState } from 'react';

interface ChosenStatus {
  tier: string;
  isChosen: boolean;
  loading: boolean;
}

/**
 * Resolves `profiles.is_chosen` for the current user via /api/cult/me.
 * Server-only column → must round-trip; never expose on the client UserProfile.
 *
 * Returns `{ tier: 'free', isChosen: false, loading: false }` on any failure
 * so consumers can fall back to the standard tier badge without flashing.
 */
export function useChosenStatus(): ChosenStatus {
  const [state, setState] = useState<ChosenStatus>({ tier: 'free', isChosen: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cult/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && typeof data.tier === 'string') {
          setState({ tier: data.tier, isChosen: !!data.isChosen, loading: false });
        } else {
          setState({ tier: 'free', isChosen: false, loading: false });
        }
      })
      .catch(() => {
        if (!cancelled) setState({ tier: 'free', isChosen: false, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
