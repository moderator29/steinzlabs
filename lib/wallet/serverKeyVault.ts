import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Server-side AES-256-GCM vault for the LIMITED session-key private keys (#41).
 *
 * This is the only place the platform persists signing-key material, and it is
 * never a MAIN wallet key — only a capped, expiring, revocable ZeroDev session
 * key (see lib/wallet/sessionKeyAA.ts). Encrypted at rest with a key derived
 * from SESSION_KEY_ENCRYPTION_SECRET so a DB leak alone can't sign anything.
 *
 * Format: v1:<base64 iv>:<base64 authTag>:<base64 ciphertext>.
 */

function getKey(): Buffer {
  const secret = process.env.SESSION_KEY_ENCRYPTION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_KEY_ENCRYPTION_SECRET is not set (min 16 chars) — AA session keys disabled.');
  }
  // Derive a fixed 32-byte key from the secret. sha256 is deterministic and
  // adequate here because the secret is high-entropy server config, not a
  // user password (no need for a slow KDF / per-record salt).
  return createHash('sha256').update(secret).digest();
}

/** True when the vault can operate (secret configured). */
export function vaultConfigured(): boolean {
  const s = process.env.SESSION_KEY_ENCRYPTION_SECRET;
  return !!s && s.length >= 16;
}

export function encryptServerSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptServerSecret(encoded: string): string {
  const parts = encoded.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Malformed encrypted secret');
  const key = getKey();
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
