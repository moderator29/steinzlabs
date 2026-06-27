'use client';

/**
 * BiometricUnlockRow — a Security-section entry that lets the user proactively
 * set up (or remove) passkey / biometric unlock for the built-in wallet,
 * instead of only stumbling onto it inside a swap's Unlock modal.
 *
 * Setup wraps the wallet password with a PRF-derived key behind the device
 * authenticator (Face ID / Touch ID / Windows Hello / Android). The password
 * and key never leave the device — see lib/wallet/passkeyWrap.ts. Once enrolled,
 * every signing flow's Unlock modal offers "Sign in with passkey".
 */

import { useEffect, useState } from 'react';
import { Fingerprint, Loader2, Check, Eye, EyeOff } from 'lucide-react';
import { verifyWalletPassword } from '@/lib/wallet/encryption';
import {
  isPasskeySupported,
  hasLocalPasskey,
  registerPasskey,
  removeAllPasskeys,
} from '@/lib/wallet/passkeyClient';

export function BiometricUnlockRow({ encryptedKey }: { encryptedKey: string }) {
  const [supported, setSupported] = useState(false);
  // Server feature-flag gate: the authenticate options endpoint 403s when the
  // passkey flag is off, so we only surface setup when the platform allows it.
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSupported(isPasskeySupported());
    setEnrolled(hasLocalPasskey());
    // Probe the flag: GET returns 200 when enabled (even with no credentials it
    // returns options), 403 when the feature is off.
    void fetch('/api/wallet/passkey/authenticate', { method: 'GET' })
      .then((r) => setFlagEnabled(r.status !== 403))
      .catch(() => setFlagEnabled(false));
  }, []);

  if (!supported || !flagEnabled) return null;

  const handleEnroll = async () => {
    if (!password) { setError('Enter your wallet password to enable biometric unlock.'); return; }
    setError(null);
    setBusy(true);
    try {
      const ok = await verifyWalletPassword(encryptedKey, password);
      if (!ok) { setError('Wrong password. Try again.'); return; }
      const result = await registerPasskey(password, typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) : undefined);
      if (result.ok) {
        setEnrolled(true);
        setOpen(false);
        setPassword('');
      } else {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await removeAllPasskeys();
      setEnrolled(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${enrolled ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
            <Fingerprint className={`w-4 h-4 ${enrolled ? 'text-emerald-400' : 'text-blue-400'}`} />
          </div>
          <div>
            <p className="text-sm text-white font-medium">Biometric unlock</p>
            <p className="text-xs text-slate-500">
              {enrolled ? 'Face ID / Touch ID enabled on this device' : 'Unlock signing with your device passkey'}
            </p>
          </div>
        </div>
        {enrolled ? (
          <button
            onClick={() => void handleRemove()}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Remove'}
          </button>
        ) : (
          <button
            onClick={() => { setOpen((v) => !v); setError(null); }}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            {open ? 'Cancel' : 'Set up'}
          </button>
        )}
      </div>

      {open && !enrolled && (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleEnroll(); }}
              placeholder="Wallet password"
              autoComplete="current-password"
              className="w-full bg-[#111827] border border-white/10 rounded-xl px-4 py-2.5 pe-11 text-sm focus:outline-none focus:border-[#0066FF]/50"
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
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <button
            onClick={() => void handleEnroll()}
            disabled={busy || !password}
            className="w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#0066FF] to-[#7C3AED] disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy
              ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Waiting for passkey…</>)
              : (<><Check className="w-3.5 h-3.5" /> Enable biometric unlock</>)}
          </button>
        </div>
      )}
      {error && !open && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
    </div>
  );
}
