'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { connectMetaMask, connectPhantom, clearStoredWallet } from '@/lib/wallet';

const WALLET_CHANGE_EVENT = 'steinz_wallet_changed';

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('wallet_address');
    const storedProvider = localStorage.getItem('wallet_provider');
    if (stored) {
      setAddress(stored);
      setProvider(storedProvider);
    }

    const handleChange = () => {
      const addr = localStorage.getItem('wallet_address');
      const prov = localStorage.getItem('wallet_provider');
      setAddress(addr);
      setProvider(prov);
    };

    window.addEventListener(WALLET_CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);

    return () => {
      window.removeEventListener(WALLET_CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

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
    } catch {}
  }, []);

  const performConnect = useCallback(async (type: 'evm' | 'solana'): Promise<string | null> => {
    setConnecting(true);
    setError(null);
    try {
      if (type === 'evm') {
        const hasProvider = typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined';
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
        const hasProvider = typeof window !== 'undefined' && typeof (window as any).solana !== 'undefined';
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
    const hasEthereum = typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined';
    const hasSolana = typeof window !== 'undefined' && typeof (window as any).solana !== 'undefined';

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
    connectEVM,
    connectSolana,
    connectAuto,
    disconnect,
    clearError: () => setError(null),
  };
}
