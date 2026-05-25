'use client';

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

export function isPasskeySupported(): boolean {
  try { return browserSupportsWebAuthn(); } catch { return false; }
}

export async function registerPasskey(deviceName?: string): Promise<{ ok: true; credentialId: string } | { ok: false; error: string }> {
  try {
    const optsRes = await fetch('/api/wallet/passkey/register');
    if (!optsRes.ok) {
      const j = await optsRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? 'Could not start registration' };
    }
    const options = (await optsRes.json()) as PublicKeyCredentialCreationOptionsJSON;
    const attResp = await startRegistration({ optionsJSON: options });
    const verifyRes = await fetch('/api/wallet/passkey/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: attResp, deviceName }),
    });
    if (!verifyRes.ok) {
      const j = await verifyRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? 'Registration verification failed' };
    }
    const { credentialId } = await verifyRes.json() as { credentialId: string };
    return { ok: true, credentialId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Passkey registration cancelled' };
  }
}

export async function authenticateWithPasskey(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const optsRes = await fetch('/api/wallet/passkey/authenticate');
    if (!optsRes.ok) {
      const j = await optsRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? 'Could not start passkey unlock' };
    }
    const options = (await optsRes.json()) as PublicKeyCredentialRequestOptionsJSON;
    const assertion = await startAuthentication({ optionsJSON: options });
    const verifyRes = await fetch('/api/wallet/passkey/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: assertion }),
    });
    if (!verifyRes.ok) {
      const j = await verifyRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? 'Passkey verification failed' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Passkey cancelled' };
  }
}
