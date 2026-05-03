'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Loader2, Wallet } from 'lucide-react';
import { HAS_APPKIT } from '@/lib/wallet/appkit';
import { useToast } from '@/components/Toast';

type Mode = 'signin' | 'signup';

interface Props {
  mode: Mode;
  /** Called after successful sign-in / sign-up. Defaults to /dashboard. */
  redirectTo?: string;
  className?: string;
}

/**
 * "Sign in / Sign up with Wallet" button for the auth pages.
 *
 * Flow (EVM):
 *   1. Open AppKit modal — user picks MetaMask / WalletConnect-compatible wallet.
 *   2. Once connected, request a nonce from /api/auth/wallet-nonce.
 *   3. Prompt the wallet to sign the SIWE-style message.
 *   4. POST signature to /api/auth/wallet-verify.
 *   5. Navigate to the returned `actionLink` — this consumes the magic link
 *      and establishes a Supabase session, then bounces to /dashboard.
 *
 * Solana support is a follow-up; this component currently surfaces EVM only.
 *
 * Renders nothing if WalletConnect Project ID is not configured (HAS_APPKIT
 * is false). The auth pages also have email + password flows so the page
 * still works in that case.
 */
export function WalletAuthButton({ mode, redirectTo = '/dashboard', className }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [busy, setBusy] = useState(false);
  const [waitingForConnect, setWaitingForConnect] = useState(false);

  const verify = useCallback(async (addr: `0x${string}`) => {
    setBusy(true);
    try {
      // Step 1 — issue nonce
      const nonceRes = await fetch('/api/auth/wallet-nonce', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: addr, chain: 'evm' }),
      });
      if (!nonceRes.ok) throw new Error((await nonceRes.json()).error || 'Failed to issue nonce');
      const { nonce, message } = await nonceRes.json();

      // Step 2 — request signature
      const signature = await signMessageAsync({ message });

      // Step 3 — verify on the server, get the magic-link
      const verifyRes = await fetch('/api/auth/wallet-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: addr, signature, nonce, chain: 'evm' }),
      });
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).error || 'Verification failed');
      const { actionLink } = await verifyRes.json();

      // Step 4 — consume the magic-link to set the Supabase session
      window.location.href = actionLink;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Wallet auth failed';
      showToast(msg, 'error');
      // Drop the wallet session so the next click reopens the modal cleanly.
      try { disconnect(); } catch { /* ignore */ }
      setBusy(false);
    }
  }, [signMessageAsync, disconnect, showToast]);

  // Auto-trigger SIWE the moment a wallet finishes connecting (only when the
  // user opted in by clicking the button). Avoids re-prompting on every page
  // load if the wallet is already connected from another flow.
  useEffect(() => {
    if (waitingForConnect && isConnected && address) {
      setWaitingForConnect(false);
      verify(address as `0x${string}`);
    }
  }, [waitingForConnect, isConnected, address, verify]);

  if (!HAS_APPKIT) return null;

  const handleClick = async () => {
    if (busy) return;
    if (isConnected && address) {
      // Already connected — go straight to signing.
      verify(address as `0x${string}`);
      return;
    }
    setWaitingForConnect(true);
    try {
      await open();
    } catch (err) {
      setWaitingForConnect(false);
      showToast(err instanceof Error ? err.message : 'Could not open wallet modal', 'error');
    }
  };

  const label = mode === 'signup' ? 'Sign up with wallet' : 'Sign in with wallet';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={
        className ??
        'flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-[15px] font-semibold text-white transition hover:border-[#0A1EFF]/40 hover:bg-white/[0.05] disabled:opacity-60'
      }
      aria-busy={busy}
    >
      {busy ? <Loader2 size={18} className="animate-spin" /> : <Wallet size={18} />}
      <span>{busy ? 'Verifying…' : label}</span>
    </button>
  );
}

/**
 * Decorative divider used above/below the wallet button on auth pages.
 *
 *   <AuthOrDivider />
 */
export function AuthOrDivider({ label = 'or continue with' }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-xs uppercase tracking-wider text-white/40">{label}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}
