'use client';

import { getWalletSessionKey } from './walletSession';
import { supabase } from '@/lib/supabase';

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

export async function migrateWalletToSupabase(userId: string): Promise<void> {
  const oldWallet = localStorage.getItem('steinz_wallets');
  if (!oldWallet) return;

  const sessionKey = getWalletSessionKey();
  if (!sessionKey) return;

  try {
    const encrypted = await encryptWithAES256GCM(oldWallet, sessionKey);
    const { error } = await supabase.from('user_wallets').upsert({
      user_id: userId,
      encrypted_data: encrypted.data,
      iv: encrypted.iv,
      salt: encrypted.salt,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      localStorage.removeItem('steinz_wallets');
      localStorage.removeItem('steinz_default_wallet');
    }
  } catch (err) {
    console.error('[wallet-storage] Migration failed:', err instanceof Error ? err.message : err);
  }
}

export async function loadWalletsFromSupabase(userId: string): Promise<string | null> {
  const sessionKey = getWalletSessionKey();
  if (!sessionKey) return null;

  const { data, error } = await supabase
    .from('user_wallets')
    .select('encrypted_data, iv, salt')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;

  try {
    return await decryptWithAES256GCM({
      data: data.encrypted_data,
      iv: data.iv,
      salt: data.salt,
    }, sessionKey);
  } catch (err) {
    console.error('[wallet-storage] Decryption failed:', err instanceof Error ? err.message : err);
    return null;
  }
}
