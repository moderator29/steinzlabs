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

export async function fetchPeerPublicKey(peerId: string): Promise<string> {
  const res = await fetch(`/api/social/keypair?user_id=${peerId}`);
  if (!res.ok) throw new Error('Peer has not enabled encrypted DM yet');
  const json = await res.json();
  return json.public_key as string;
}
