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

interface Props {
  mode: 'signin' | 'signup';
  /** Where to land after auth. Defaults to /dashboard inside each button. */
  redirectTo?: string;
}

/**
 * A single, unified "Connect Wallet" action. The separate Phantom (Solana)
 * step that used to sit below/beside this was removed per product direction —
 * the primary wallet-connect button is the only wallet entry point on the auth
 * pages now. SolanaWalletAuthButton is retained in the codebase but no longer
 * rendered here.
 */
export function WalletConnectGroup({ mode, redirectTo }: Props) {
  return (
    <div className="grid grid-cols-1 gap-2.5">
      <WalletAuthButton mode={mode} redirectTo={redirectTo} />
    </div>
  );
}
