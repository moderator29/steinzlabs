'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WalletInfo {
  address: string;
  chain: string;
  balance: number;
  balanceUSD: number;
  isLoading: boolean;
  walletName: string;
  isDefault: boolean;
}

export interface TokenHolding {
  address: string;
  symbol: string;
  name: string;
  amount: number;
  decimals: number;
  price: number;
  valueUSD: number;
  change24h: number;
  logoUrl: string | null;
  chain: string;
}

export interface PortfolioData {
  totalUSD: number;
  tokens: TokenHolding[];
  pnl: number;
  isLoading: boolean;
}

type ChainType = 'ethereum' | 'solana' | 'base' | 'arbitrum' | 'polygon' | 'avalanche' | 'bsc';

interface WalletContextValue {
  connectedWallet: WalletInfo | null;
  allWallets: WalletInfo[];
  portfolio: PortfolioData;
  activeChain: ChainType;
  setActiveChain: (chain: ChainType) => void;
  switchWallet: (address: string) => void;
  connectEVM: () => Promise<string | null>;
  connectSolana: () => Promise<string | null>;
  disconnectWallet: () => void;
  refreshBalance: () => Promise<void>;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

const defaultPortfolio: PortfolioData = { totalUSD: 0, tokens: [], pnl: 0, isLoading: false };

const WalletContext = createContext<WalletContextValue>({
  connectedWallet: null,
  allWallets: [],
  portfolio: defaultPortfolio,
  activeChain: 'ethereum',
  setActiveChain: () => {},
  switchWallet: () => {},
  connectEVM: async () => null,
  connectSolana: async () => null,
  disconnectWallet: () => {},
  refreshBalance: async () => {},
  isConnected: false,
  isLoading: false,
  error: null,
});

export function useWalletContext() {
  return useContext(WalletContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connectedWallet, setConnectedWallet] = useState<WalletInfo | null>(null);
  const [allWallets, setAllWallets] = useState<WalletInfo[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData>(defaultPortfolio);
  const [activeChain, setActiveChain] = useState<ChainType>('ethereum');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef(false);

  // Restore wallet from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('wallet_address');
    const storedProvider = localStorage.getItem('wallet_provider');
    if (stored) {
      const chain = storedProvider === 'phantom' ? 'solana' : 'ethereum';
      const wallet: WalletInfo = {
        address: stored,
        chain,
        balance: 0,
        balanceUSD: 0,
        isLoading: true,
        walletName: 'My Wallet',
        isDefault: true,
      };
      setConnectedWallet(wallet);
      setAllWallets([wallet]);
      setActiveChain(chain as ChainType);
    }
  }, []);

  // Fetch balance whenever connected wallet changes
  useEffect(() => {
    if (connectedWallet && !refreshRef.current) {
      refreshRef.current = true;
      fetchPortfolio(connectedWallet.address, connectedWallet.chain)
        .finally(() => { refreshRef.current = false; });
    }
  }, [connectedWallet?.address]);

  const fetchPortfolio = useCallback(async (address: string, chain: string) => {
    setPortfolio(prev => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch(`/api/wallet-intelligence?address=${address}&chain=${chain}`);
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      const data = await res.json();

      const tokens: TokenHolding[] = (data.tokens ?? []).map((t: Record<string, unknown>) => ({
        address: (t.address as string) || (t.mint as string) || '',
        symbol: (t.symbol as string) || '',
        name: (t.name as string) || '',
        amount: (t.balance as number) || (t.uiAmount as number) || 0,
        decimals: (t.decimals as number) || 0,
        price: (t.price as number) || 0,
        valueUSD: (t.valueUsd as number) || (t.value as number) || 0,
        change24h: (t.change24h as number) || 0,
        logoUrl: (t.logoUrl as string) || (t.logo as string) || null,
        chain,
      }));

      const totalUSD = tokens.reduce((sum, t) => sum + t.valueUSD, 0) + ((data.nativeBalance as number) || 0);

      setPortfolio({ totalUSD, tokens, pnl: 0, isLoading: false });
      setConnectedWallet(prev => prev ? { ...prev, balance: (data.nativeBalance as number) || 0, balanceUSD: totalUSD, isLoading: false } : prev);
    } catch {
      setPortfolio(prev => ({ ...prev, isLoading: false }));
      setConnectedWallet(prev => prev ? { ...prev, isLoading: false } : prev);
    }
  }, []);

