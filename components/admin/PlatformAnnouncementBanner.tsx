'use client';

import { useEffect, useState } from 'react';
import { Megaphone, X, AlertTriangle, Wrench } from 'lucide-react';

/**
 * PlatformAnnouncementBanner — pinned strip at the top of every
 * dashboard route. Pulls from /api/admin/announcement (returns the
 * latest single active announcement). Admin sets it from the
 * platform-settings page; users see it until they dismiss OR the
 * admin clears it.
 *
 * Three severities supported, each with its own visual + icon:
 *
 *   • info        emerald   Megaphone        product news / new feature
 *   • warning     amber     AlertTriangle    degraded service / known issue
 *   • maintenance violet    Wrench           scheduled downtime / migration
 *
 * Dismiss persists in localStorage keyed to the announcement id so a
 * fresh announcement renders even if the user dismissed the prior one.
 * Audit §B.13 / B.19 admin platform-announcement.
 */

export interface Announcement {
  id: string;
  severity: 'info' | 'warning' | 'maintenance';
  message: string;
  /** Optional CTA. */
  href?: string;
  ctaLabel?: string;
}

const SEVERITY_STYLE = {
  info: { color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.3)', Icon: Megaphone },
  warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.35)', Icon: AlertTriangle },
  maintenance: { color: '#7C3AED', bg: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.4)', Icon: Wrench },
} as const;

export interface PlatformAnnouncementBannerProps {
  announcement: Announcement | null;
}

export function PlatformAnnouncementBanner({ announcement }: PlatformAnnouncementBannerProps) {
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!announcement) return;
    try {
      const stored = localStorage.getItem('naka_ann_dismissed');
      setDismissed(stored);
    } catch {
      /* localStorage blocked — never hide */
    }
  }, [announcement]);

  if (!announcement) return null;
  if (dismissed === announcement.id) return null;

  const style = SEVERITY_STYLE[announcement.severity];
  const Icon = style.Icon;

  const dismiss = () => {
    setDismissed(announcement.id);
    try {
      localStorage.setItem('naka_ann_dismissed', announcement.id);
    } catch {
      /* swallow */
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full border-b naka-safe-top"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
        <Icon className="w-4 h-4 shrink-0" style={{ color: style.color }} />
        <p className="text-xs font-medium text-white flex-1 min-w-0">
          {announcement.message}
          {announcement.href && announcement.ctaLabel ? (
            <a
              href={announcement.href}
              className="ms-2 underline font-bold"
              style={{ color: style.color }}
            >
              {announcement.ctaLabel}
            </a>
          ) : null}
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="p-1 rounded hover:bg-white/[0.06] text-slate-300"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
