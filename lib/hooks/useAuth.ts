'use client';

import { useEffect, useState, useCallback } from 'react';

interface User {
  id: string;
  email?: string;
  wallet_address?: string;
  username?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('steinz_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {}
    }
    setLoading(false);
  }, []);

  const signIn = useCallback((email: string, password: string) => {
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      username: email.split('@')[0],
    };
    localStorage.setItem('steinz_user', JSON.stringify(newUser));
    setUser(newUser);
    return newUser;
  }, []);

  const signUp = useCallback((email: string, password: string) => {
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      username: email.split('@')[0],
    };
    localStorage.setItem('steinz_user', JSON.stringify(newUser));
    setUser(newUser);
    return newUser;
  }, []);

  const connectWallet = useCallback(async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        const address = accounts[0];
        const newUser: User = {
          id: address,
          wallet_address: address,
          username: `${address.slice(0, 6)}...${address.slice(-4)}`,
        };
        localStorage.setItem('steinz_user', JSON.stringify(newUser));
        setUser(newUser);
        return newUser;
      } catch (err: any) {
        throw new Error(err.message || 'Wallet connection failed');
      }
    } else {
      const mockAddr = '0x742d4Dc64C3647c5c5A20e1A2A0B3c8d91D3a7f';
      const newUser: User = {
        id: mockAddr,
        wallet_address: mockAddr,
        username: `${mockAddr.slice(0, 6)}...${mockAddr.slice(-4)}`,
      };
      localStorage.setItem('steinz_user', JSON.stringify(newUser));
      setUser(newUser);
      return newUser;
    }
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem('steinz_user');
    setUser(null);
  }, []);

  return { user, loading, signIn, signUp, connectWallet, signOut };
}