  const connectEVM = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    try {
      if (typeof window === 'undefined' || !(window as unknown as Record<string, unknown>).ethereum) {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = `https://metamask.app.link/dapp/${window.location.host}`;
          return null;
        }
        throw new Error('MetaMask not detected. Please install the MetaMask extension.');
      }
      const accounts = await (window as unknown as Record<string, { request: (args: { method: string }) => Promise<string[]> }>).ethereum.request({ method: 'eth_requestAccounts' });
      const address = accounts[0];
      localStorage.setItem('wallet_address', address);
      localStorage.setItem('wallet_provider', 'metamask');
      const wallet: WalletInfo = { address, chain: 'ethereum', balance: 0, balanceUSD: 0, isLoading: true, walletName: 'My Wallet', isDefault: true };
      setConnectedWallet(wallet);
      setAllWallets([wallet]);
      setActiveChain('ethereum');
      window.dispatchEvent(new Event('steinz_wallet_changed'));
      return address;
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e.code === 4001) {
        setError('Connection rejected. Please approve in MetaMask.');
      } else {
        setError(e.message || 'Failed to connect MetaMask.');
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectSolana = useCallback(async (): Promise<string | null> => {
    setIsLoading(true);
    setError(null);
    try {
      if (typeof window === 'undefined' || !(window as unknown as Record<string, unknown>).solana) {
        const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
        if (isMobile) {
          window.location.href = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}`;
          return null;
        }
        throw new Error('Phantom not detected. Please install the Phantom extension.');
      }
      const response = await (window as unknown as Record<string, { connect: () => Promise<{ publicKey: { toString: () => string } }> }>).solana.connect();
      const address = response.publicKey.toString();
      localStorage.setItem('wallet_address', address);
      localStorage.setItem('wallet_provider', 'phantom');
      const wallet: WalletInfo = { address, chain: 'solana', balance: 0, balanceUSD: 0, isLoading: true, walletName: 'My Wallet', isDefault: true };
      setConnectedWallet(wallet);
      setAllWallets([wallet]);
      setActiveChain('solana');
      window.dispatchEvent(new Event('steinz_wallet_changed'));
      return address;
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      setError(e.message || 'Failed to connect Phantom.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnectWallet = useCallback(() => {
    localStorage.removeItem('wallet_address');
    localStorage.removeItem('wallet_provider');
    localStorage.removeItem('wallet_signature');
    setConnectedWallet(null);
    setAllWallets([]);
    setPortfolio(defaultPortfolio);
    setError(null);
    window.dispatchEvent(new Event('steinz_wallet_changed'));
  }, []);

  const switchWallet = useCallback((address: string) => {
    const wallet = allWallets.find(w => w.address === address);
    if (wallet) {
      setConnectedWallet(wallet);
      localStorage.setItem('wallet_address', wallet.address);
      localStorage.setItem('wallet_provider', wallet.chain === 'solana' ? 'phantom' : 'metamask');
      setActiveChain(wallet.chain as ChainType);
    }
  }, [allWallets]);

  const refreshBalance = useCallback(async () => {
    if (connectedWallet) {
      await fetchPortfolio(connectedWallet.address, connectedWallet.chain);
    }
  }, [connectedWallet, fetchPortfolio]);

  return (
    <WalletContext.Provider value={{
      connectedWallet,
      allWallets,
      portfolio,
      activeChain,
      setActiveChain,
      switchWallet,
      connectEVM,
      connectSolana,
      disconnectWallet,
      refreshBalance,
      isConnected: !!connectedWallet,
      isLoading,
      error,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
