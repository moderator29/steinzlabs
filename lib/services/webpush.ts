import 'server-only';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Web Push service — VAPID authentication via jose (already installed).
 * ENV: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (base64url PEM), VAPID_SUBJECT (mailto:)
 */

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:support@nakalabs.com';
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
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, subscription')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!subs || subs.length === 0) return;

  for (const row of subs) {
    const sub = row.subscription as PushSubscription;
    const result = await sendWebPush(sub, payload);

    if (!result.ok && result.error?.includes('410')) {
      await supabase.from('push_subscriptions').update({ is_active: false }).eq('id', row.id);
    }

    await supabase.from('push_delivery_log').insert({
      user_id: userId,
      notification_type: payload.tag ?? 'general',
      payload,
      delivered: result.ok,
      error: result.error ?? null,
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
