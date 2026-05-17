'use client';

/**
 * Steinz Labs social-DM end-to-end encryption (libsodium).
 *
 * Threat model: even if the database is compromised, an attacker
 * with full read access to dm_conversations + dm_messages cannot
 * decrypt message content. Server never sees the conversation key
 * in cleartext.
 *
 * Architecture:
 *   - Each user has a libsodium box-curve25519 keypair. Public key
 *     lives in profiles.public_key (base64). Private key is wrapped
 *     with a session-derived secret (the user's Supabase JWT, hashed
 *     with crypto.subtle) and stored in profiles.encrypted_private_key.
 *   - Per-conversation symmetric key (libsodium secretbox) is sealed
 *     to each participant's box public key and stored in
 *     dm_conversations.conversation_key_a / _b. Either side can
 *     unseal it with their own box private key.
 *   - Every message body is encrypted with the conversation key
 *     using secretbox_easy + a fresh nonce (stored as `iv`).
 *
 * Forward secrecy: rotate the conversation key by inserting a system
 * message with `{ rotate: <new_sealed_keys> }` and updating the
 * conversation row. Not implemented in v1 — backlog.
 */

import sodium from 'libsodium-wrappers';

let ready = false;

async function ensureReady(): Promise<void> {
  if (ready) return;
  await sodium.ready;
  ready = true;
}

const enc = (s: string) => sodium.from_string(s);
const dec = (b: Uint8Array) => sodium.to_string(b);
const b64 = (b: Uint8Array) => sodium.to_base64(b, sodium.base64_variants.ORIGINAL);
const fromB64 = (s: string) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

export interface UserKeyPair {
  publicKey: string;
  privateKey: string;
}

/** Generate a new libsodium box keypair (base64-encoded). */
export async function generateUserKeyPair(): Promise<UserKeyPair> {
  await ensureReady();
  const kp = sodium.crypto_box_keypair();
  return { publicKey: b64(kp.publicKey), privateKey: b64(kp.privateKey) };
}

/**
 * Derive a 32-byte secret from the user's Supabase access token.
 * Used to wrap the libsodium private key before storing it on the
 * server, so a database leak doesn't expose private keys.
 */
async function deriveWrapSecret(accessToken: string): Promise<Uint8Array> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('SubtleCrypto unavailable; cannot derive wrap key');
  }
  // Copy into a freshly-allocated ArrayBuffer so the TS lib's strict
  // BufferSource type (ArrayBufferLike != ArrayBuffer in newer libs)
  // accepts it across all bundler targets.
  const bytes = enc(accessToken);
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(hash);
}

/** Wrap a base64 private key with the access-token-derived secret. */
export async function wrapPrivateKey(privateKeyB64: string, accessToken: string): Promise<string> {
  await ensureReady();
  const key = await deriveWrapSecret(accessToken);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ct = sodium.crypto_secretbox_easy(fromB64(privateKeyB64), nonce, key);
  return `${b64(nonce)}.${b64(ct)}`;
}

/** Unwrap a previously-wrapped private key. */
export async function unwrapPrivateKey(wrapped: string, accessToken: string): Promise<string> {
  await ensureReady();
  const [nonceB64, ctB64] = wrapped.split('.');
  if (!nonceB64 || !ctB64) throw new Error('Malformed wrapped private key');
  const key = await deriveWrapSecret(accessToken);
  const pt = sodium.crypto_secretbox_open_easy(fromB64(ctB64), fromB64(nonceB64), key);
  return b64(pt);
}

/** Generate a fresh conversation symmetric key. */
export async function generateConversationKey(): Promise<Uint8Array> {
  await ensureReady();
  return sodium.crypto_secretbox_keygen();
}

/** Seal a conversation key to a recipient's box public key. Server cannot read this. */
export async function sealConversationKey(conversationKey: Uint8Array, recipientPublicKeyB64: string): Promise<string> {
  await ensureReady();
  const sealed = sodium.crypto_box_seal(conversationKey, fromB64(recipientPublicKeyB64));
  return b64(sealed);
}

/** Open a sealed conversation key with your own box keypair. */
export async function openConversationKey(sealedB64: string, myPublicKeyB64: string, myPrivateKeyB64: string): Promise<Uint8Array> {
  await ensureReady();
  return sodium.crypto_box_seal_open(fromB64(sealedB64), fromB64(myPublicKeyB64), fromB64(myPrivateKeyB64));
}

export interface EncryptedMessage {
  encrypted_content: string;
  iv: string;
}

export async function encryptMessage(plaintext: string, conversationKey: Uint8Array): Promise<EncryptedMessage> {
  await ensureReady();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ct = sodium.crypto_secretbox_easy(enc(plaintext), nonce, conversationKey);
  return { encrypted_content: b64(ct), iv: b64(nonce) };
}

export async function decryptMessage(msg: EncryptedMessage, conversationKey: Uint8Array): Promise<string> {
  await ensureReady();
  const pt = sodium.crypto_secretbox_open_easy(fromB64(msg.encrypted_content), fromB64(msg.iv), conversationKey);
  return dec(pt);
}
