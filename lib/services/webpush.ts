import 'server-only';
import crypto from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Web Push service — VAPID authentication via jose (already installed).
 * ENV: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url PEM), VAPID_SUBJECT (mailto:)
 */

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:support@nakalabs.xyz';
const TIMEOUT = parseInt(process.env.API_TIMEOUT_MS || '600000');

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  actions?: Array<{ action: string; title: string }>;
  data?: Record<string, unknown>;
}

/**
 * Single-block HKDF (RFC 5869) — all Web Push derivations output <= 32 bytes,
 * so one HMAC-Expand round suffices. Returns the first `length` bytes.
 */
function hkdf(salt: Buffer, ikm: Buffer, info: Buffer, length: number): Buffer {
  const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
  const okm = crypto
    .createHmac('sha256', prk)
    .update(Buffer.concat([info, Buffer.from([0x01])]))
    .digest();
  return okm.subarray(0, length);
}

/**
 * Encrypt a Web Push payload using RFC 8291 (aes128gcm content encoding).
 * Performs ECDH P-256 against the subscription's p256dh key, derives the
 * content-encryption key + nonce via HKDF, then AES-128-GCM encrypts a single
 * record. The returned buffer is the full aes128gcm body:
 *   salt(16) | rs(4) | idlen(1) | server_public_key(65) | ciphertext | tag(16)
 */
function encryptPayload(
  plaintextJson: string,
  p256dhB64Url: string,
  authB64Url: string
): Buffer {
  const clientPublicKey = Buffer.from(p256dhB64Url, 'base64url');
  const clientAuthSecret = Buffer.from(authB64Url, 'base64url');

  const localKeys = crypto.createECDH('prime256v1');
  localKeys.generateKeys();
  const serverPublicKey = localKeys.getPublicKey(); // 65-byte uncompressed point
  const sharedSecret = localKeys.computeSecret(clientPublicKey);

  const salt = crypto.randomBytes(16);

  // RFC 8291 §3.3 — derive the input keying material from the ECDH secret.
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    clientPublicKey,
    serverPublicKey,
  ]);
  const ikm = hkdf(clientAuthSecret, sharedSecret, keyInfo, 32);

  // RFC 8188 §2.2 — content-encryption key + nonce for aes128gcm.
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);

  // Single, final record: payload followed by the 0x02 padding delimiter.
  const record = Buffer.concat([Buffer.from(plaintextJson, 'utf8'), Buffer.from([0x02])]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const recordSize = 4096;
  const header = Buffer.alloc(16 + 4 + 1 + serverPublicKey.length);
  salt.copy(header, 0);
  header.writeUInt32BE(recordSize, 16);
  header.writeUInt8(serverPublicKey.length, 20);
  serverPublicKey.copy(header, 21);

  return Buffer.concat([header, ciphertext, authTag]);
}

async function getVapidToken(audience: string): Promise<string> {
  if (!VAPID_PRIVATE) throw new Error('VAPID_PRIVATE_KEY not set');
  const privateKey = await importPKCS8(
    `-----BEGIN PRIVATE KEY-----\n${VAPID_PRIVATE}\n-----END PRIVATE KEY-----`,
    'ES256'
  );
  return new SignJWT({ sub: VAPID_SUBJECT })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setAudience(audience)
    .setExpirationTime('12h')
    .setIssuedAt()
    .sign(privateKey);
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushPayload
): Promise<{ ok: boolean; error?: string }> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return { ok: false, error: 'VAPID keys not configured' };
  }
  if (!subscription.keys?.p256dh || !subscription.keys?.auth) {
    return { ok: false, error: 'Subscription missing p256dh/auth keys' };
  }
  try {
    const { origin } = new URL(subscription.endpoint);
    const token = await getVapidToken(origin);
    // RFC 8291: the payload must be encrypted with the subscription's keys.
    const body = encryptPayload(
      JSON.stringify(payload),
      subscription.keys.p256dh,
      subscription.keys.auth
    );
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${token},k=${VAPID_PUBLIC}`,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        TTL: '86400',
      },
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok && res.status !== 201) {
      return { ok: false, error: `Push service ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Push failed' };
  }
}

