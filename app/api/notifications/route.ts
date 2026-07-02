import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { getTopTokens, getTrendingTokens } from '@/lib/services/coingecko';
import { guardRoute } from '@/lib/api/guardRoute';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export interface NotificationItem {
  id: string;
  type: 'whale' | 'price' | 'prediction' | 'trending' | 'security' | 'welcome' | 'wallet_created' | 'wallet_imported' | 'swap' | 'send' | 'system' | 'whale_alert' | 'price_target' | 'new_launch' | 'wallet_activity';
  title: string;
  message: string;
  time: string;
  read: boolean;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

let cache: { data: NotificationItem[]; ts: number } = { data: [], ts: 0 };
const CACHE_TTL = 60000;

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Deterministic per-hour bucket for market-signal ids. Embedding Date.now()
// in the id made every poll mint a "new" id, so read-state never stuck and the
// unread badge stayed permanently inflated. Bucketing by the hour keeps the id
// stable across polls while still rotating as the signal genuinely refreshes.
function currentHourBucket(): number {
  return Math.floor(Date.now() / 3_600_000);
}

async function fetchPriceAlerts(): Promise<NotificationItem[]> {
  try {
    const coins = await getTopTokens(1, 50);
    const alerts: NotificationItem[] = [];
    for (const coin of coins) {
      const change1h = coin.price_change_percentage_1h_in_currency;
      if (change1h && Math.abs(change1h) > 5) {
        const direction = change1h > 0 ? 'up' : 'down';
        const price = coin.current_price?.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) || '$0';
        alerts.push({
          id: `price-${coin.id}-${currentHourBucket()}`,
          type: 'price',
          title: 'Price Break',
          message: `${coin.name} (${coin.symbol?.toUpperCase()}) ${direction} ${Math.abs(change1h).toFixed(1)}% in 1h — now at ${price}`,
          time: timeAgo(new Date(coin.last_updated || Date.now())),
          read: false,
        });
      }
    }
    return alerts.slice(0, 5);
  } catch { return []; }
}

async function fetchTrending(): Promise<NotificationItem[]> {
  try {
    const coins = await getTrendingTokens();
    return coins.slice(0, 5).map((coin, i) => ({
      id: `trending-${coin.id}-${currentHourBucket()}`,
      type: 'trending' as const,
      title: 'Trending Token',
      message: `${coin.name} (${coin.symbol?.toUpperCase()}) is trending on CoinGecko`,
      time: timeAgo(new Date(Date.now() - i * 300000)),
      read: false,
    }));
  } catch { return []; }
}

async function fetchSecurityAlerts(): Promise<NotificationItem[]> {
  try {
    const coins = await getTopTokens(1, 30);
    const alerts: NotificationItem[] = [];
    for (const coin of coins) {
      const change1h = coin.price_change_percentage_1h_in_currency;
      if (change1h && change1h < -10) {
        alerts.push({
          id: `security-${coin.id}-${currentHourBucket()}`,
          type: 'security',
          // Market-movement signal, not a per-user security alert: this is a
          // sharp 1h price drop across the market, honestly labelled as such.
          title: 'Sharp Price Drop',
          message: `${coin.name} (${coin.symbol?.toUpperCase()}) dropped ${Math.abs(change1h).toFixed(1)}% in the last 1h`,
          time: timeAgo(new Date(coin.last_updated || Date.now())),
          read: false,
        });
      }
    }
    if (alerts.length === 0) {
      const suspicious = coins.filter(c => (c.total_volume || 0) / (c.market_cap || 1) > 2);
      for (const coin of suspicious.slice(0, 2)) {
        alerts.push({
          id: `security-vol-${coin.id}-${currentHourBucket()}`,
          type: 'security',
          title: 'High Volume-to-MCap',
          message: `${coin.name} (${coin.symbol?.toUpperCase()}) has an unusually high 24h volume-to-market-cap ratio`,
          time: timeAgo(new Date(coin.last_updated || Date.now())),
          read: false,
        });
      }
    }
    return alerts.slice(0, 3);
  } catch { return []; }
}

