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
        setUser({
          id: supaUser.id,
          email: supaUser.email,
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
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && mounted) {
          setSupabaseUser(session.user);
          await fetchProfile(session.user);
        }
      } catch {
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
      await supabase.auth.signOut();
      setUser(null);
      setSupabaseUser(null);
    } catch {}
  }, []);

  return { user, supabaseUser, loading, signOut, refreshProfile };
}
