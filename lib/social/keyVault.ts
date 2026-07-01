'use client';

import { generateUserKeyPair, wrapPrivateKey, unwrapPrivateKey } from './encryption';
import { supabase } from '@/lib/supabase';

/**
 * Client-side keypair vault. Lazily ensures the current user has a
 * published libsodium box keypair the first time the DM feature is
 * used. The unwrapped private key is cached on `window` so subsequent
 * decrypts in the same session don't pay the SubtleCrypto cost.
 *
 * The wrap secret is derived from the user's Supabase access token —
 * if they sign out and back in with a new token, the wrap blob still
 * decrypts because the token's `sub`+`aud` claims (and thus the SHA
 * derivation input) match. If the user rotates session entirely (new
 * refresh), the SHA derivation changes and the client regenerates a
 * new keypair, which means historical DM conversation keys become
 * undecryptable — same property as Signal's "lost device" state.
 */

interface UnwrappedKeys {
  publicKey: string;
  privateKey: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __NAKA_SOCIAL_KEYS__: UnwrappedKeys | undefined;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function ensureKeyVault(): Promise<UnwrappedKeys> {
  if (typeof window !== 'undefined' && globalThis.__NAKA_SOCIAL_KEYS__) {
    return globalThis.__NAKA_SOCIAL_KEYS__;
  }
  const token = await getAccessToken();
  if (!token) throw new Error('Sign in required for encrypted DM');

  const fetched = await fetch('/api/social/keypair');
  if (!fetched.ok) throw new Error('Could not load key vault');
  const existing = await fetched.json();

  const publicKey = existing.public_key as string | null;
  const encryptedPrivate = existing.encrypted_private_key as string | null;

  if (!publicKey || !encryptedPrivate) {
    const kp = await generateUserKeyPair();
    const wrapped = await wrapPrivateKey(kp.privateKey, token);
    const upload = await fetch('/api/social/keypair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_key: kp.publicKey, encrypted_private_key: wrapped }),
    });
    if (!upload.ok) throw new Error('Could not publish key');
    globalThis.__NAKA_SOCIAL_KEYS__ = { publicKey: kp.publicKey, privateKey: kp.privateKey };
    return { publicKey: kp.publicKey, privateKey: kp.privateKey };
  }

  const privateKey = await unwrapPrivateKey(encryptedPrivate, token);
  globalThis.__NAKA_SOCIAL_KEYS__ = { publicKey, privateKey };
  return { publicKey, privateKey };
}

/**
 * Result of resolving a peer's public key with trust-on-first-use pinning.
 *  - `publicKey` is the key just returned by the server (always the current one).
 *  - `changed` is true when a DIFFERENT key was previously pinned for this peer
 *    — a signal the server-mediated key distribution may be compromised (MITM)
 *    or the peer legitimately reset their keypair. The UI surfaces this rather
 *    than silently trusting the new key.
 *  - `previousKey` is the key we had pinned before, present only when changed.
 */
export interface PeerKeyResult {
  publicKey: string;
  changed: boolean;
  previousKey?: string;
}

/** localStorage key under which we pin the first-seen public key for a peer. */
function pinStorageKey(peerId: string): string {
  return `naka:dm:peerkey:${peerId}`;
}

/**
 * Fetch a peer's published box public key and apply trust-on-first-use pinning.
 *
 * The server hands back the peer's public key, so it is technically able to
 * substitute its own (a MITM on key distribution). TOFU pinning defends against
 * a silent swap: the FIRST key we see for a peer is persisted in localStorage,
 * and every later fetch is compared against it. If the server ever returns a
 * different key we do NOT overwrite the pin — we flag `changed` so the caller
 * can warn the user instead of blindly sealing to a possibly-attacker key.
 */
export async function fetchPeerPublicKey(peerId: string): Promise<PeerKeyResult> {
  const res = await fetch(`/api/social/keypair?user_id=${peerId}`);
  if (!res.ok) throw new Error('Peer has not enabled encrypted DM yet');
  const json = await res.json();
  const publicKey = json.public_key as string;
  if (!publicKey) throw new Error('Peer has not enabled encrypted DM yet');

  if (typeof window === 'undefined') {
    // No persistent store (SSR / non-browser) — cannot pin, so cannot claim
    // the key is verified. Report it as-is without a false "unchanged".
    return { publicKey, changed: false };
  }

  let pinned: string | null = null;
  try {
    pinned = window.localStorage.getItem(pinStorageKey(peerId));
  } catch {
    // localStorage unavailable (private mode / blocked) — degrade gracefully.
    return { publicKey, changed: false };
  }

  if (!pinned) {
    // First contact — trust and pin. Exact-match string compare only; these are
    // base64 crypto keys, not wallet addresses, so no case normalization.
    try {
      window.localStorage.setItem(pinStorageKey(peerId), publicKey);
    } catch {
      // Best-effort pin; a failed write just means we can't detect future swaps.
    }
    return { publicKey, changed: false };
  }

  if (pinned !== publicKey) {
    // The server returned a key that differs from the one we first pinned. Do
    // NOT overwrite the pin — surface the change so the UI can warn the user.
    return { publicKey, changed: true, previousKey: pinned };
  }

  return { publicKey, changed: false };
}
