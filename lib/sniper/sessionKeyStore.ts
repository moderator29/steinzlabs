'use client';

/**
 * At-rest protection for the Sniper SESSION SIGNING KEY in the browser.
 *
 * The sniper flow (SniperWalletModal) mints a fresh, capped, time-boxed session
 * EOA whose private key must stay on the device (never uploaded) so the user
 * keeps a non-custodial signer. Previously that key was written to localStorage
 * in PLAINTEXT under `naka_sniper_session_pk_<uid>_<chain>` — an XSS payload or a
 * shared device could read spendable key material verbatim.
 *
 * This module encrypts the key at rest using the SAME primitive the wallet uses
 * (lib/wallet/encryption.ts — AES-256-GCM with a PBKDF2-derived key, Web Crypto).
 * No new crypto is introduced. The at-rest passphrase is derived deterministically
 * per-user from the user id, mirroring how the server-side session-key crypto keys
 * off a stable per-deployment secret: the ciphertext is bound to a specific user so
 * a raw storage dump is not directly usable, and the same user can always recover
 * their own key. Caps / expiry / the non-custodial model are unchanged — this only
 * changes how the identical key bytes are serialized to disk.
 *
 * Ciphertext format is delegated to encryptPrivateKey (JSON v2 blob). decrypt
 * returns the byte-identical private key string that was stored.
 */

import { encryptPrivateKey, decryptPrivateKey } from '@/lib/wallet/encryption';

/** Global (non-namespaced) storage key. Purged by lib/auth/userScopedStorage. */
export function sessionPkKey(userId: string, chain: string): string {
  return `naka_sniper_session_pk_${userId}_${chain}`;
}

// Deterministic per-user at-rest passphrase for the wallet AES-256-GCM primitive.
// Bound to the user id so the encrypted blob is scoped to one account.
function pkPassphrase(userId: string): string {
  return `naka_sniper_session_pk::v1::${userId}`;
}

// An ethers private key is 0x followed by 64 hex chars. Used only to recognise a
// LEGACY plaintext value during migration (see loadSessionPrivateKey).
const PLAINTEXT_PK_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * Encrypt and persist the session private key. Best-effort: if Web Crypto or
 * localStorage is unavailable (e.g. non-secure context / storage blocked) this
 * resolves without persisting — it NEVER falls back to writing plaintext.
 */
export async function storeSessionPrivateKey(userId: string, chain: string, privateKey: string): Promise<void> {
  if (typeof window === 'undefined' || !privateKey) return;
  const blob = await encryptPrivateKey(privateKey, pkPassphrase(userId));
  try {
    localStorage.setItem(sessionPkKey(userId, chain), blob);
  } catch {
    /* storage blocked — do not persist plaintext */
  }
}

/**
 * Read the session private key back out, byte-identical to what was stored.
 *
 * Migration: existing users have a PLAINTEXT `0x…` value. We first try to decrypt
 * as ciphertext; if that fails and the raw value looks like a plaintext private
 * key, we treat it as legacy, transparently RE-ENCRYPT it in place, and return it
 * so the user is never locked out. Returns null when nothing is stored or the
 * value is neither valid ciphertext nor a recognisable plaintext key.
 *
 * (No client-side signer consumes this yet — hands-off auto-signing lands with the
 * relayer upgrade — but any future read/sign path MUST go through this function so
 * the value is decrypted before use.)
 */
export async function loadSessionPrivateKey(userId: string, chain: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(sessionPkKey(userId, chain));
  } catch {
    return null;
  }
  if (!raw) return null;

  // Preferred path: value is our AES-256-GCM ciphertext blob.
  try {
    return await decryptPrivateKey(raw, pkPassphrase(userId));
  } catch {
    // Legacy plaintext migration: recognise a bare private key, re-encrypt, keep it.
    const trimmed = raw.trim();
    if (PLAINTEXT_PK_RE.test(trimmed)) {
      try {
        await storeSessionPrivateKey(userId, chain, trimmed);
      } catch {
        /* re-encrypt best-effort; still return the usable key */
      }
      return trimmed;
    }
    return null;
  }
}
