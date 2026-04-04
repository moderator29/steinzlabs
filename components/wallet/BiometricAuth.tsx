'use client';

import { useState, useCallback, useEffect } from 'react';
import { Fingerprint, ShieldCheck, AlertTriangle, X } from 'lucide-react';

interface BiometricAuthProps {
  onSuccess: () => void;
  onCancel: () => void;
  action?: string;
}

const BIOMETRIC_ENABLED_KEY = 'steinz_biometric_enabled';

export function isBiometricAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window.PublicKeyCredential && navigator.credentials);
}

export function isBiometricEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBiometricEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {}
}

export default function BiometricAuth({ onSuccess, onCancel, action = 'transaction' }: BiometricAuthProps) {
  const [status, setStatus] = useState<'idle' | 'requesting' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const requestBiometric = useCallback(async () => {
    setStatus('requesting');
    setErrorMsg('');

    try {
      if (!isBiometricAvailable()) {
        setStatus('success');
        onSuccess();
        return;
      }

      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'STEINZ LABS', id: window.location.hostname },
          user: {
            id: new Uint8Array(16),
            name: 'steinz-user',
            displayName: 'STEINZ User',
          },
          pubKeyCredParams: [
            { type: 'public-key', alg: -7 },
            { type: 'public-key', alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      });

      if (credential) {
        setStatus('success');
        onSuccess();
      } else {
        setStatus('error');
        setErrorMsg('Authentication was not completed');
      }
    } catch (err: any) {
      setStatus('error');
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Authentication cancelled or not available');
      } else {
        setErrorMsg('Verification failed. Please try again.');
      }
    }
  }, [onSuccess]);

  useEffect(() => {
    if (status === 'idle') {
      requestBiometric();
    }
  }, [status, requestBiometric]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-white/[0.08] rounded-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Confirm {action}</h3>
          <button onClick={onCancel} className="p-1.5 hover:bg-white/[0.06] rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 py-4">
          {status === 'requesting' && (
            <>
              <div className="w-16 h-16 bg-[#0A1EFF]/10 rounded-full flex items-center justify-center animate-pulse">
                <Fingerprint className="w-8 h-8 text-[#0A1EFF]" />
              </div>
              <div className="text-center">
                <p className="text-sm text-white font-medium">Verifying identity</p>
                <p className="text-xs text-gray-500 mt-1">Use biometrics to authorize this {action}</p>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-sm text-emerald-400 font-medium">Verified</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm text-red-400 font-medium">Verification failed</p>
                <p className="text-xs text-gray-500 mt-1">{errorMsg}</p>
              </div>
              <div className="flex gap-2 w-full">
                <button onClick={() => setStatus('idle')} className="flex-1 py-2.5 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-xl text-xs font-bold transition-colors">
                  Try Again
                </button>
                <button onClick={onCancel} className="flex-1 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] rounded-xl text-xs font-medium transition-colors text-gray-400">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
