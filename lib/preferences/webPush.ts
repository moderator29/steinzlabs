'use client';

/**
 * Web Push subscription helpers.
 *
 * Phase B (profile features) — wires the Notifications API + a
 * service worker so the platform can send native push when the tab
 * is closed. Backend `push_subscriptions` table already exists; the
 * service worker file (public/push-sw.js) is registered on demand by
 * subscribe().
 *
 * VAPID public key comes from NEXT_PUBLIC_VAPID_PUBLIC_KEY. If that
 * env is missing (dev / preview deploys without VAPID configured),
 * subscribe() returns { ok: false, reason: 'missing_vapid' } so the
 * UI can render an honest "Push isn't configured on this environment"
 * state instead of a silent failure.
 */

import { supabase } from '@/lib/supabase';

export interface SubscribeResult {
  ok: boolean;
  reason?: 'unsupported' | 'denied' | 'missing_vapid' | 'service_worker_failed' | 'subscribe_failed' | 'persist_failed';
  error?: string;
}

const SW_PATH = '/push-sw.js';

/**
 * Fetch the active VAPID public key + version from the server. Falls back to
 * the build-time env so existing deploys keep working before the vapid_keys
 * table is seeded.
 */
async function fetchVapidKey(): Promise<{ publicKey: string; version: number | null }> {
  try {
    const res = await fetch('/api/push/vapid-public-key', { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { version: number | null; public_key: string };
      if (data.public_key) return { publicKey: data.public_key, version: data.version };
    }
  } catch {
    // fall through to env fallback
  }
  return { publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '', version: null };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) return null;
  return Notification.permission;
}

export async function subscribeToPush(userId: string): Promise<SubscribeResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  const { publicKey: vapidKey, version: vapidVersion } = await fetchVapidKey();
  if (!vapidKey) return { ok: false, reason: 'missing_vapid' };

  // 1. Permission prompt — user must approve.
  let permission = Notification.permission;
  if (permission !== 'granted') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  // 2. Register the service worker. push-sw.js must exist in /public.
  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register(SW_PATH);
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error('[webPush] SW register failed:', err);
    return { ok: false, reason: 'service_worker_failed', error: err instanceof Error ? err.message : 'register failed' };
  }

  // 3. Subscribe via PushManager. Reuse an existing subscription if
  // present (matches modern best practice — don't churn endpoints).
  let subscription: PushSubscription | null = null;
  try {
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
  } catch (err) {
    console.error('[webPush] subscribe failed:', err);
    return { ok: false, reason: 'subscribe_failed', error: err instanceof Error ? err.message : 'subscribe failed' };
  }

  // 4. Persist to push_subscriptions so the server can deliver.
  // Schema: endpoint, p256dh, auth, user_agent, user_id, created_at.
  const json = subscription.toJSON();
  const keys = json.keys ?? {};
  if (!supabase) return { ok: false, reason: 'persist_failed', error: 'supabase client not available' };
  try {
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh ?? '',
      auth: keys.auth ?? '',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
      vapid_key_version: vapidVersion,
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  } catch (err) {
    console.error('[webPush] persist failed:', err);
    return { ok: false, reason: 'persist_failed', error: err instanceof Error ? err.message : 'persist failed' };
  }

  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe();
      if (supabase) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    }
    return true;
  } catch (err) {
    console.error('[webPush] unsubscribe failed:', err);
    return false;
  }
}

export async function showLocalTestNotification(): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!reg) return false;
    await reg.showNotification('Naka Labs', {
      body: 'Test notification — your push setup is working.',
      icon: '/logo.png',
      badge: '/logo.png',
      tag: 'naka-test',
    });
    return true;
  } catch (err) {
    console.error('[webPush] test notification failed:', err);
    return false;
  }
}
