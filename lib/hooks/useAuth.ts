'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface User {
  id: string;
  email?: string;
  wallet_address?: string;
  created_at?: string;
  user_metadata?: {
    avatar_url?: string;
    full_name?: string;
    [key: string]: unknown;
  };
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }: { data: { session: { user: User } | null } }) => {
      if (session?.user) {
        setUser(session.user as User);
      }
      setLoading(false);
    });

    const walletAddress = localStorage.getItem('wallet_address');
    if (walletAddress) {
      setUser(prev => prev || { id: walletAddress, wallet_address: walletAddress });
      setLoading(false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      setUser(session?.user as User || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('wallet_address');
    localStorage.removeItem('wallet_signature');
    setUser(null);
  };

  return { user, loading, signOut };
}
