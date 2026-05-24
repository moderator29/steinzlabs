'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';

/**
 * OV2: "What changed since last login" digest banner. Self-hides when:
 *   - the user has no prior login on record (fresh signup),
 *   - the digest has nothing interesting to surface,
 *   - or the user dismisses it for the current session.
 */

interface DigestResponse {
  previousLoginAt: string | null;
  newAlerts: number | null;
  watchlistMovers: number | null;
}

const DISMISS_KEY = 'naka_dashboard_digest_dismissed_at';

function shortRel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'recently';
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return 'in the last hour';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function SinceLastLoginDigest() {
  const [data, setData] = useState<DigestResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Per-session dismissal — once a user X's the digest, don't show it
    // again until the next reload.
    const dismissedAt = typeof window !== 'undefined' ? sessionStorage.getItem(DISMISS_KEY) : null;
    if (dismissedAt) { setDismissed(true); return; }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/since-last-login');
        if (!res.ok) return;
        const j = await res.json() as DigestResponse;
        if (!cancelled) setData(j);
      } catch { /* swallow — banner just stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (dismissed || !data?.previousLoginAt) return null;
  const alerts = data.newAlerts ?? 0;
  const movers = data.watchlistMovers ?? 0;
  if (alerts === 0 && movers === 0) return null;

  const parts: string[] = [];
  if (alerts > 0) parts.push(`${alerts} new alert${alerts === 1 ? '' : 's'}`);
  if (movers > 0) parts.push(`${movers} watchlist mover${movers === 1 ? '' : 's'}`);

  return (
    <div className="rounded-2xl border border-blue-500/25 bg-blue-500/[0.06] p-4 mb-4 flex items-start gap-3">
      <Sparkles className="w-5 h-5 text-[#8FA3FF] mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">Since you last visited {shortRel(data.previousLoginAt)}</div>
        <div className="text-xs text-slate-300 mt-0.5">{parts.join(' · ')}</div>
      </div>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, new Date().toISOString());
          setDismissed(true);
        }}
        className="text-slate-500 hover:text-white p-1 -m-1"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
