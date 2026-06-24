'use client';

/**
 * UnlockWalletModal — collects the user's wallet password, verifies it
 * by attempting decryption against the stored AES-GCM payload, then
 * caches it via setWalletSessionKey so subsequent signing operations
 * (swap, send, etc) can decrypt the private key without re-prompting
 * inside the same 30-minute session.
 *
 * Wires up the previously-orphaned setWalletSessionKey: getWalletSessionKey
 * was called from /dashboard/swap on Naka-wallet swaps, but no caller
 * ever invoked the setter. Result: every Naka-wallet swap failed with
 * "Wallet session expired. Please unlock your wallet." despite there
 * being no UI path to actually unlock. This modal is that UI path.
 *
 * Industry parity: Trust Wallet, Phantom, Rabby all gate signing
 * operations behind a session-cached password / biometric. The cache
 * has a hard 30-min TTL plus pagehide / visibilitychange clearing —
 * that lives in lib/wallet/walletSession.ts and is unchanged here.
 */

import { useEffect, useRef, useState } from 'react';
import { Lock, X, Loader2, Eye, EyeOff, Fingerprint } from 'lucide-react';
import { verifyWalletPassword } from '@/lib/wallet/encryption';
import { setWalletSessionKey } from '@/lib/wallet/walletSession';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';
import { isPasskeySupported, registerPasskey, authenticateWithPasskey } from '@/lib/wallet/passkeyClient';

interface Props {
  /** AES-GCM JSON payload from StoredWallet.encryptedKey. */
  encryptedKey: string;
  /** Friendly name for the active wallet — displayed in the modal title. */
  walletName?: string;
  /** Last-4 of the active address, for visual confirmation. */
  addressShort?: string;
  /** Called with the verified password after a successful unlock. */
  onUnlocked: (password: string) => void;
  onClose: () => void;
}

export default function UnlockWalletModal({
  encryptedKey,
  walletName,
  addressShort,
  onUnlocked,
  onClose,
}: Props) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [hasRegisteredPasskey, setHasRegisteredPasskey] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState<'register' | 'auth' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // A11Y4: focus trap + restore prior focus on close. Escape handled
  // by the hook so the manual listener below is now redundant.
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  useEffect(() => {
    // Auto-focus the password field — users open this modal expecting
    // to immediately type, no extra click required.
    inputRef.current?.focus();
    setPasskeyAvailable(isPasskeySupported());
    // Probe whether the user already has a registered passkey AND the
    // flag is enabled. The authenticate options endpoint 404s when no
    // credentials exist and 403s when the flag is off — either way we
    // hide the "Use passkey" CTA.
    void fetch('/api/wallet/passkey/authenticate', { method: 'GET' })
      .then((r) => setHasRegisteredPasskey(r.ok))
      .catch(() => setHasRegisteredPasskey(false));
  }, []);

  const handlePasskeyRegister = async () => {
    // To wrap the password we need it in memory. Verify it first against
    // the encrypted key, then hand it to registerPasskey which runs the
    // WebAuthn + PRF ceremony and stores the AES-GCM ciphertext locally.
    if (!password) {
      setError('Enter your wallet password first to enable passkey unlock.');
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setPasskeyBusy('register');
    try {
      const ok = await verifyWalletPassword(encryptedKey, password);
      if (!ok) {
        setError('Wrong password. Re-enter it to set up the passkey.');
        return;
      }
      const result = await registerPasskey(password, navigator.userAgent.slice(0, 60));
      if (result.ok) {
        setHasRegisteredPasskey(true);
        // Password is already verified — finish the unlock so the user
        // doesn't need a separate Unlock click after registration.
        setWalletSessionKey(password);
        onUnlocked(password);
      } else {
        setError(result.error);
      }
    } finally {
      setPasskeyBusy(null);
    }
  };

  const handlePasskeyUnlock = async () => {
    setError(null);
    setPasskeyBusy('auth');
    try {
      const result = await authenticateWithPasskey();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Defense in depth: sanity-check the unwrapped password against the
      // on-disk encrypted key in case the user re-encrypted on another
      // device after wrapping.
      const ok = await verifyWalletPassword(encryptedKey, result.password);
      if (!ok) {
        setError('Stored passkey wrap is out of date for this wallet. Enter your password to re-wrap.');
        return;
      }
      setWalletSessionKey(result.password);
      onUnlocked(result.password);
    } finally {
      setPasskeyBusy(null);
    }
  };

  const submit = async () => {
    if (!password) {
      setError('Enter your wallet password.');
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const ok = await verifyWalletPassword(encryptedKey, password);
      if (!ok) {
        setError('Wrong password. Try again.');
        return;
      }
      setWalletSessionKey(password);
      onUnlocked(password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify password.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Unlock wallet"
    >
      <div
        ref={trapRef}
        className="w-full max-w-[420px] bg-[#0a0f1a] border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0066FF]/10 border border-[#0066FF]/30 flex items-center justify-center">
              <Lock className="w-4 h-4 text-[#0066FF]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Unlock {walletName || 'wallet'}</h2>
              {addressShort && (
                <p className="text-[10px] font-mono text-gray-500 leading-tight">{addressShort}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Enter your wallet password to unlock signing for the next 30
          minutes. The password is held in memory only and cleared
          automatically when you close or background the tab.
        </p>

        <div>
          <label className="text-xs text-gray-400 mb-1.5 block font-medium">Password</label>
          <div className="relative">
            <input
              ref={inputRef}
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
              className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-3 pe-11 text-sm focus:outline-none focus:border-[#0066FF]/50"
              placeholder="Wallet password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && (
            <p className="text-[11px] text-[#EF4444] mt-2 bg-[#EF4444]/5 px-3 py-2 rounded-lg border border-[#EF4444]/15" role="alert">
              {error}
            </p>
          )}
        </div>

        <button
          onClick={() => void submit()}
          disabled={verifying || !password}
          className="w-full py-3 bg-gradient-to-r from-[#0066FF] to-[#7C3AED] rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {verifying ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>) : 'Unlock'}
        </button>

        {passkeyAvailable && hasRegisteredPasskey && (
          <button
            type="button"
            onClick={() => void handlePasskeyUnlock()}
            disabled={passkeyBusy !== null}
            className="w-full py-2.5 rounded-xl border border-white/10 hover:border-[#0066FF]/40 hover:bg-white/[0.03] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {passkeyBusy === 'auth'
              ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Waiting for passkey…</>)
              : (<><Fingerprint className="w-3.5 h-3.5" aria-hidden="true" /> Sign in with passkey</>)}
          </button>
        )}

        {passkeyAvailable && !hasRegisteredPasskey && (
          <button
            type="button"
            onClick={() => void handlePasskeyRegister()}
            disabled={passkeyBusy !== null}
            className="w-full py-2.5 rounded-xl border border-white/10 hover:border-[#0066FF]/40 hover:bg-white/[0.03] text-[11px] text-slate-400 hover:text-white inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {passkeyBusy === 'register'
              ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> Registering…</>)
              : (<><Fingerprint className="w-3.5 h-3.5" aria-hidden="true" /> Set up passkey for faster unlocking</>)}
          </button>
        )}
      </div>
    </div>
  );
}
