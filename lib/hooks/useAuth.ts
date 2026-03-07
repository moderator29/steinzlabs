'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback } from 'react';

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
  const { user: privyUser, authenticated, ready, logout } = usePrivy();

  const user: User | null = authenticated && privyUser
    ? {
        id: privyUser.id,
        email: privyUser.email?.address,
        wallet_address: privyUser.wallet?.address,
        created_at: privyUser.createdAt?.toString(),
        user_metadata: {
          full_name: privyUser.email?.address?.split('@')[0],
        },
      }
    : null;

  const signOut = useCallback(async () => {
    try {
      await logout();
      localStorage.removeItem('wallet_address');
      localStorage.removeItem('wallet_signature');
      await fetch('/api/auth/privy-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      }).catch(() => {});
    } catch {}
  }, [logout]);

  return { user, loading: !ready, signOut };
}
