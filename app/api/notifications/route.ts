import { NextRequest, NextResponse } from 'next/server';

const COINGECKO_KEY = process.env.COINGECKO_API_KEY;

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
    const headers: Record<string, string> = {};
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=1h',
      { headers }
    );
    if (!res.ok) return [];
    const coins = await res.json();
    if (!Array.isArray(coins)) return [];

    const alerts: NotificationItem[] = [];
    for (const coin of coins) {
      const change1h = coin.price_change_percentage_1h_in_currency;
      if (change1h && Math.abs(change1h) > 5) {
        const direction = change1h > 0 ? 'up' : 'down';
        const emoji = change1h > 0 ? '📈' : '📉';
        const price = coin.current_price?.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) || '$0';
        alerts.push({
          id: `price-${coin.id}-${Date.now()}`,
          type: 'price',
          title: 'Price Break',
          message: `${emoji} ${coin.name} (${coin.symbol?.toUpperCase()}) ${direction} ${Math.abs(change1h).toFixed(1)}% in 1h — now at ${price}`,
          time: timeAgo(new Date(coin.last_updated || Date.now())),
          read: false,
        });
      }
    }
    return alerts.slice(0, 5);
  } catch (error) {
    console.error('Price alerts fetch error:', error);
    return [];
  }
}

async function fetchTrending(): Promise<NotificationItem[]> {
  try {
    const headers: Record<string, string> = {};
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;
    const res = await fetch('https://api.coingecko.com/api/v3/search/trending', { headers });
    if (!res.ok) return [];
    const data = await res.json();
    const coins = data?.coins || [];

    return coins.slice(0, 5).map((item: any, i: number) => {
      const coin = item.item;
      const mcRank = coin.market_cap_rank ? `#${coin.market_cap_rank}` : '';
      const priceChange = coin.data?.price_change_percentage_24h;
      const changeStr = priceChange ? ` (${priceChange > 0 ? '+' : ''}${priceChange.toFixed(1)}% 24h)` : '';
      return {
        id: `trending-${coin.id}-${Date.now()}-${i}`,
        type: 'trending' as const,
        title: 'Trending Token',
        message: `🔥 ${coin.name} (${coin.symbol?.toUpperCase()}) is trending on CoinGecko ${mcRank}${changeStr}`,
        time: timeAgo(new Date(Date.now() - i * 300000)),
        read: false,
      };
    });
  } catch (error) {
    console.error('Trending fetch error:', error);
    return [];
  }
}

async function fetchSecurityAlerts(): Promise<NotificationItem[]> {
  try {
    const headers: Record<string, string> = {};
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=volume_desc&per_page=30&page=1&sparkline=false&price_change_percentage=1h',
      { headers }
    );
    if (!res.ok) return [];
    const coins = await res.json();
    if (!Array.isArray(coins)) return [];

    const alerts: NotificationItem[] = [];
    for (const coin of coins) {
      const change1h = coin.price_change_percentage_1h_in_currency;
      if (change1h && change1h < -10) {
        alerts.push({
          id: `security-${coin.id}-${Date.now()}`,
          type: 'security',
          title: 'Security Alert',
          message: `⚠️ ${coin.name} (${coin.symbol?.toUpperCase()}) crashed ${Math.abs(change1h).toFixed(1)}% in 1h — potential risk event`,
          time: timeAgo(new Date(coin.last_updated || Date.now())),
          read: false,
        });
      }
    }

    if (alerts.length === 0) {
      const suspicious = coins.filter((c: any) => {
        const vol = c.total_volume || 0;
        const mcap = c.market_cap || 1;
        return vol / mcap > 2;
      });
      for (const coin of suspicious.slice(0, 2)) {
        alerts.push({
          id: `security-vol-${coin.id}-${Date.now()}`,
          type: 'security',
          title: 'Security Alert',
          message: `⚠️ ${coin.name} (${coin.symbol?.toUpperCase()}) has unusually high volume-to-mcap ratio — monitor closely`,
          time: timeAgo(new Date(coin.last_updated || Date.now())),
          read: false,
        });
      }
    }

    return alerts.slice(0, 3);
  } catch (error) {
    console.error('Security alerts fetch error:', error);
    return [];
  }
}

