'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';

/**
 * Header notification center. Bell icon with unread badge + dropdown
 * panel listing recent in-app notifications. Caller supplies the
 * notifications + onRead callback so this component stays storage-
 * agnostic; the existing addLocalNotification / lib/notifications.ts
 * stream feeds it.
 */

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  /** Unix seconds */
  at: number;
  /** Optional severity for the left-edge accent color. */
  kind?: 'info' | 'success' | 'warning' | 'error';
  /** Already seen by the user. */
  read?: boolean;
  /** Optional click target. */
  href?: string;
}

export interface NotificationCenterProps {
  items: NotificationItem[];
  onMarkAllRead?: () => void;
  onItemClick?: (id: string) => void;
}

const KIND_ACCENT: Record<NonNullable<NotificationItem['kind']>, string> = {
  info: '#0A1EFF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

function timeAgo(sec: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - sec);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86_400)}d ago`;
}

export function NotificationCenter({ items, onMarkAllRead, onItemClick }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const unread = items.filter((i) => !i.read).length;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative w-9 h-9 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-slate-300 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span
            aria-label={`${unread} unread notifications`}
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#0F1320] border border-white/10 shadow-2xl overflow-hidden z-[var(--z-dropdown,100)]"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {onMarkAllRead && unread > 0 ? (
              <button
                onClick={() => onMarkAllRead()}
                className="text-[11px] text-[#8FA3FF] hover:text-white inline-flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-xs text-slate-400">
                No notifications yet.
              </div>
            ) : (
              items.slice(0, 20).map((n) => {
                const accent = n.kind ? KIND_ACCENT[n.kind] : '#0A1EFF';
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      onItemClick?.(n.id);
                      if (n.href) window.location.href = n.href;
                    }}
                    className="w-full text-left px-4 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors flex items-start gap-3"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: n.read ? '#374151' : accent, boxShadow: n.read ? undefined : `0 0 8px ${accent}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-white truncate">{n.title}</div>
                      {n.body ? <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.body}</p> : null}
                      <p className="text-[10px] text-slate-500 mt-1 tabular-nums">{timeAgo(n.at)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
