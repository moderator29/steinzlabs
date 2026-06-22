'use client';

/**
 * PRF-extension based wrap for the wallet password.
 *
 * Non-custodial guarantee: the server NEVER sees the password or the
 * PRF-derived key. The flow is entirely client-side:
 *
 *   register:
 *     1. WebAuthn registration creates a credential server-side.
 *     2. We immediately run a follow-up authentication ceremony with
 *        the PRF extension and a fresh per-credential salt to derive
 *        a 32-byte secret from the authenticator.
 *     3. HKDF-SHA256(prfOutput, info='naka-passkey-wrap-v1') → AES-GCM
 *        key. Encrypt the wallet password with it. Store
 *        { salt, iv, ciphertext } in localStorage keyed by credentialId.
 *
 *   unlock:
 *     1. Authentication ceremony with PRF eval using the stored salt.
 *     2. Same HKDF derivation → same AES-GCM key.
 *     3. Decrypt ciphertext → password → setWalletSessionKey.
 *
 * If the authenticator does not return PRF results (older iOS / Firefox /
 * non-supporting hardware), the caller falls back to the password-only
 * flow. Detection is runtime: getClientExtensionResults().prf.results.first
 * either exists or it doesn't.
 */

const STORAGE_KEY = 'naka_passkey_wrap_v1';
const HKDF_INFO = new TextEncoder().encode('naka-passkey-wrap-v1');

interface WrapBlob {
  salt: string;       // base64url, 32 bytes, used as PRF input
  iv: string;         // base64url, 12 bytes, AES-GCM nonce
  ciphertext: string; // base64url, encrypted password
}

type WrapStore = Record<string, WrapBlob>;

// ─── base64url helpers ───────────────────────────────────────────────────────

function b64uEncode(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64uDecode(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ─── localStorage CRUD ───────────────────────────────────────────────────────

function readStore(): WrapStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as WrapStore) : {};
  } catch {
    return {};
  }
}

function writeStore(s: WrapStore) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode — non-fatal */ }
}

export function getWrapBlob(credentialId: string): WrapBlob | null {
  return readStore()[credentialId] ?? null;
}

export function listWrappedCredentialIds(): string[] {
  return Object.keys(readStore());
}

export function deleteWrapBlob(credentialId: string) {
  const s = readStore();
  delete s[credentialId];
  writeStore(s);
}

export function clearAllWraps() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* non-fatal */ }
}

// ─── crypto ──────────────────────────────────────────────────────────────────

export function generateSalt(): Uint8Array {
  const s = new Uint8Array(32);
  crypto.getRandomValues(s);
  return s;
}

/** Derive an AES-GCM-256 key from a PRF output via HKDF-SHA256. */
async function deriveAesKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: HKDF_INFO },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt the password and persist {salt,iv,ciphertext} under credentialId. */
export async function wrapAndStore(
  credentialId: string,
  salt: Uint8Array,
  prfOutput: ArrayBuffer,
  password: string,
): Promise<void> {
  const key = await deriveAesKey(prfOutput);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(password),
  );
  const store = readStore();
  store[credentialId] = {
    salt: b64uEncode(salt),
    iv: b64uEncode(iv),
    ciphertext: b64uEncode(ciphertext),
  };
  writeStore(store);
}

/** Decrypt the password using a fresh PRF output for the same credential. */
export async function unwrapPassword(
  credentialId: string,
  prfOutput: ArrayBuffer,
): Promise<string | null> {
  const blob = getWrapBlob(credentialId);
  if (!blob) return null;
  try {
    const key = await deriveAesKey(prfOutput);
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64uDecode(blob.iv) as BufferSource },
      key,
      b64uDecode(blob.ciphertext) as BufferSource,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // Wrong PRF output (wrong passkey / corrupted blob) → null, caller
    // falls back to password entry.
    return null;
  }
}

/** Re-encode the stored salt for use as a PRF eval input. */
export function getStoredSaltBytes(credentialId: string): Uint8Array | null {
  const blob = getWrapBlob(credentialId);
  return blob ? b64uDecode(blob.salt) : null;
}