async function fetchWhaleAlerts(): Promise<NotificationItem[]> {
  try {
    const headers: Record<string, string> = {};
    if (COINGECKO_KEY) headers['x-cg-demo-api-key'] = COINGECKO_KEY;
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,ripple,cardano&sparkline=false',
      { headers }
    );
    if (!res.ok) return [];
    const coins = await res.json();
    if (!Array.isArray(coins)) return [];

    return coins.slice(0, 3).map((coin: any, i: number) => {
      const vol = coin.total_volume || 0;
      const volStr = vol >= 1e9 ? `$${(vol / 1e9).toFixed(1)}B` : `$${(vol / 1e6).toFixed(0)}M`;
      return {
        id: `whale-${coin.id}-${Date.now()}-${i}`,
        type: 'whale' as const,
        title: 'Whale Alert',
        message: `🐋 ${coin.name} 24h volume at ${volStr} — large institutional activity detected`,
        time: timeAgo(new Date(Date.now() - i * 600000)),
        read: false,
      };
    });
  } catch (error) {
    console.error('Whale alerts fetch error:', error);
    return [];
  }
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

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((row: any) => ({
      id: `sb-${row.id}`,
      type: row.type,
      title: row.title,
      message: row.message,
      time: timeAgo(new Date(row.created_at || Date.now())),
      read: row.read ?? false,
      createdAt: row.created_at,
      metadata: row.metadata || {},
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;

    // Try Supabase first for user-specific notifications
    let supabaseNotifications: NotificationItem[] = [];
    if (userId) {
      supabaseNotifications = await fetchSupabaseNotifications(userId);
    }

    // Return cached market notifications if fresh
    if (Date.now() - cache.ts < CACHE_TTL && cache.data.length > 0) {
      const merged = supabaseNotifications.length > 0
        ? [...supabaseNotifications, ...cache.data].slice(0, 50)
        : cache.data;
      return NextResponse.json({ notifications: merged, source: supabaseNotifications.length > 0 ? 'supabase+market' : 'cache' }, {
        headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
      });
    }

    const [priceAlerts, trending, securityAlerts, whaleAlerts] = await Promise.all([
      fetchPriceAlerts(),
      fetchTrending(),
      fetchSecurityAlerts(),
      fetchWhaleAlerts(),
    ]);

    const marketNotifications: NotificationItem[] = [];

    const interleaved = [priceAlerts, securityAlerts, whaleAlerts, trending];
    const maxLen = Math.max(...interleaved.map(a => a.length));
    for (let i = 0; i < maxLen; i++) {
      for (const arr of interleaved) {
        if (i < arr.length) marketNotifications.push(arr[i]);
      }
    }

    cache = { data: marketNotifications, ts: Date.now() };

    // Merge Supabase user notifications on top of market notifications
    const notifications = supabaseNotifications.length > 0
      ? [...supabaseNotifications, ...marketNotifications].slice(0, 50)
      : marketNotifications;

    return NextResponse.json({ notifications, source: supabaseNotifications.length > 0 ? 'supabase+market' : 'market' }, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
    });
  } catch (error) {
    console.error('Notifications API error:', error);
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
      id: `user-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      title,
      message,
      time: 'Just now',
      read: false,
      createdAt: now,
      metadata: metadata || {},
    };

    // Attempt to save to Supabase if service key is available
    let supabaseId: string | null = null;
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_KEY;
      if (serviceKey) {
        const { createClient } = await import('@supabase/supabase-js');
        const adminClient = createClient(
          'https://phvewrldcdxupsnakddx.supabase.co',
          serviceKey,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );
        const userId = body.userId || null;
        const { data, error } = await adminClient
          .from('notifications')
          .insert([{
            user_id: userId,
            type,
            title,
            message,
            read: false,
            created_at: now,
            metadata: metadata || {},
          }])
          .select('id')
          .single();

        if (!error && data) {
          supabaseId = data.id;
          notification.id = `sb-${data.id}`;
        }
      }
    } catch (supabaseErr) {
      // Supabase unavailable — fall back to localStorage (handled client-side)
      console.log('Supabase notification save skipped:', supabaseErr);
    }

    // Send email for critical alerts
    const emailAlertTypes = ['whale_alert', 'price_target'];
    if (emailAlertTypes.includes(type) && userEmail) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        fetch(`${baseUrl}/api/send-notification-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, message, type, userEmail }),
        }).catch(() => {});
      } catch {}
    }

    return NextResponse.json({ notification, supabaseId });
  } catch (error) {
    console.error('POST /api/notifications error:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}
