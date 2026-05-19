'use client';

import { PhantomLogo } from '@/components/wallet/WalletLogo';

/**
 * "Sign in / Sign up with Solana wallet" — companion to WalletAuthButton
 * (which is EVM-only via wagmi). Uses the in-page Phantom provider
 * directly because wagmi/AppKit's Solana adapter is heavy and we don't
 * need its multi-chain features for SIWS.
 *
 * Backend (app/api/auth/wallet-verify) already handles ed25519 signature
 * verification for chain=solana — we just need the client to:
 *   1. Connect Phantom (window.solana.connect()).
 *   2. Request a nonce keyed to the base58 pubkey.
 *   3. Sign the SIWS message with phantom.signMessage(...).
 *   4. POST signature (base58-encoded) + nonce to wallet-verify.
 *   5. Bounce to the returned magic-link.
 */

import { useState } from 'react';
import { useToast } from '@/components/Toast';

interface Props {
  mode: 'signin' | 'signup';
  className?: string;
}

interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toString(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  signMessage: (message: Uint8Array, encoding?: 'utf8') => Promise<{ signature: Uint8Array }>;
  disconnect?: () => Promise<void>;
}

function getPhantom(): PhantomProvider | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { solana?: PhantomProvider; phantom?: { solana?: PhantomProvider } };
  return win.phantom?.solana ?? win.solana ?? null;
}

function bytesToBase58(bytes: Uint8Array): string {
  // Lightweight base58 encoder so we don't pull bs58 into the client
  // bundle just for one signature roundtrip. Server-side we already
  // depend on bs58 for verification; here we keep it tiny.
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (let i = 0; i < zeros; i++) out += ALPHABET[0];
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}

export function SolanaWalletAuthButton({ mode, className }: Props) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    const phantom = getPhantom();
    if (!phantom?.isPhantom) {
      // Phantom isn't installed — open the install page in a new tab.
      // Mobile deep-link is handled inside Phantom itself.
      showToast('Phantom wallet not detected. Install Phantom to continue.', 'error');
      window.open('https://phantom.app/download', '_blank', 'noopener,noreferrer');
      return;
    }

    setBusy(true);
    try {
      // Step 1 — connect (reuses an existing approval if present).
      const { publicKey } = await phantom.connect();
      const address = publicKey.toString();

      // Step 2 — request a server-issued nonce.
      const nonceRes = await fetch('/api/auth/wallet-nonce', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, chain: 'solana' }),
      });
      if (!nonceRes.ok) {
        throw new Error((await nonceRes.json()).error || 'Failed to issue nonce');
      }
      const { nonce, message } = await nonceRes.json() as { nonce: string; message: string };

      // Step 3 — sign the SIWS message via Phantom (utf8 encoding so the
      // server's ed25519 verify reads the same bytes).
      const messageBytes = new TextEncoder().encode(message);
      const { signature } = await phantom.signMessage(messageBytes, 'utf8');
      const sigBase58 = bytesToBase58(signature);

      // Step 4 — verify and consume the magic link.
      const verifyRes = await fetch('/api/auth/wallet-verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address, signature: sigBase58, nonce, chain: 'solana' }),
      });
      if (!verifyRes.ok) {
        throw new Error((await verifyRes.json()).error || 'Verification failed');
      }
      const { actionLink } = await verifyRes.json() as { actionLink: string };

      window.location.href = actionLink;
    } catch (err) {
      const code = (err as { code?: number })?.code;
      const msg = code === 4001 ? 'Solana sign-in cancelled.'
        : err instanceof Error ? err.message
        : 'Solana sign-in failed.';
      showToast(msg, 'error');
      try { await phantom.disconnect?.(); } catch { /* ignore */ }
      setBusy(false);
    }
  };

  const label = mode === 'signup' ? 'Sign up with Phantom' : 'Sign in with Phantom';

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className={
        className ??
        'flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-[15px] font-semibold text-white transition hover:border-[#9945FF]/40 hover:bg-white/[0.05] disabled:opacity-60'
      }
      aria-busy={busy}
    >
      {/* Phantom logo — single source of truth in components/wallet/WalletLogo.tsx
          (correct #AB9FF2 → #534BB1 official gradient). The hand-traced inline
          SVG that used to live here had the gradient inverted (#534BB1 → #551BF9),
          which is why the mark looked off-brand on the auth surface. */}
      <PhantomLogo size={18} />
      <span>{busy ? 'Verifying…' : label}</span>
    </button>
  );
}