async function fetchWhaleAlerts(): Promise<NotificationItem[]> {
  try {
    const coins = await getTopTokens(1, 10);
    return coins.slice(0, 3).map((coin, i) => {
      const vol = coin.total_volume || 0;
      const volStr = vol >= 1e9 ? `$${(vol / 1e9).toFixed(1)}B` : `$${(vol / 1e6).toFixed(0)}M`;
      return {
        // Market-movement signal, not a per-user whale alert: this is the
        // token's aggregate 24h trading volume, honestly labelled.
        id: `whale-${coin.id}-${currentHourBucket()}`,
        type: 'whale' as const,
        title: 'High Trading Volume',
        message: `${coin.name} 24h trading volume at ${volStr}`,
        time: timeAgo(new Date(Date.now() - i * 600000)),
        read: false,
      };
    });
  } catch { return []; }
}

async function fetchSupabaseNotifications(userId?: string): Promise<NotificationItem[]> {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) return [];
    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    let query = adminClient
      .from('notifications')
      .select('id, type, title, body, read, created_at, metadata, url')
      .order('created_at', { ascending: false })
      .limit(50);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: Record<string, unknown>) => ({
      id: `sb-${row.id}`,
      type: row.type as NotificationItem['type'],
      title: String(row.title),
      message: String(row.body),
      time: timeAgo(new Date(String(row.created_at || Date.now()))),
      read: (row.read as boolean) ?? false,
      createdAt: String(row.created_at),
      href: (row.url as string) || undefined,
      metadata: (row.metadata as Record<string, unknown>) || {},
    }));
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  try {
    // Security (IDOR fix): derive the user from the authenticated session.
    // Previously this trusted a client-supplied ?userId and read it back with
    // the service role, so anyone could enumerate any user's notifications.
    const guard = await guardRoute(req, { rate: 'med', allowAnon: true });
    if (!guard.ok) return guard.response;
    const userId = guard.user?.id;
    let supabaseNotifications: NotificationItem[] = [];
    if (userId) supabaseNotifications = await fetchSupabaseNotifications(userId);

    if (Date.now() - cache.ts < CACHE_TTL && cache.data.length > 0) {
      const merged = supabaseNotifications.length > 0
        ? [...supabaseNotifications, ...cache.data].slice(0, 50)
        : cache.data;
      return NextResponse.json({ notifications: merged, source: supabaseNotifications.length > 0 ? 'supabase+market' : 'cache' }, {
        // Per-user data must never sit in a shared cache.
        headers: { 'Cache-Control': supabaseNotifications.length > 0 ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }

    const [priceAlerts, trending, securityAlerts, whaleAlerts] = await Promise.all([
      fetchPriceAlerts(), fetchTrending(), fetchSecurityAlerts(), fetchWhaleAlerts(),
    ]);

    const marketNotifications: NotificationItem[] = [];
    const interleaved = [priceAlerts, securityAlerts, whaleAlerts, trending];
    const maxLen = Math.max(...interleaved.map(a => a.length));
    for (let i = 0; i < maxLen; i++) {
      for (const arr of interleaved) { if (i < arr.length) marketNotifications.push(arr[i]); }
    }

    cache = { data: marketNotifications, ts: Date.now() };
    const notifications = supabaseNotifications.length > 0
      ? [...supabaseNotifications, ...marketNotifications].slice(0, 50)
      : marketNotifications;

    return NextResponse.json({ notifications, source: supabaseNotifications.length > 0 ? 'supabase+market' : 'market' }, {
      headers: { 'Cache-Control': supabaseNotifications.length > 0 ? 'private, no-store' : 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ notifications: [], error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Per-user 100/60s cap — bot accounts were able to spam push/email/telegram
  // when calling this endpoint without throttling.
  const guard = await guardRoute(req, { rate: 'med', allowAnon: true });
  if (!guard.ok) return guard.response;
  try {
    const body = await req.json();
    const { type, metadata, eventId } = body;
    // Security (#40): never trust a client-supplied user_id. A public caller may
    // only write a notification to its OWN session user; a trusted server caller
    // (cron/webhook fanout) authenticates with the CRON_SECRET bearer and may
    // target an explicit userId. Anonymous callers are rejected — previously
    // anyone could inject a fully-crafted notification into any user's feed.
    const internalSecret = process.env.CRON_SECRET;
    const authz = req.headers.get('authorization') || '';
    const isInternal = !!internalSecret && authz === `Bearer ${internalSecret}`;
    let targetUserId: string | null;
    if (isInternal) {
      targetUserId = body.userId || null;
    } else {
      const sessionUser = await getAuthenticatedUser(req);
      if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      targetUserId = sessionUser.id;
    }
    // Clamp attacker-influenced strings so a crafted payload can't bloat the row.
    const title = typeof body.title === 'string' ? body.title.slice(0, 200) : '';
    const message = typeof body.message === 'string' ? body.message.slice(0, 1000) : '';
    if (!type || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields: type, title, message' }, { status: 400 });
    }
    const now = new Date().toISOString();
    const notification: NotificationItem = {
      id: `user-${type}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      type, title, message, time: 'Just now', read: false, createdAt: now, metadata: metadata || {},
    };
    let supabaseId: string | null = null;
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
      if (serviceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const adminClient = createClient('https://phvewrldcdxupsnakddx.supabase.co', serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
        // Idempotency: if caller passes an eventId, fold it into metadata.event_id
        // and skip insert when the same (user_id, event_id) has been seen in the
        // last hour. Prevents duplicate push/email/telegram fanout on retry.
        if (eventId && targetUserId) {
          const sinceIso = new Date(Date.now() - 3_600_000).toISOString();
          const { data: existing } = await adminClient
            .from('notifications')
            .select('id')
            .eq('user_id', targetUserId)
            .gte('created_at', sinceIso)
            .contains('metadata', { event_id: String(eventId) })
            .limit(1);
          if (existing && existing.length > 0) {
            return NextResponse.json({ notification, deduped: true, event_id: eventId });
          }
        }
        const persistedMetadata = eventId ? { ...(metadata || {}), event_id: String(eventId) } : metadata || {};
        const { data, error } = await adminClient.from('notifications')
          .insert([{ user_id: targetUserId, type, title, body: message, read: false, created_at: now, metadata: persistedMetadata }])
          .select('id').single();
        if (!error && data) { supabaseId = data.id; notification.id = `sb-${data.id}`; }
      }
    } catch (err) {
      Sentry.captureException(err, { tags: { route: 'notifications', stage: 'persist' } });
    }
    // Fan-out (email + Telegram) is keyed strictly off the server-derived
    // targetUserId — NEVER the raw client body.userId or a client-supplied
    // userEmail. Trusting client fields here let a caller redirect another
    // user's alert to an attacker-controlled address (cross-account vector).
    if (targetUserId) {
      const emailAlertTypes = ['whale_alert', 'price_target'];
      if (emailAlertTypes.includes(type)) {
        try {
          const admin = getSupabaseAdmin();
          // Respect the user's email opt-out (notification_settings.email_enabled;
          // absent row = default on) — otherwise every qualifying insert
          // emails the user regardless of their preferences.
          const { data: prefRow } = await admin
            .from('notification_settings')
            .select('email_enabled')
            .eq('user_id', targetUserId)
            .maybeSingle();
          const emailOptedOut = prefRow?.email_enabled === false;
          // Recipient email is resolved from auth.users for the target user —
          // profiles has no email column — so it can't be spoofed by the body.
          const recipientEmail = emailOptedOut
            ? null
            : (await admin.auth.admin.getUserById(targetUserId)).data?.user?.email ?? null;
          if (recipientEmail) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
            fetch(`${baseUrl}/api/send-notification-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // Internal-only relay — the email route rejects calls without
                // this secret so it can't be abused as an open mailer.
                ...(process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
              },
              body: JSON.stringify({ title, message, type, userEmail: recipientEmail }),
            }).catch(() => {});
          }
        } catch (err) {
          Sentry.captureException(err, { tags: { route: 'notifications', stage: 'email-fanout' } });
        }
      }

      // Outbound Telegram push — runs fire-and-forget so notification
      // creation latency isn't tied to Telegram's response.
      try {
        const { queueTelegramNotification } = await import('@/lib/telegram/notify');
        const kindMap: Record<string, 'price' | 'whale' | 'security' | 'alert' | 'sniper' | 'copy' | 'general'> = {
          whale: 'whale', whale_alert: 'whale', wallet_activity: 'whale',
          price: 'price', price_target: 'price', trending: 'price',
          security: 'security',
          new_launch: 'sniper',
          swap: 'alert', send: 'alert', wallet_created: 'general', wallet_imported: 'general',
          welcome: 'general', system: 'general', prediction: 'general',
        };
        queueTelegramNotification({
          userId: targetUserId,
          kind: kindMap[type] ?? 'general',
          title,
          body: message,
        });
      } catch (err) {
        Sentry.captureException(err, { tags: { route: 'notifications', stage: 'telegram-fanout' } });
      }
    }

    return NextResponse.json({ notification, supabaseId });
  } catch {
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