export async function sendBulkWebPush(
  subscriptions: PushSubscription[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    subscriptions.map(s => sendWebPush(s, payload))
  );
  let sent = 0, failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) sent++;
    else failed++;
  }
  return { sent, failed };
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}

// ─── Supabase-aware send functions ────────────────────────────────────────────
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) are required');
  }
  _supabase = createClient(url, key);
  return _supabase;
}

/**
 * Send push to all devices registered for a given userId.
 * Automatically removes 410-Gone (unsubscribed) entries.
 * Logs delivery to push_delivery_log table.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const supabase = getSupabase();
  // Live push_subscriptions schema stores endpoint/p256dh/auth as flat columns
  // (no `subscription` blob, no `is_active`). Reconstruct the PushSubscription
  // from those columns; a 410 Gone means the browser unsubscribed, so we DELETE
  // the dead row rather than flipping a non-existent flag.
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId);

  if (!subs || subs.length === 0) return;

  for (const row of subs as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>) {
    const sub: PushSubscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
    const result = await sendWebPush(sub, payload);

    const statusMatch = result.error?.match(/(\d{3})/);
    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : result.ok ? 201 : null;
    if (!result.ok && (statusCode === 410 || statusCode === 404)) {
      await supabase.from('push_subscriptions').delete().eq('id', row.id);
    }

    // push_delivery_log live columns: user_id, subscription_id, title, status,
    // status_code, error_msg.
    await supabase.from('push_delivery_log').insert({
      user_id: userId,
      subscription_id: row.id,
      title: payload.title,
      status: result.ok ? 'sent' : 'failed',
      status_code: statusCode,
      error_msg: result.error ?? null,
    });
  }
}

/**
 * Send push to many users, batched in groups of 50.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const BATCH = 50;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const batch = userIds.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(uid => sendPushToUser(uid, payload)));
  }
}

// ─── Notification Templates ───────────────────────────────────────────────────

export function whaleTradeNotification(
  whaleName: string, action: 'bought' | 'sold', token: string, amount: string, url: string
): PushPayload {
  return {
    title: `🐋 ${whaleName} just ${action} ${token}`,
    body: `$${amount} ${action === 'bought' ? '→ entering position' : '→ exiting position'}`,
    icon: '/steinz-logo-192.png',
    url,
    tag: `whale-${whaleName}-${token}`,
    requireInteraction: false,
  };
}

export function convergenceAlertNotification(
  whaleCount: number, token: string, totalAmount: string
): PushPayload {
  return {
    title: `⚡ ${whaleCount} Whales Converging on ${token}`,
    body: `$${totalAmount} combined deployment detected`,
    icon: '/steinz-logo-192.png',
    url: '/dashboard/whale-tracker',
    tag: `convergence-${token}`,
    requireInteraction: true,
  };
}

export function priceAlertNotification(
  symbol: string, direction: 'above' | 'below', price: string
): PushPayload {
  return {
    title: `📈 ${symbol} price alert`,
    body: `${symbol} is now ${direction} $${price}`,
    icon: '/steinz-logo-192.png',
    url: '/dashboard/alerts',
    tag: `price-${symbol}-${direction}`,
  };
}

export function smartMoneySignalNotification(walletCount: number, token: string): PushPayload {
  return {
    title: `🧠 Smart Money Signal: ${token}`,
    body: `${walletCount} top wallets entered ${token} in the last 24h`,
    icon: '/steinz-logo-192.png',
    url: '/dashboard/smart-money',
    tag: `smart-money-${token}`,
    requireInteraction: false,
  };
}

export function trendAlertNotification(chain: string, metric: string, change: string): PushPayload {
  return {
    title: `📊 ${chain} Trend Alert`,
    body: `${metric} changed by ${change}`,
    icon: '/steinz-logo-192.png',
    url: '/dashboard/trends',
    tag: `trend-${chain}-${metric}`,
  };
}
