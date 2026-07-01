'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Loader2, KeyRound } from 'lucide-react';
import { HAS_APPKIT } from '@/lib/wallet/appkit';
import { signSiweMessage } from '@/lib/auth/walletSign';

/**
 * EnterNakaCultButton · wallet-connect entry to the NakaCult Vault.
 *
 * NakaCult is NOT coupled to a platform login. This button connects the wallet
 * (AppKit / WalletConnect · the same stack the swap card uses), proves
 * ownership via SIWE, and the server reads on-chain holdings and unlocks the
 * Vault iff the wallet holds the NIPPO NFT OR >= 1,227,000 $NAKA. On success it
 * lands the user directly in /vault. A connected wallet that doesn't qualify
 * gets an honest "not eligible yet" message · never a redirect to a pricing or
 * login page.
 *
 * Reuses the existing SIWE flow (/api/auth/wallet-nonce + /api/auth/wallet-verify)
 * which already auto-creates/links the account and applies entitlements, so the
 * wallet IS the identity · no email/password step.
 */

interface Props {
  className?: string;
  label?: string;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'error'; message: string }
  | { kind: 'denied' };

export function EnterNakaCultButton({ className, label = 'Enter NakaCult' }: Props) {
  const { open } = useAppKit();
  const { address, isConnected, connector } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [waitingForConnect, setWaitingForConnect] = useState(false);

  const verify = useCallback(async (addr: `0x${string}`) => {
    setStatus({ kind: 'busy' });
    try {
      const nonceRes = await fetch('/api/auth/wallet-nonce', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: addr, chain: 'evm' }),
      });
      if (!nonceRes.ok) throw new Error((await nonceRes.json()).error || 'Failed to issue nonce');
      const { nonce, message } = await nonceRes.json();

      const signature = await signSiweMessage({ signMessageAsync, connector, message, address: addr });

      const verifyRes = await fetch('/api/auth/wallet-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: addr, signature, nonce, chain: 'evm', redirectTo: '/vault' }),
      });
      if (!verifyRes.ok) throw new Error((await verifyRes.json()).error || 'Verification failed');
      const { actionLink, unlocked } = await verifyRes.json();

      if (unlocked?.cult) {
        // Eligible · consume the magic link (lands directly in /vault).
        window.location.href = actionLink;
        return;
      }
      // Authenticated but the wallet doesn't meet the cult threshold yet.
      setStatus({ kind: 'denied' });
      try { disconnect(); } catch { /* ignore */ }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection failed';
      setStatus({ kind: 'error', message });
      try { disconnect(); } catch { /* ignore */ }
    }
  }, [signMessageAsync, connector, disconnect]);

  // Auto-continue to SIWE once a wallet finishes connecting (only after the
  // user opted in by clicking).
  useEffect(() => {
    if (waitingForConnect && isConnected && address) {
      setWaitingForConnect(false);
      void verify(address as `0x${string}`);
    }
  }, [waitingForConnect, isConnected, address, verify]);

  const handleClick = useCallback(async () => {
    if (status.kind === 'busy') return;
    setStatus({ kind: 'idle' });
    if (isConnected && address) {
      void verify(address as `0x${string}`);
      return;
    }
    if (!HAS_APPKIT) {
      setStatus({ kind: 'error', message: 'Wallet connect is not configured.' });
      return;
    }
    setWaitingForConnect(true);
    try {
      await open();
    } catch (err) {
      setWaitingForConnect(false);
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : 'Could not open wallet' });
    }
  }, [status.kind, isConnected, address, verify, open]);

  const busy = status.kind === 'busy';

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
        className={
          className ??
          'group relative inline-flex items-center justify-center gap-2.5 rounded-2xl border border-[#FFD86B]/40 bg-gradient-to-b from-[#1a1430] to-[#0d0a1c] px-8 py-4 text-[15px] font-bold tracking-wide text-[#FFE9A8] shadow-[0_10px_40px_-10px_rgba(220,20,60,0.5)] transition hover:border-[#FFD86B]/70 hover:brightness-110 disabled:opacity-70'
        }
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
        <span>{busy ? 'Reading the sigil…' : label}</span>
      </button>

      {status.kind === 'denied' && (
        <p className="max-w-xs text-center text-[12.5px] leading-relaxed text-[#C8D6FF]">
          This wallet doesn&apos;t hold a <span className="font-semibold text-white">NIPPO</span> NFT
          or <span className="font-semibold text-white">1,227,000 $NAKA</span> yet. Acquire either and
          connect again · the sigil will know you.
        </p>
      )}
      {status.kind === 'error' && (
        <p className="max-w-xs text-center text-[12.5px] text-[#FCA5A5]">{status.message}</p>
      )}
    </div>
  );
}
