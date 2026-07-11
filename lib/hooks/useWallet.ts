'use client';

/**
 * §5.2 — Canonical wallet/balance hook. Call from ANY client component
 * that needs the connected wallet address, total USD, or per-token
 * balance. Backed by /api/wallet-intelligence (multi-chain aggregator).
 *
 *   const { address, balance } = useWallet();
 *   // balance.totalUsd           → USD across all chains
 *   // balance.tokens["ETH"]      → ETH balance as number
 *   // balance.tokens["USDC"]     → USDC balance as number
 *
 * Auto-refetches whenever 'steinz:balance-changed' event fires (after
 * a swap, send, or receive). If you're adding a new feature that needs
 * to know the user's funds, use THIS — don't write a second fetcher.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { connectMetaMask, connectPhantom, clearStoredWallet } from '@/lib/wallet';
import { getBuiltinWalletAddress, hydrateBuiltinWalletFromCloud } from '@/lib/wallet/builtinWallet';

const WALLET_CHANGE_EVENT = 'steinz_wallet_changed';
const BALANCE_CHANGE_EVENT = 'steinz:balance-changed';

export interface WalletBalance {
  totalUsd: number;
  tokens: Record<string, number>;
  loading: boolean;
}

/**
 * Audit M4 #2 follow-up — within-EVM chain detection. Reads
 * window.ethereum.chainId (EIP-1193) and maps the hex value to our
 * platform chain id. The set is intentionally narrow — only the chains
 * the platform actually trades on. Unknown chainIds return null so the
 * UI can render an honest "unrecognized network" rather than guess.
 */
const EVM_CHAINID_TO_PLATFORM: Record<string, string> = {
  '0x1':     'ethereum',
  '0x2105':  'base',         // 8453
  '0xa4b1':  'arbitrum',     // 42161
  '0xa':     'optimism',     // 10
  '0x89':    'polygon',      // 137
  '0x38':    'bsc',          // 56
  '0xa86a':  'avalanche',    // 43114
  '0x1237':  'robinhood',    // 4663 — Robinhood Chain (Arbitrum-Orbit L2, native ETH)
};

export function evmChainIdToPlatformChain(chainIdHex: string | null | undefined): string | null {
  if (!chainIdHex) return null;
  return EVM_CHAINID_TO_PLATFORM[chainIdHex.toLowerCase()] ?? null;
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalance>({ totalUsd: 0, tokens: {}, loading: false });
  // Audit M4 #2 follow-up — current EVM chain id (hex). null when no
  // EVM wallet is connected or window.ethereum doesn't expose chainId.
  // Updated reactively via the EIP-1193 'chainChanged' event so the
  // mismatch guard in trading panels reacts instantly when the user
  // switches networks in MetaMask without needing to refresh.
  const [chainId, setChainId] = useState<string | null>(null);

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
    const addr = address || getBuiltinWalletAddress() || localStorage.getItem('wallet_address');
    if (addr) await fetchBalance(addr);
  }, [address, fetchBalance]);

  useEffect(() => {
    // Fall back to the canonical built-in wallet store so a wallet the user
    // created (persisted under steinz_wallets / steinz_default_wallet) is
    // detected even when the legacy wallet_address key was never written —
    // fixes the "connect a wallet" re-prompt across every surface that reads
    // this hook (swap / proof / portfolio / etc.).
    const resolveStoredAddress = (): { addr: string | null; prov: string | null } => {
      const legacy = localStorage.getItem('wallet_address');
      if (legacy) return { addr: legacy, prov: localStorage.getItem('wallet_provider') };
      const builtin = getBuiltinWalletAddress();
      if (builtin) return { addr: builtin, prov: 'builtin' };
      return { addr: null, prov: null };
    };

    let cancelled = false;
    const { addr: stored, prov: storedProvider } = resolveStoredAddress();
    if (stored) {
      setAddress(stored);
      setProvider(storedProvider);
      fetchBalance(stored);
    } else {
      // No built-in wallet in THIS browser's localStorage: restore it from the
      // user's encrypted cloud backup (user_wallets_v2 via /api/wallet/sync).
      // This is the real source of truth for the Naka built-in wallet, so a
      // wallet created on another device/session is detected everywhere —
      // fixes the "Not connected / No wallet found" prompt on wallet page /
      // swap / gift / portfolio when the account already has a wallet.
      hydrateBuiltinWalletFromCloud()
        .then((addr) => {
          if (!cancelled && addr) {
            setAddress(addr);
            setProvider('builtin');
            fetchBalance(addr);
          }
        })
        .catch(() => { /* stay disconnected */ });
    }

    const handleChange = () => {
      const { addr, prov } = resolveStoredAddress();
      setAddress(addr);
      setProvider(prov);
      if (addr) fetchBalance(addr);
    };

    const handleBalanceChange = () => {
      const { addr } = resolveStoredAddress();
      if (addr) fetchBalance(addr);
    };

    window.addEventListener(WALLET_CHANGE_EVENT, handleChange);
    window.addEventListener('storage', handleChange);
    window.addEventListener(BALANCE_CHANGE_EVENT, handleBalanceChange);

    // Audit M4 #2 follow-up — read initial chainId off the EVM provider
    // and subscribe to changes. If the user flips MetaMask from
    // Ethereum to Base, the trading panel's mismatch guard updates
    // without a refresh.
    const win = window as unknown as { ethereum?: { chainId?: string; request?: (args: { method: string }) => Promise<string>; on?: (e: string, h: (id: string) => void) => void; removeListener?: (e: string, h: (id: string) => void) => void } };
    const ethereum = win.ethereum;
    let chainHandler: ((id: string) => void) | null = null;
    if (ethereum) {
      // Some providers expose chainId synchronously, others require an RPC.
      if (ethereum.chainId) {
        setChainId(ethereum.chainId);
      } else if (ethereum.request) {
        ethereum.request({ method: 'eth_chainId' }).then(setChainId).catch(() => {});
      }
      if (ethereum.on) {
        chainHandler = (id: string) => setChainId(id);
        ethereum.on('chainChanged', chainHandler);
      }
    }

    return () => {
      cancelled = true;
      window.removeEventListener(WALLET_CHANGE_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
      window.removeEventListener(BALANCE_CHANGE_EVENT, handleBalanceChange);
      if (ethereum?.removeListener && chainHandler) {
        ethereum.removeListener('chainChanged', chainHandler);
      }
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
    // Audit M4 #2 follow-up — exposed so trading panels can detect a
    // within-EVM mismatch (e.g. wallet on Ethereum but page on Base)
    // without each consumer re-implementing chainId reading.
    chainId,
    walletPlatformChain: evmChainIdToPlatformChain(chainId),
  };
}
