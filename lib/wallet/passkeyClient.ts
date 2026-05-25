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
import {
  generateSalt,
  wrapAndStore,
  unwrapPassword,
  getStoredSaltBytes,
  getWrapBlob,
  deleteWrapBlob,
} from './passkeyWrap';

export function isPasskeySupported(): boolean {
  try { return browserSupportsWebAuthn(); } catch { return false; }
}

// base64url helpers (kept local to avoid a circular import with passkeyWrap)
function b64uEncode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Register a passkey AND wrap the wallet password with a PRF-derived key.
 *
 * Two-phase ceremony:
 *   1. Standard WebAuthn registration → server stores the credential.
 *   2. Immediate authentication ceremony with the PRF extension on a
 *      fresh per-credential salt → derives the wrap key, encrypts the
 *      password, stores ciphertext in localStorage.
 *
 * If the authenticator does not return PRF results in phase 2, the
 * credential is deleted (we don't want a registered passkey we can't
 * use to unwrap) and the caller gets back { ok:false, prfUnsupported }.
 */
export async function registerPasskey(
  password: string,
  deviceName?: string,
): Promise<
  | { ok: true; credentialId: string }
  | { ok: false; error: string; prfUnsupported?: boolean }
> {
  try {
    // 1) Registration options + verification
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
    const { credentialId } = (await verifyRes.json()) as { credentialId: string };

    // 2) Derive the wrap key via PRF on a freshly-minted salt.
    const salt = generateSalt();
    const authOptsRes = await fetch('/api/wallet/passkey/authenticate');
    if (!authOptsRes.ok) {
      await rollbackCredential(credentialId);
      return { ok: false, error: 'Could not start PRF ceremony after registration' };
    }
    const authOptions = (await authOptsRes.json()) as PublicKeyCredentialRequestOptionsJSON;
    // Inject the PRF eval input. simplewebauthn/browser accepts base64url
    // strings on the JSON side and decodes them to ArrayBuffers internally.
    const authOptionsWithPrf: PublicKeyCredentialRequestOptionsJSON & {
      extensions?: { prf?: { eval?: { first?: string } } };
    } = {
      ...authOptions,
      extensions: { ...authOptions.extensions, prf: { eval: { first: b64uEncode(salt) } } },
    };

    const assertion = await startAuthentication({ optionsJSON: authOptionsWithPrf });
    const extResults = assertion.clientExtensionResults as
      | { prf?: { results?: { first?: ArrayBuffer } } }
      | undefined;
    const prfOutput = extResults?.prf?.results?.first;
    if (!prfOutput) {
      // Authenticator doesn't support PRF. Roll back so we don't keep a
      // registered credential we can't actually unwrap with.
      await rollbackCredential(credentialId);
      return {
        ok: false,
        error: 'This device or browser does not support the PRF extension needed for passwordless unlock. Try a different browser (Chrome, Edge, Safari 17+, Android) or use the password.',
        prfUnsupported: true,
      };
    }

    // Hand the PRF assertion through server verify so sign_count + last_used_at
    // stay honest (and replay protections fire).
    const verifyAuthRes = await fetch('/api/wallet/passkey/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: assertion }),
    });
    if (!verifyAuthRes.ok) {
      await rollbackCredential(credentialId);
      return { ok: false, error: 'Passkey PRF verification failed' };
    }

    await wrapAndStore(credentialId, salt, prfOutput, password);
    return { ok: true, credentialId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Passkey registration cancelled' };
  }
}

/**
 * Authenticate with a passkey and return the decrypted wallet password.
 *
 * Returns the password on success. The caller is responsible for handing
 * it to setWalletSessionKey + the verified-password callback. Password
 * never crosses the network — it's unwrapped entirely client-side from
 * the localStorage blob produced at register time.
 */
export async function authenticateWithPasskey(): Promise<
  | { ok: true; password: string; credentialId: string }
  | { ok: false; error: string }
> {
  try {
    const optsRes = await fetch('/api/wallet/passkey/authenticate');
    if (!optsRes.ok) {
      const j = await optsRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? 'Could not start passkey unlock' };
    }
    const options = (await optsRes.json()) as PublicKeyCredentialRequestOptionsJSON & {
      allowCredentials?: Array<{ id: string }>;
    };

    // Find the credential we have a wrap blob for. If the server says we
    // have multiple but we only wrapped one, narrow allowCredentials so
    // the UA picks the wrapped one.
    const allowed: Array<{ id: string }> = options.allowCredentials ?? [];
    const candidate = allowed.find((c: { id: string }) => !!getWrapBlob(c.id))
      ?? (allowed.length === 1 ? allowed[0] : undefined);
    if (!candidate) {
      return {
        ok: false,
        error: 'No locally-wrapped passkey found on this device. Set up the passkey again to use passwordless unlock.',
      };
    }
    const salt = getStoredSaltBytes(candidate.id);
    if (!salt) {
      return { ok: false, error: 'Passkey wrap is missing — re-register the passkey.' };
    }

    const optsWithPrf: PublicKeyCredentialRequestOptionsJSON & {
      extensions?: { prf?: { eval?: { first?: string } } };
    } = {
      ...options,
      allowCredentials: [{ ...candidate, type: 'public-key' } as never],
      extensions: { ...options.extensions, prf: { eval: { first: b64uEncode(salt) } } },
    };

    const assertion = await startAuthentication({ optionsJSON: optsWithPrf });
    const extResults = assertion.clientExtensionResults as
      | { prf?: { results?: { first?: ArrayBuffer } } }
      | undefined;
    const prfOutput = extResults?.prf?.results?.first;
    if (!prfOutput) {
      return { ok: false, error: 'Authenticator did not return a PRF result. Use the password.' };
    }

    const verifyRes = await fetch('/api/wallet/passkey/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: assertion }),
    });
    if (!verifyRes.ok) {
      const j = await verifyRes.json().catch(() => ({}));
      return { ok: false, error: j.error ?? 'Passkey verification failed' };
    }

    const password = await unwrapPassword(assertion.id, prfOutput);
    if (!password) {
      // Verified server-side but local unwrap failed (corrupt blob, wrong
      // device, ciphertext deleted). Drop the dead entry so the UI re-prompts
      // for setup next time.
      deleteWrapBlob(assertion.id);
      return { ok: false, error: 'Could not unwrap the wallet password. Re-register the passkey.' };
    }
    return { ok: true, password, credentialId: assertion.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Passkey cancelled' };
  }
}

async function rollbackCredential(credentialId: string): Promise<void> {
  try {
    await fetch(`/api/wallet/passkey/register?credentialId=${encodeURIComponent(credentialId)}`, {
      method: 'DELETE',
    });
  } catch {
    /* best-effort — server-side credential will linger until next login + the
       wrap-store check catches it, but registration was abandoned. */
  }
}
