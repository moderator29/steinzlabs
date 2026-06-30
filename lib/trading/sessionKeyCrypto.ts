import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption for delegated session-key private keys
 * (24/7 non-custodial auto-copy — see docs/design/2026-06-28-session-key-auto-copy.md).
 *
 * The session EOA private key arrives over TLS, is encrypted here at rest, and is
 * only ever decrypted transiently in server memory at sign time. The encryption
 * secret lives in SESSION_KEY_ENCRYPTION_SECRET (env / KMS) — NEVER in the DB —
 * so DB exfiltration alone cannot recover a key. This protects a SCOPED session
 * key, never the main wallet (whose key never leaves the browser).
 *
 * Ciphertext format: v1:<base64 iv>:<base64 authTag>:<base64 ciphertext>
 */

const VERSION = 'v1';

function getKey(): Buffer {
  const secret = process.env.SESSION_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    // Fail closed: never silently encrypt with a weak/empty key.
    throw new Error('SESSION_KEY_ENCRYPTION_SECRET is missing or too short (>=16 chars required)');
  }
  // Derive a stable 32-byte key from a high-entropy secret. SHA-256 is a sound
  // KDF here because the input is a long random secret, not a user password.
  return createHash('sha256').update(secret, 'utf8').digest();
}

/** Encrypt a session private key for at-rest storage. Returns the v1 blob. */
export function encryptSessionKey(plaintext: string): string {
  if (!plaintext) throw new Error('cannot encrypt empty key');
  const key = getKey();
  const iv = randomBytes(12); // 96-bit nonce, GCM standard
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/**
 * Decrypt a v1 blob back to the session private key. Throws on a tampered blob
 * (GCM auth-tag mismatch) or wrong/rotated secret. Callers must zero the result
 * after use.
 */
export function decryptSessionKey(blob: string): string {
  const parts = blob.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('unrecognized session-key ciphertext format');
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

/** True when a server-side signer secret is configured (gates 24/7 storage). */
export function sessionKeyEncryptionAvailable(): boolean {
  const secret = process.env.SESSION_KEY_ENCRYPTION_SECRET;
  return !!secret && secret.length >= 16;
}
