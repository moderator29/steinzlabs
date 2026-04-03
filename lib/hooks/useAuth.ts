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
          created_at: profile.created_at,
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

    async function init() {
      try {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
        const sessionPromise = supabase.auth.getSession();
        const result = await Promise.race([sessionPromise, timeout]);
        
        if (result && 'data' in result && result.data?.session?.user && mounted) {
          setSupabaseUser(result.data.session.user);
          await fetchProfile(result.data.session.user);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setSupabaseUser(session.user);
          await fetchProfile(session.user);
        } else {
          setUser(null);
          setSupabaseUser(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signOut = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      try {
        const { firebaseSignOut } = await import('@/lib/firebase');
        await firebaseSignOut();
      } catch {}
      setUser(null);
      setSupabaseUser(null);
    } catch {}
  }, []);

  return { user, supabaseUser, loading, signOut, refreshProfile };
}
