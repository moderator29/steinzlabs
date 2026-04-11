'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  created_at?: string;
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
    try {
      if (!supabase) {
        setUser({ id: supaUser.id, email: supaUser.email, created_at: supaUser.created_at });
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supaUser.id)
        .single();

      if (profile) {
        setUser({
          id: supaUser.id,
          email: supaUser.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          username: profile.username,
          // Always prefer auth user created_at (profile row may be blank)
          created_at: supaUser.created_at || profile.created_at,
        });
      } else {
        const meta = supaUser.user_metadata || {};
        setUser({
          id: supaUser.id,
          email: supaUser.email,
          first_name: meta.first_name,
          last_name: meta.last_name,
          username: meta.username,
          created_at: supaUser.created_at,
        });
      }
    } catch {
      setUser({
        id: supaUser.id,
        email: supaUser.email,
        created_at: supaUser.created_at,
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
            // Set basic user immediately so auth guards pass right away
            setUser({
              id: session.user.id,
              email: session.user.email,
              created_at: session.user.created_at,
            });
            setLoading(false);
            // Fetch full profile (name, username) in background — non-blocking
            fetchProfile(session.user);
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
      try { subscription?.unsubscribe(); } catch {}
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      setUser(null);
      setSupabaseUser(null);
    } catch {}
  }, []);

  return { user, supabaseUser, loading, signOut, refreshProfile };
}
