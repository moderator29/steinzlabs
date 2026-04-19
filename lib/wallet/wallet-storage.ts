'use client';

// AES-256-GCM helpers used by the wallet creation/import flow.
//
// NOTE: the former `migrateWalletToSupabase` + `loadWalletsFromSupabase`
// helpers were removed — they wiped localStorage after a cloud write and
// used a non-stable session-derived key, which is the disappearing-wallets
// failure mode we root-caused. Persistence now flows through
// /api/wallet/sync (see app/api/wallet/sync/route.ts) which is dual-read
// (local + cloud union, never shrinks) and tolerant of session rotation.

export interface EncryptedWalletData {
  data: string;
  iv: string;
  salt: string;
}

export async function encryptWithAES256GCM(data: string, password: string): Promise<EncryptedWalletData> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(data));
  return {
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

export async function decryptWithAES256GCM(encrypted: EncryptedWalletData, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  const salt = Uint8Array.from(atob(encrypted.salt), c => c.charCodeAt(0));
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
  const data = Uint8Array.from(atob(encrypted.data), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

