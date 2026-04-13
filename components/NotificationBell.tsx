'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, AlertTriangle, Flame, ShieldAlert, Send, Info, ArrowLeftRight, X, CheckCheck } from 'lucide-react';
import {
  getLocalNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type LocalNotification,
} from '@/lib/notifications';

interface DisplayNotification {
  id: string;
  type: LocalNotification['type'] | 'whale' | 'price' | 'prediction' | 'trending';
  title: string;
  message: string;
  time: string;
  read: boolean;
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

function getNotifIcon(type: DisplayNotification['type']) {
  switch (type) {
    case 'welcome':         return <span className="text-sm leading-none font-bold text-[#0A1EFF]">W</span>;
    case 'wallet_created':
    case 'wallet_imported': return <span className="text-sm leading-none font-bold text-[#F59E0B]">W</span>;
    case 'whale_alert':
    case 'whale':           return <span className="text-sm leading-none font-bold text-[#10B981]">WH</span>;
    case 'price_target':
    case 'price':           return <span className="text-sm leading-none font-bold text-[#0A1EFF]">P</span>;
    case 'new_launch':      return <span className="text-sm leading-none font-bold text-[#7C3AED]">NL</span>;
    case 'wallet_activity': return <span className="text-sm leading-none font-bold text-gray-400">A</span>;
    case 'swap':            return <ArrowLeftRight className="w-4 h-4 text-[#0A1EFF]" />;
    case 'send':            return <Send className="w-4 h-4 text-[#F59E0B]" />;
    case 'security':        return <ShieldAlert className="w-4 h-4 text-[#EF4444]" />;
    case 'trending':        return <Flame className="w-4 h-4 text-[#EF4444]" />;
    case 'prediction':      return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
    case 'alert':           return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
    case 'system':          return <Info className="w-4 h-4 text-gray-400" />;
    default:                return <Bell className="w-4 h-4 text-gray-400" />;
  }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<DisplayNotification[]>([]);
  const [apiLoading, setApiLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    // Local notifications first (instant)
    const local = getLocalNotifications();
    const readIds: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('steinz_read_notifs') || '[]'); } catch { return []; }
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
      const res = await fetch('/api/notifications');
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
          }));
          // Deduplicate: local overrides API for same id
          const localIds = new Set(localMapped.map(n => n.id));
          const merged = [...localMapped, ...apiMapped.filter(n => !localIds.has(n.id))];
          setNotifications(merged);
        }
      }
    } catch {} finally {
      setApiLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 120000);

    const handleLocal = () => loadNotifications();
    window.addEventListener('steinz_notification', handleLocal);

    return () => {
      clearInterval(interval);
      window.removeEventListener('steinz_notification', handleLocal);
    };
  }, [loadNotifications]);

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
    // Persist to read-ids list
    const readIds: string[] = (() => {
      try { return JSON.parse(localStorage.getItem('steinz_read_notifs') || '[]'); } catch { return []; }
    })();
    if (!readIds.includes(id)) {
      readIds.push(id);
      localStorage.setItem('steinz_read_notifs', JSON.stringify(readIds));
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('steinz_read_notifs', JSON.stringify(allIds));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#111827] border border-white/10 rounded-xl shadow-2xl z-[200] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#0A1EFF]" />
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
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-[#0A1EFF] hover:bg-[#0A1EFF]/10 rounded transition-colors font-semibold"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 hover:bg-white/10 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-[400px] overflow-y-auto">
            {apiLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 gap-2">
                <div className="w-4 h-4 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
                <span className="text-xs text-gray-500">Loading...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                <Bell className="w-8 h-8 text-gray-700 mb-2" />
                <p className="text-xs font-semibold text-gray-400">No notifications yet</p>
                <p className="text-[11px] text-gray-600 mt-1">Activity and alerts will appear here</p>
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleMarkRead(n.id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-white/[0.04] last:border-0 transition-colors ${
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
                        <span className="w-1.5 h-1.5 bg-[#0A1EFF] rounded-full flex-shrink-0" />
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
