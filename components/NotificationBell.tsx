'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, Flame, ShieldAlert, Send, Info, ArrowLeftRight, X, CheckCheck, UserPlus, MessageCircle } from 'lucide-react';
import {
  getLocalNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type LocalNotification,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';

// Realtime row shape coming off the notifications table INSERT stream.
interface NotificationRowPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  created_at: string;
}

// Background poll cadence. Realtime carries the live signal; the poll is a
// belt-and-braces refresh in case the websocket disconnects (laptop sleep,
// tab backgrounded, network blip). 5 minutes is plenty given Realtime.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

interface DisplayNotification {
  id: string;
  type: LocalNotification['type'] | 'whale' | 'price' | 'prediction' | 'trending';
  title: string;
  message: string;
  time: string;
  read: boolean;
  href?: string;
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getNotifIcon(type: string) {
  switch (type) {
    case 'welcome':         return <span className="text-sm leading-none font-bold text-[#0066FF]">W</span>;
    case 'wallet_created':
    case 'wallet_imported': return <span className="text-sm leading-none font-bold text-[#F59E0B]">W</span>;
    case 'whale_alert':
    case 'whale':           return <span className="text-sm leading-none font-bold text-[#10B981]">WH</span>;
    case 'price_target':
    case 'price':           return <span className="text-sm leading-none font-bold text-[#0066FF]">P</span>;
    case 'new_launch':      return <span className="text-sm leading-none font-bold text-[#7C3AED]">NL</span>;
    case 'wallet_activity': return <span className="text-sm leading-none font-bold text-gray-400">A</span>;
    case 'swap':            return <ArrowLeftRight className="w-4 h-4 text-[#0066FF]" />;
    case 'send':            return <Send className="w-4 h-4 text-[#F59E0B]" />;
    case 'security':        return <ShieldAlert className="w-4 h-4 text-[#EF4444]" />;
    case 'trending':        return <Flame className="w-4 h-4 text-[#EF4444]" />;
    case 'prediction':      return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
    case 'alert':           return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
    case 'system':          return <Info className="w-4 h-4 text-gray-400" />;
    case 'social.new_follower':
    case 'social.follow_request': return <UserPlus className="w-4 h-4 text-[#0066FF]" />;
    case 'social.dm_received':
    case 'social.dm_request':
    case 'social.dm_request_accepted': return <MessageCircle className="w-4 h-4 text-[#0066FF]" />;
    default:                return <Bell className="w-4 h-4 text-gray-400" />;
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  // Authenticated user id from the Supabase session — replaces the dead
  // localStorage 'steinz_user_id' (which was never written), so the realtime
  // filter user_id=eq.<id> actually matches this user's notification rows.
  const [userId, setUserId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Resolve the session user once on mount (mirrors the DM thread page).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setUserId(data.user?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  const loadNotifications = useCallback(async () => {
    // Local notifications first (instant)
    const local = getLocalNotifications();
    const readIds: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('steinz_read_notifs') || '[]'); } catch { /* Malformed JSON — return default */ return []; }
    })();

    const localMapped: DisplayNotification[] = local.map(n => ({
      id: n.id,
      type: n.type as DisplayNotification['type'],
      title: n.title,
      message: n.message,
      time: formatTimeAgo(n.timestamp),
      read: n.read || readIds.includes(n.id),
    }));
    setNotifications(localMapped);

    // Merge with API notifications
    try {
      setApiLoading(true);
      const params = userId ? `?userId=${userId}` : '';
      const res = await fetch(`/api/notifications${params}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          const apiMapped: DisplayNotification[] = data.notifications.map((n: any) => ({
            id: n.id,
            type: n.type as DisplayNotification['type'],
            title: n.title,
            message: n.message,
            time: n.time || 'Just now',
            read: readIds.includes(n.id),
            href: n.href,
          }));
          // Deduplicate: local overrides API for same id
          const localIds = new Set(localMapped.map(n => n.id));
          const merged = [...localMapped, ...apiMapped.filter(n => !localIds.has(n.id))];
          setNotifications(merged);
        }
      }
    } catch (err) {
      console.error('[NotificationBell] Fetch notifications failed:', err);
    } finally {
      setApiLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadNotifications();

    // §perf-2 — Inter-tab coordination via BroadcastChannel so only one
    // tab actually polls /api/notifications. Other tabs listen and
    // hydrate from the broadcast, saving N tabs × 1 fetch every 5min.
    // Falls back to per-tab polling if BroadcastChannel isn't supported.
    let interval: ReturnType<typeof setInterval>;
    let bcast: BroadcastChannel | null = null;
    let isLeader = false;

    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      bcast = new BroadcastChannel('naka:notifications');
      const leadershipKey = 'naka:notifications:leader';
      const myId = Math.random().toString(36).slice(2);
      const claimLeadership = () => {
        try {
          localStorage.setItem(leadershipKey, JSON.stringify({ id: myId, ts: Date.now() }));
          isLeader = true;
        } catch { isLeader = true; }
      };
      try {
        const raw = localStorage.getItem(leadershipKey);
        const cur = raw ? JSON.parse(raw) : null;
        if (!cur || Date.now() - (cur.ts ?? 0) > POLL_INTERVAL_MS * 2) claimLeadership();
      } catch { claimLeadership(); }

      bcast.onmessage = (ev) => {
        if (ev.data?.type === 'notifications:refresh') loadNotifications();
      };

      interval = setInterval(() => {
        if (isLeader) {
          loadNotifications();
          try {
            localStorage.setItem(leadershipKey, JSON.stringify({ id: myId, ts: Date.now() }));
          } catch { /* ignore */ }
          bcast?.postMessage({ type: 'notifications:refresh' });
        }
      }, POLL_INTERVAL_MS);
    } else {
      interval = setInterval(loadNotifications, POLL_INTERVAL_MS);
    }

    const handleLocal = () => loadNotifications();
    window.addEventListener('steinz_notification', handleLocal);

    // Supabase Realtime — subscribe to INSERTs on `notifications` filtered to
    // this user. New rows prepend to the dropdown live (no poll wait). Updates
    // (server marking read) also flow through so the bell de-dots without a
    // refetch. Realtime publication for `notifications` must be enabled on
    // the Supabase side (see supabase/migrations/2026_05_21_enable_notifications_realtime).
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (userId) {
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as NotificationRowPayload;
            const readIds: string[] = (() => {
              try { return JSON.parse(localStorage.getItem('steinz_read_notifs') || '[]'); } catch { return []; }
            })();
            const next: DisplayNotification = {
              id: row.id,
              type: row.type as DisplayNotification['type'],
              title: row.title,
              message: row.body,
              time: 'Just now',
              read: row.read || readIds.includes(row.id),
              href: row.url ?? undefined,
            };
            setNotifications((prev) => (prev.some((n) => n.id === next.id) ? prev : [next, ...prev]));
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as NotificationRowPayload;
            setNotifications((prev) => prev.map((n) => (n.id === row.id ? { ...n, read: n.read || row.read } : n)));
          },
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      bcast?.close();
      window.removeEventListener('steinz_notification', handleLocal);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadNotifications, userId]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkRead = (id: string) => {
    markNotificationRead(id);
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    // Persist to read-ids list (covers local-only notifications).
    const readIds: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('steinz_read_notifs') || '[]'); } catch { /* Malformed JSON — return default */ return []; }
    })();
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem('steinz_read_notifs', JSON.stringify(readIds));
    }
    // DB-authoritative: persist read-state for Supabase-backed rows. The PATCH
    // route binds the update to the session user (no IDOR).
    void fetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
      .catch((err) => console.error('[NotificationBell] mark read failed:', err));
  };

  const handleMarkAllRead = async () => {
    markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('steinz_read_notifs', JSON.stringify(allIds));
    // DB-authoritative: the RPC is RLS-safe and marks every unread row for the
    // session user in one round-trip.
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) console.error('[NotificationBell] mark_all RPC failed:', error.message);
    } catch (err) {
      console.error('[NotificationBell] mark_all RPC threw:', err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(v => !v)}
        // §header-shape-parity — owner asked all four header controls
        // (QuickTranslate / LanguageSwitcher / ThemeToggle / Bell) to share
        // the same square rounded-lg container with a subtle filled
        // background. The other three already use bg-white/[0.04] + border
        // border-white/[0.08] (see GlobalControls). Match exactly so the
        // cluster reads as a single visual row.
        className="relative p-2 rounded-lg nl-glass hover:bg-white/[0.08] transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-[#EF4444] rounded-full text-[9px] font-bold flex items-center justify-center text-white leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#111827] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#0066FF]" />
              <span className="text-sm font-bold">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-[#EF4444]/20 text-[#EF4444] text-[9px] font-bold rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#0066FF] hover:bg-[#0066FF]/10 rounded transition-colors font-semibold"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close notifications"
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-300" aria-hidden />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {apiLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <div className="w-4 h-4 border-2 border-[#0066FF]/30 border-t-[#0066FF] rounded-full animate-spin" />
                <span className="text-xs text-gray-500">Loading...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-xs font-semibold text-gray-400">No notifications yet</p>
                <p className="text-[11px] text-gray-300 mt-1">Activity and alerts will appear here</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => { handleMarkRead(n.id); if (n.href) { setOpen(false); router.push(n.href); } }}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-start border-b border-white/[0.04] last:border-0 transition-colors ${
                    n.read ? 'opacity-50 hover:opacity-70 hover:bg-white/[0.02]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center">
                    {getNotifIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">{n.title}</span>
                      {!n.read && (
                        <span className="w-1.5 h-1.5 bg-[#0066FF] rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed line-clamp-2">{n.message}</p>
                    <span className="text-[9px] text-gray-600 mt-1 block">{n.time}</span>
                  </div>
                </button>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white/[0.06] text-center">
              <span className="text-[10px] text-gray-600">
                {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
                {unreadCount > 0 ? ` · ${unreadCount} unread` : ' · all caught up'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
