'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, AlertTriangle, Flame, ShieldAlert, Send, Info, ArrowLeftRight, CheckCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { getLocalNotifications, markAllNotificationsRead } from '@/lib/notifications';

/**
 * §3.2 — full Notifications surface, reached from the side-nav. Loads from the
 * SAME source as the header bell (/api/notifications + the local store) so the
 * two never diverge; local entries override the API for the same id.
 */

interface NotifItem {
  id: string;
  type: string;
  title: string;
  message: string;
  /** Unix ms for sorting; 0 when only a relative string is known. */
  ts: number;
  time: string;
  read: boolean;
  href?: string;
}

const READ_KEY = 'steinz_read_notifs';

function readIdSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); }
}

function timeAgo(ms: number): string {
  if (!ms) return 'Just now';
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function icon(type: string) {
  switch (type) {
    case 'whale_alert': case 'whale': return <span className="text-xs font-bold text-[#10B981]">WH</span>;
    case 'price_target': case 'price': return <span className="text-xs font-bold text-[#0066FF]">P</span>;
    case 'new_launch': return <span className="text-xs font-bold text-[#7C3AED]">NL</span>;
    case 'swap': return <ArrowLeftRight className="w-4 h-4 text-[#0066FF]" />;
    case 'send': return <Send className="w-4 h-4 text-[#F59E0B]" />;
    case 'security': return <ShieldAlert className="w-4 h-4 text-[#EF4444]" />;
    case 'trending': return <Flame className="w-4 h-4 text-[#EF4444]" />;
    case 'alert': case 'prediction': return <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />;
    case 'system': return <Info className="w-4 h-4 text-gray-400" />;
    default: return <Bell className="w-4 h-4 text-gray-400" />;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const reads = readIdSet();
    const local = getLocalNotifications().map((n): NotifItem => ({
      id: n.id, type: n.type, title: n.title, message: n.message,
      ts: n.timestamp, time: timeAgo(n.timestamp), read: n.read || reads.has(n.id),
    }));
    let merged = local;
    try {
      const userId = typeof window !== 'undefined' ? localStorage.getItem('steinz_user_id') || '' : '';
      const res = await fetch(`/api/notifications${userId ? `?userId=${userId}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.notifications)) {
          const localIds = new Set(local.map((n) => n.id));
          const api: NotifItem[] = data.notifications
            .filter((n: { id: string }) => !localIds.has(n.id))
            .map((n: { id: string; type: string; title: string; message: string; created_at?: string; time?: string }) => {
              const ts = n.created_at ? new Date(n.created_at).getTime() : 0;
              return { id: n.id, type: n.type, title: n.title, message: n.message, ts, time: n.time || timeAgo(ts), read: reads.has(n.id) };
            });
          merged = [...local, ...api];
        }
      }
    } catch { /* offline — local stands */ }
    merged.sort((a, b) => b.ts - a.ts);
    setItems(merged);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAll = () => {
    markAllNotificationsRead();
    try {
      const all = Array.from(new Set([...readIdSet(), ...items.map((i) => i.id)]));
      localStorage.setItem(READ_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  };

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="min-h-screen text-white max-w-2xl mx-auto px-4 pt-4 pb-24">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : 'You are all caught up'}
        showBack
        backTo="/dashboard"
        actions={
          unread ? (
            <button
              onClick={markAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/10 text-slate-300 hover:text-white hover:border-white/20 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark all read
            </button>
          ) : null
        }
      />

      {loading ? (
        <div className="text-sm text-slate-500 py-10 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 py-14 text-center">
          <Bell className="w-7 h-7 mx-auto text-slate-600 mb-3" />
          <div className="text-sm text-slate-400">No notifications yet.</div>
          <div className="text-[11px] text-slate-600 mt-1">Whale moves, price targets, and security alerts will show up here.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              onClick={() => n.href && router.push(n.href)}
              className={`w-full text-start flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors ${
                n.read
                  ? 'bg-white/[0.02] border-white/[0.06]'
                  : 'bg-[#0066FF]/[0.06] border-[#0066FF]/25'
              } ${n.href ? 'hover:border-white/20' : ''}`}
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0">
                {icon(n.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white truncate">{n.title}</span>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#0066FF] flex-shrink-0" />}
                </div>
                <p className="text-[12px] text-slate-400 leading-snug mt-0.5">{n.message}</p>
                <div className="text-[10px] text-slate-600 mt-1">{n.time}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
