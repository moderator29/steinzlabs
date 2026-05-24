import 'server-only';
import { createHmac, randomBytes } from 'crypto';

/**
 * Minimal RFC 6238 TOTP implementation using Node crypto only.
 * No otplib / speakeasy dependency — the algorithm is small and the
 * server cost of carrying another package isn't justified by what
 * we need.
 *
 * Encoding: base32 (RFC 4648, no padding) so the generated secret is
 * directly compatible with Google Authenticator / Authy / 1Password.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(length = 20): string {
  // 20 bytes = 160 bits of entropy = 32 base32 chars.
  const bytes = randomBytes(length);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    if (chunk.length < 5) break;
    out += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  let bits = '';
  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character in TOTP secret');
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(key: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    buf[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 10 ** digits).toString().padStart(digits, '0');
}

/** Returns the 6-digit TOTP for the current 30s window. */
export function totp(secret: string, atMs: number = Date.now()): string {
  const counter = Math.floor(atMs / 1000 / 30);
  return hotp(base32Decode(secret), counter);
}

/**
 * Verify a user-supplied 6-digit code against `secret`. We accept the
 * current window plus ±1 (90s total) to tolerate clock skew, which is
 * the standard Google Authenticator recommendation.
 */
export function verifyTotp(secret: string, code: string, atMs: number = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const counter = Math.floor(atMs / 1000 / 30);
  const key = base32Decode(secret);
  for (const window of [-1, 0, 1]) {
    if (hotp(key, counter + window) === code) return true;
  }
  return false;
}

/**
 * Build a otpauth:// URI for QR-code rendering on the enroll page.
 * Apps (Google Authenticator etc) scan this and ingest the secret.
 */
export function otpauthUri(issuer: string, account: string, secret: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
