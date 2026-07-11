'use client';

import { useEffect } from 'react';
import { getBuiltinWalletAddress, hydrateBuiltinWalletFromCloud } from '@/lib/wallet/builtinWallet';

/**
 * WalletHydrator — restores the Naka built-in wallet from the user's encrypted
 * cloud backup (user_wallets_v2 via /api/wallet/sync) into this browser's
 * localStorage ONCE per dashboard load.
 *
 * Why this exists: the built-in wallet is the account's real non-custodial
 * wallet, but every trading surface (wallet page / swap / gift / portfolio /
 * VTX) reads it from localStorage. On a fresh browser, a cleared session, or a
 * different device, those keys are absent even though the wallet exists in the
 * cloud, so surfaces wrongly showed "Not connected / No wallet found." Running
 * the cloud hydrate here means the wallet is live across the whole platform for
 * the session the moment the dashboard mounts. No-op (and cheap) when a wallet
 * already exists locally. Renders nothing.
 */
export default function WalletHydrator() {
  useEffect(() => {
    if (getBuiltinWalletAddress()) return; // already present locally
    let cancelled = false;
    hydrateBuiltinWalletFromCloud()
      .then((addr) => {
        // Notify any mounted wallet consumers so balances/detection refresh
        // without a manual reload once the wallet is restored.
        if (!cancelled && addr) window.dispatchEvent(new Event('steinz_wallet_changed'));
      })
      .catch(() => { /* stay disconnected — surfaces keep their honest prompt */ });
    return () => { cancelled = true; };
  }, []);

  return null;
}
