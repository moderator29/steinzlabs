'use client';

/**
 * Mirror Reown AppKit's connected account into the legacy
 * `localStorage`-based wallet state read by `lib/hooks/useWallet.ts`.
 *
 * Why a bridge instead of a refactor: useWallet() is consumed by ~30
 * components (swap, sniper, copy-trade, dashboard, dna-analyzer,
 * market modals…). Refactoring all of them in one PR is high-risk —
 * particularly with the non-custodial pending_trades flow that already
 * works through the legacy state. The bridge lets §10 ship the new
 * picker on the swap page while every other surface keeps its current
 * code path. Migration of the rest is §10b.
 *
 * Mount this anywhere inside <WalletProviders>. It renders nothing.
 *
 * Two-way sync intentionally avoided: AppKit is the source of truth
 * once an AppKit connect fires. Legacy connectMetaMask/connectPhantom
 * paths still write directly to localStorage and dispatch the legacy
 * change event — they don't touch AppKit's session.
 */

import { useEffect, useRef } from 'react';
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';

const LS_ADDRESS = 'wallet_address';
const LS_PROVIDER = 'wallet_provider';
const WALLET_CHANGE_EVENT = 'steinz_wallet_changed';

export default function AppKitBridge() {
  const { address, isConnected } = useAppKitAccount();
  const { caipNetwork } = useAppKitNetwork();
  const lastWritten = useRef<string | null>(null);

  useEffect(() => {
    if (!isConnected || !address) return;
    if (address === lastWritten.current) return;

    // Determine provider label from the network family. AppKit uses
    // CAIP-2 namespaces — 'eip155' for EVM, 'solana' for Solana.
    const namespace = caipNetwork?.chainNamespace;
    const provider = namespace === 'solana' ? 'phantom' : 'metamask';

    try {
      localStorage.setItem(LS_ADDRESS, address);
      localStorage.setItem(LS_PROVIDER, provider);
      window.dispatchEvent(new Event(WALLET_CHANGE_EVENT));
      lastWritten.current = address;
    } catch {
      // localStorage can be denied (private browsing on iOS Safari).
      // The AppKit modal will still show as connected because it has
      // its own session storage — legacy useWallet() consumers will
      // miss the connection but the swap page can read AppKit hooks
      // directly. Soft fail.
    }
  }, [address, isConnected, caipNetwork]);

  // On disconnect, clear the legacy state so the rest of the app
  // doesn't show a stale "connected" wallet.
  useEffect(() => {
    if (isConnected) return;
    if (lastWritten.current === null) return;
    try {
      localStorage.removeItem(LS_ADDRESS);
      localStorage.removeItem(LS_PROVIDER);
      window.dispatchEvent(new Event(WALLET_CHANGE_EVENT));
      lastWritten.current = null;
    } catch {
      /* noop */
    }
  }, [isConnected]);

  return null;
}
