import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getTopTokens, getTrendingTokens } from '@/lib/services/coingecko';

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

async function fetchPriceAlerts(): Promise<NotificationItem[]> {
  try {
    const coins = await getTopTokens(1, 50);
    const alerts: NotificationItem[] = [];
    for (const coin of coins) {
      const change1h = coin.price_change_percentage_1h_in_currency;
      if (change1h && Math.abs(change1h) > 5) {
        const direction = change1h > 0 ? 'up' : 'down';
        const price = coin.current_price?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0';
        alerts.push({
          id: `price-${coin.id}-${Date.now()}`,
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
      id: `trending-${coin.id}-${Date.now()}-${i}`,
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
          id: `security-${coin.id}-${Date.now()}`,
          type: 'security',
          title: 'Security Alert',
          message: `${coin.name} (${coin.symbol?.toUpperCase()}) crashed ${Math.abs(change1h).toFixed(1)}% in 1h — potential risk event`,
          time: timeAgo(new Date(coin.last_updated || Date.now())),
          read: false,
        });
      }
    }
    if (alerts.length === 0) {
      const suspicious = coins.filter(c => (c.total_volume || 0) / (c.market_cap || 1) > 2);
      for (const coin of suspicious.slice(0, 2)) {
        alerts.push({
          id: `security-vol-${coin.id}-${Date.now()}`,
          type: 'security',
          title: 'Security Alert',
          message: `${coin.name} (${coin.symbol?.toUpperCase()}) has unusually high volume-to-mcap ratio — monitor closely`,
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
        id: `whale-${coin.id}-${Date.now()}-${i}`,
        type: 'whale' as const,
        title: 'Whale Alert',
        message: `${coin.name} 24h volume at ${volStr} — large institutional activity detected`,
        time: timeAgo(new Date(Date.now() - i * 600000)),
        read: false,
      };
    });
  } catch { return []; }
}

async function fetchSupabaseNotifications(userId?: string): Promise<NotificationItem[]> {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;
    if (!serviceKey) return [];
    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(
      'https://phvewrldcdxupsnakddx.supabase.co',
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    let query = adminClient
      .from('notifications')
      .select('id, type, title, message, read, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(50);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map((row: Record<string, unknown>) => ({
      id: `sb-${row.id}`,
      type: row.type as NotificationItem['type'],
      title: String(row.title),
      message: String(row.message),
      time: timeAgo(new Date(String(row.created_at || Date.now()))),
      read: (row.read as boolean) ?? false,
      createdAt: String(row.created_at),
      metadata: (row.metadata as Record<string, unknown>) || {},
    }));
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;
    let supabaseNotifications: NotificationItem[] = [];
    if (userId) supabaseNotifications = await fetchSupabaseNotifications(userId);

    if (Date.now() - cache.ts < CACHE_TTL && cache.data.length > 0) {
      const merged = supabaseNotifications.length > 0
        ? [...supabaseNotifications, ...cache.data].slice(0, 50)
        : cache.data;
      return NextResponse.json({ notifications: merged, source: supabaseNotifications.length > 0 ? 'supabase+market' : 'cache' }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
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
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch {
    return NextResponse.json({ notifications: [], error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, title, message, metadata, userEmail } = body;
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
      const serviceKey = process.env.SUPABASE_SERVICE_KEY;
      if (serviceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const adminClient = createClient('https://phvewrldcdxupsnakddx.supabase.co', serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const { data, error } = await adminClient.from('notifications')
          .insert([{ user_id: body.userId || null, type, title, message, read: false, created_at: now, metadata: metadata || {} }])
          .select('id').single();
        if (!error && data) { supabaseId = data.id; notification.id = `sb-${data.id}`; }
      }
    } catch {}
    const emailAlertTypes = ['whale_alert', 'price_target'];
    if (emailAlertTypes.includes(type) && userEmail) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      fetch(`${baseUrl}/api/send-notification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message, type, userEmail }),
      }).catch(() => {});
    }
    return NextResponse.json({ notification, supabaseId });
  } catch {
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
