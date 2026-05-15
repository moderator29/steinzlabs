'use client';

/**
 * WalletConnectGroup — the unified wallet sign-in/up surface on the
 * auth pages. Replaces the bare <WalletAuthButton /> which was
 * EVM-only.
 *
 * Renders the EVM (Reown AppKit / MetaMask / WalletConnect) and Solana
 * (Phantom) options side-by-side on desktop, stacked on mobile.
 * Backend (app/api/auth/wallet-nonce + wallet-verify) already accepts
 * both chains; this component is the missing client surface for SOL.
 *
 * If WalletConnect Project ID isn't configured (HAS_APPKIT is false),
 * the EVM button silently no-renders inside WalletAuthButton and only
 * Phantom remains visible — the page never becomes empty.
 */

import { WalletAuthButton } from './WalletAuthButton';
import { SolanaWalletAuthButton } from './SolanaWalletAuthButton';

interface Props {
  mode: 'signin' | 'signup';
}

export function WalletConnectGroup({ mode }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      <WalletAuthButton mode={mode} />
      <SolanaWalletAuthButton mode={mode} />
    </div>
  );
}
