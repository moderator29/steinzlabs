import 'server-only';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Web Push service — VAPID authentication via jose (already installed).
 * ENV: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url PEM), VAPID_SUBJECT (mailto:)
 */

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:support@steinzlabs.com';
const TIMEOUT = parseInt(process.env.API_TIMEOUT_MS || '600000');

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
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
  try {
    const { origin } = new URL(subscription.endpoint);
    const token = await getVapidToken(origin);
    const body = JSON.stringify(payload);
    const res = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${token},k=${VAPID_PUBLIC}`,
        'Content-Type': 'application/json',
        'Content-Encoding': 'aesgcm',
        TTL: '86400',
      },
      body,
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
