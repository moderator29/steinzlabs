/**
 * Wallet at-rest encryption — AES-256-GCM with PBKDF2-derived keys.
 *
 * Lifted from app/dashboard/wallet-page/page.tsx so the UnlockWallet
 * flow can verify the user's password by attempting decryption against
 * the same stored payload format. Without this shared helper, every
 * place that needs to verify a wallet password had to duplicate the
 * Web Crypto invocation, drifting on parameters and creating subtle
 * correctness bugs.
 *
 * Format (v2):
 *   { v: 2, data: base64(ciphertext), iv: base64(iv12), salt: base64(salt16) }
 *
 * v1 (legacy XOR) was removed by the §1 audit because XOR with a
 * password keystream is trivially broken under known-plaintext
 * recovery — affected wallets must be re-imported from the seed phrase
 * to upgrade their at-rest format. decryptPrivateKey throws a clear
 * error explaining this when v !== 2.
 */

interface EncryptedPayload {
  v?: number;
  data: string;
  iv: string;
  salt: string;
}

async function deriveAesKey(password: string, salt: Uint8Array, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

export async function encryptPrivateKey(plaintext: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt, 'encrypt');
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  return JSON.stringify({
    v: 2,
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  });
}

export async function decryptPrivateKey(encoded: string, password: string): Promise<string> {
  let parsed: EncryptedPayload;
  try {
    parsed = JSON.parse(encoded);
    if (parsed.v !== 2) throw new Error('Unsupported encryption version');
  } catch {
    throw new Error(
      'This wallet uses an outdated encryption format. Please re-import the seed phrase to upgrade to AES-256-GCM.',
    );
  }
  const salt = Uint8Array.from(atob(parsed.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(parsed.data), (c) => c.charCodeAt(0));
  const key = await deriveAesKey(password, salt, 'decrypt');
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * Validate-only check: returns true iff the password successfully
 * decrypts the encrypted payload. Used by UnlockWalletModal to verify
 * a typed password before caching it via setWalletSessionKey, so we
 * never persist a wrong password into session and silently fail every
 * subsequent signing attempt.
 */
export async function verifyWalletPassword(encoded: string, password: string): Promise<boolean> {
  try {
    await decryptPrivateKey(encoded, password);
    return true;
  } catch {
    return false;
  }
}
