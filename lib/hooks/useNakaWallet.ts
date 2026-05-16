'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/hooks/useWallet';

/**
 * Unified wallet view for new platform code. Wraps the existing
 * useWallet() (which speaks AppKit + the legacy localStorage
 * contract) and surfaces a single canonical shape so we can stop
 * passing four different localStorage keys around.
 *
 * Audit §5.5 — NAKA wallet unification. This hook is the new
 * contract; existing surfaces (portfolio, swap, VTX, sniper, whale)
 * migrate to it via a single atomic PR per the handoff. Until then,
 * new components import from here so the eventual flip doesn't
 * need to touch their imports.
 *
 * SSR-safe: returns null fields when window is undefined.
 */

export interface NakaWalletState {
  address: string | null;
  chain: string | null;
  /** Wallet provider name ('phantom', 'metamask', 'appkit', etc.) */
  provider: string | null;
  /** Native + token balance snapshot if available. */
  balance: {
    nativeUsd: number | null;
    totalUsd: number | null;
    tokens: Record<string, number>;
  };
  /** True when the connection is via the Naka built-in wallet
   *  (non-custodial keys stored in browser) vs an external connector. */
  isBuiltIn: boolean;
  /** EIP-1193 chain id (decimal) when on EVM; null on Solana. */
  chainId: number | null;
  /** Chain the wallet is *actually* connected to right now — may
   *  differ from `chain` when the user navigates between chain-
   *  scoped pages without re-connecting. */
  walletPlatformChain: string | null;
  /** VTX wallet-access flag from user_preferences. When false, server
   *  side strips walletAddress from the VTX prompt context. Client
   *  surfaces this so UI can show the muted state. */
  vtxAccessGranted: boolean;
}

const EMPTY_STATE: NakaWalletState = {
  address: null,
  chain: null,
  provider: null,
  balance: { nativeUsd: null, totalUsd: null, tokens: {} },
  isBuiltIn: false,
  chainId: null,
  walletPlatformChain: null,
  vtxAccessGranted: true,
};

export function useNakaWallet(): NakaWalletState {
  const legacy = useWallet();
  const [vtxAccessGranted, setVtxAccessGranted] = useState(EMPTY_STATE.vtxAccessGranted);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Hydrate VTX access flag from localStorage; the real source is
    // user_preferences.vtx_wallet_access but the client mirror lives
    // here for instant-render gating without a round-trip.
    try {
      const raw = localStorage.getItem('naka_vtx_wallet_access');
      if (raw !== null) setVtxAccessGranted(raw === '1');
    } catch {
      /* localStorage blocked — fall back to default true */
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'naka_vtx_wallet_access') {
        setVtxAccessGranted(e.newValue === '1');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const legacyExtras = legacy as unknown as {
    chain?: string;
    isBuiltIn?: boolean;
    chainId?: number;
    walletPlatformChain?: string;
    balance?: { totalUsd?: number; tokens?: Record<string, number> };
  };

  return {
    address: legacy.address ?? null,
    chain: legacyExtras.chain ?? legacyExtras.walletPlatformChain ?? null,
    provider: legacy.provider ?? null,
    balance: {
      nativeUsd: null,
      totalUsd: legacyExtras.balance?.totalUsd ?? null,
      tokens: legacyExtras.balance?.tokens ?? {},
    },
    isBuiltIn: Boolean(legacyExtras.isBuiltIn),
    chainId: legacyExtras.chainId ?? null,
    walletPlatformChain: legacyExtras.walletPlatformChain ?? null,
    vtxAccessGranted,
  };
}
