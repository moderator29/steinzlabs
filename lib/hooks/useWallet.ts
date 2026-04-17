'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { connectMetaMask, connectPhantom, clearStoredWallet } from '@/lib/wallet';

const WALLET_CHANGE_EVENT = 'steinz_wallet_changed';
const BALANCE_CHANGE_EVENT = 'steinz:balance-changed';

export interface WalletBalance {
  totalUsd: number;
  tokens: Record<string, number>;
  loading: boolean;
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalance>({ totalUsd: 0, tokens: {}, loading: false });

  const fetchBalance = useCallback(async (addr: string) => {
    if (!addr) return;
    setBalance(prev => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/wallet-intelligence?address=${addr}`);
      if (res.ok) {
        const data = await res.json();
        const tokens: Record<string, number> = {};
        if (data.holdings) {
          data.holdings.forEach((h: { symbol?: string; balance?: string | number }) => {
            if (h.symbol) tokens[h.symbol.toUpperCase()] = parseFloat(String(h.balance)) || 0;
          });
        }
        setBalance({ totalUsd: data.totalBalanceUsd || 0, tokens, loading: false });
      }
    } catch {
      setBalance(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    const addr = address || localStorage.getItem('wallet_address');
    if (addr) await fetchBalance(addr);
  }, [address, fetchBalance]);

  useEffect(() => {
    const stored = localStorage.getItem('wallet_address');
    const storedProvider = localStorage.getItem('wallet_provider');
    if (stored) {
      setAddress(stored);
      setProvider(storedProvider);
      fetchBalance(stored);
    }

    const handleChange = () => {
      const addr = localStorage.getItem('wallet_address');
      const prov = localStorage.getItem('wallet_provider');
      setAddress(addr);
      setProvider(prov);
      if (addr) fetchBalance(addr);
    };

    const handleBalanceChange = () => {
      const addr = localStorage.getItem('wallet_address');
      if (addr) fetchBalance(addr);
    };

    window.addEventListener(WALLET_CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);
    window.addEventListener(BALANCE_CHANGE_EVENT, handleBalanceChange);

    return () => {
      window.removeEventListener(WALLET_CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
      window.removeEventListener(BALANCE_CHANGE_EVENT, handleBalanceChange);
    };
  }, [fetchBalance]);

  const notifyChange = useCallback(() => {
    window.dispatchEvent(new Event(WALLET_CHANGE_EVENT));
  }, []);

  const upsertSupabaseUser = useCallback(async (walletAddress: string) => {
    if (!supabase) return;
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', walletAddress)
        .single();

      if (!existingUser) {
        await supabase.from('users').insert({
          wallet_address: walletAddress,
          username: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
        });
      }
    } catch (err) {
      console.error('[useWallet] User upsert failed:', err);
    }
  }, []);

  const performConnect = useCallback(async (type: 'evm' | 'solana'): Promise<string | null> => {
    setConnecting(true);
    setError(null);
    try {
      if (type === 'evm') {
        const hasProvider = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
        if (!hasProvider) {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            window.location.href = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
            return null;
          }
          throw new Error('MetaMask not detected. Please install the MetaMask extension.');
        }
        const wallet = await connectMetaMask();
        localStorage.setItem('wallet_address', wallet.address);
        localStorage.setItem('wallet_provider', 'metamask');
        setAddress(wallet.address);
        setProvider('metamask');
        await upsertSupabaseUser(wallet.address);
        notifyChange();
        return wallet.address;
      } else {
        const hasProvider = typeof window !== 'undefined' && typeof window.solana !== 'undefined';
        if (!hasProvider) {
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`;
            return null;
          }
          throw new Error('Phantom not detected. Please install the Phantom extension.');
        }
        const wallet = await connectPhantom();
        localStorage.setItem('wallet_address', wallet.address);
        localStorage.setItem('wallet_provider', 'phantom');
        setAddress(wallet.address);
        setProvider('phantom');
        await upsertSupabaseUser(wallet.address);
        notifyChange();
        return wallet.address;
      }
    } catch (err: any) {
      if (err.code === 4001) {
        setError(`Connection rejected. Please approve the request in ${type === 'evm' ? 'MetaMask' : 'Phantom'}.`);
      } else {
        setError(err.message || `Failed to connect ${type === 'evm' ? 'MetaMask' : 'Phantom'}.`);
      }
      return null;
    } finally {
      setConnecting(false);
    }
  }, [upsertSupabaseUser, notifyChange]);

  const connectEVM = useCallback(() => performConnect('evm'), [performConnect]);
  const connectSolana = useCallback(() => performConnect('solana'), [performConnect]);

  const connectAuto = useCallback(async (): Promise<string | null> => {
    const hasEthereum = typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
    const hasSolana = typeof window !== 'undefined' && typeof window.solana !== 'undefined';

    if (hasEthereum) {
      return performConnect('evm');
    } else if (hasSolana) {
      return performConnect('solana');
    } else {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
        return null;
      }
      setError('No wallet detected. Please install MetaMask or Phantom.');
      return null;
    }
  }, [performConnect]);

  const disconnect = useCallback(() => {
    clearStoredWallet();
    setAddress(null);
    setProvider(null);
    setError(null);
    notifyChange();
  }, [notifyChange]);

  const shortAddress = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return {
    address,
    shortAddress,
    provider,
    connecting,
    error,
    isConnected: !!address,
    balance,
    refreshBalance,
    connectEVM,
    connectSolana,
    connectAuto,
    disconnect,
    clearError: () => setError(null),
  };
}
