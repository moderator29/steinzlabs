'use client';

// FIX 5A.1: unified client hook for tier — every UI gate should use this.
// Backed by /api/user/tier which reads profiles.tier (source of truth).

import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export type Tier = 'free' | 'mini' | 'pro' | 'max';

export interface TierState {
  tier: Tier;
  isPaid: boolean;
  isPro: boolean;
  isMax: boolean;
  isAdmin: boolean;
  verifiedBadge: string | null;
  tierExpiresAt: string | null;
  expired: boolean;
  loading: boolean;
}

const DEFAULT: TierState = {
  tier: 'free',
  isPaid: false,
  isPro: false,
  isMax: false,
  isAdmin: false,
  verifiedBadge: null,
  tierExpiresAt: null,
  expired: false,
  loading: true,
};

export function useTier(): TierState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<TierState>(DEFAULT);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ ...DEFAULT, loading: false });
      return;
    }
    let cancelled = false;
    fetch('/api/user/tier', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setState({
          tier: (data.tier as Tier) || 'free',
          isPaid: !!data.isPaid,
          isPro: !!data.isPro,
          isMax: !!data.isMax,
          isAdmin: !!data.isAdmin,
          verifiedBadge: data.verifiedBadge || null,
          tierExpiresAt: data.tierExpiresAt || null,
          expired: !!data.expired,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ ...DEFAULT, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  return state;
}
