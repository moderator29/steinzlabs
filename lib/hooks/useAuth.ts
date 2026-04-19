'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export type UserTier = 'free' | 'mini' | 'pro' | 'max';
export type UserRole = 'user' | 'admin';

export interface UserProfile {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  created_at?: string;
  // Subscription / role / verification — loaded from profiles table.
  // These are set as soon as fetchProfile resolves; tier-gated UI should
  // also fall back to user.user_metadata if profile row is missing.
  tier: UserTier;
  tier_expires_at?: string | null;
  role: UserRole;
  is_verified?: boolean;
}

/**
 * Effective tier honoring tier_expires_at — if the user's paid tier has
 * expired, fall back to 'free'. Used everywhere we gate features.
 */
export function effectiveTier(profile: Pick<UserProfile, 'tier' | 'tier_expires_at'> | null | undefined): UserTier {
  if (!profile) return 'free';
  if (profile.tier === 'free') return 'free';
  if (profile.tier_expires_at && new Date(profile.tier_expires_at).getTime() < Date.now()) {
    return 'free';
  }
  return profile.tier;
}

/**
 * Tier rank for "is at least X tier" checks. e.g. hasTierAccess(user, 'pro')
 * returns true for pro AND max users.
 */
const TIER_RANK: Record<UserTier, number> = { free: 0, mini: 1, pro: 2, max: 3 };
export function hasTierAccess(profile: Pick<UserProfile, 'tier' | 'tier_expires_at'> | null | undefined, required: UserTier): boolean {
  return TIER_RANK[effectiveTier(profile)] >= TIER_RANK[required];
}

interface AuthContextType {
  user: UserProfile | null;
  supabaseUser: SupabaseUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  supabaseUser: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export { AuthContext };

export function useAuthProvider(): AuthContextType {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (supaUser: SupabaseUser) => {
    const meta = (supaUser.user_metadata ?? {}) as Record<string, unknown>;
    // Best-effort tier from auth user_metadata so the UI has SOMETHING to render
    // even before the profiles row resolves. Profile is the source of truth.
    const metaTier: UserTier = (() => {
      const m = (meta.subscription_tier ?? meta.tier) as string | undefined;
      if (m === 'mini' || m === 'pro' || m === 'max' || m === 'free') return m;
      return 'free';
    })();

    try {
      if (!supabase) {
        setUser({
          id: supaUser.id,
          email: supaUser.email,
          created_at: supaUser.created_at,
          tier: metaTier,
          role: 'user',
        });
        return;
      }
      // Select * so we don't crash if newly-added columns (is_verified, role,
      // tier_expires_at) haven't been migrated yet on this environment.
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supaUser.id)
        .single();

      if (profile) {
        const dbTier = (profile.tier === 'mini' || profile.tier === 'pro' || profile.tier === 'max' || profile.tier === 'free')
          ? profile.tier as UserTier
          : metaTier;
        setUser({
          id: supaUser.id,
          email: supaUser.email,
          first_name: profile.first_name ?? (meta.first_name as string | undefined),
          last_name: profile.last_name ?? (meta.last_name as string | undefined),
          username: profile.username ?? (meta.username as string | undefined),
          created_at: supaUser.created_at || profile.created_at,
          tier: dbTier,
          tier_expires_at: profile.tier_expires_at ?? null,
          role: (profile.role === 'admin' ? 'admin' : 'user'),
          is_verified: profile.is_verified === true,
        });
      } else {
        setUser({
          id: supaUser.id,
          email: supaUser.email,
          first_name: meta.first_name as string | undefined,
          last_name: meta.last_name as string | undefined,
          username: meta.username as string | undefined,
          created_at: supaUser.created_at,
          tier: metaTier,
          role: 'user',
        });
      }
    } catch {
      setUser({
        id: supaUser.id,
        email: supaUser.email,
        created_at: supaUser.created_at,
        tier: metaTier,
        role: 'user',
      });
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (supabaseUser) {
      await fetchProfile(supabaseUser);
    }
  }, [supabaseUser, fetchProfile]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let initialized = false;

    // Safety net — if onAuthStateChange never fires, stop loading after 15s
    const safetyTimer = setTimeout(() => {
      if (mounted && !initialized) {
        setLoading(false);
      }
    }, 15000);

    let subscription: any = null;
    try {
      const { data } = supabase.auth.onAuthStateChange(
        (event: string, session: any) => {
          if (!mounted) return;

          // Clear safety timer and unblock loading immediately —
          // do NOT await fetchProfile here because Supabase awaits all
          // onAuthStateChange listeners before resolving signInWithPassword /
          // verifyOtp, so any async work here delays those calls by the same
          // amount (10-15s DB query = 10-15s sign-in hang).
          if (!initialized) {
            initialized = true;
            clearTimeout(safetyTimer);
          }

          if (session?.user) {
            setSupabaseUser(session.user);
            // Set basic user immediately so auth guards pass right away.
            // tier comes from user_metadata as a fast hint; fetchProfile then
            // overrides with the authoritative profiles.tier value.
            const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
            const metaTier: UserTier = (() => {
              const m = (meta.subscription_tier ?? meta.tier) as string | undefined;
              if (m === 'mini' || m === 'pro' || m === 'max' || m === 'free') return m;
              return 'free';
            })();
            setUser({
              id: session.user.id,
              email: session.user.email,
              first_name: meta.first_name as string | undefined,
              last_name: meta.last_name as string | undefined,
              username: meta.username as string | undefined,
              created_at: session.user.created_at,
              tier: metaTier,
              role: 'user',
            });
            setLoading(false);
            // Fetch full profile (real tier, role, verified) in background.
            fetchProfile(session.user);
            // PostHog identify (non-blocking)
            import('@/lib/posthog').then(({ identify }) => {
              identify(session.user.id, { email: session.user.email });
            }).catch(() => { /* PostHog not configured */ });
          } else {
            setUser(null);
            setSupabaseUser(null);
            setLoading(false);
          }
        }
      );
      subscription = data?.subscription;
    } catch (err) {

      if (mounted) setLoading(false);
    }

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      try { subscription?.unsubscribe(); } catch (err) { console.error('[useAuth] Unsubscribe failed:', err); }
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setUser(null);
      setSupabaseUser(null);
      const { resetUser } = await import('@/lib/posthog');
      resetUser();
    } catch (err) {
      console.error('[useAuth] Sign out failed:', err);
    }
  }, []);

  return { user, supabaseUser, loading, signOut, refreshProfile };
}
