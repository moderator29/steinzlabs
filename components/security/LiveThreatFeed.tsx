'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Loader2, RadioTower, ExternalLink } from 'lucide-react';

/**
 * Live threat feed for the Security Center. Renders the signed-in user's real
 * security_alerts rows newest-first with a severity badge, source chip and
 * relative time. Shows an honest empty state when there are no alerts and a
 * distinct "not yet available" state when the backing table isn't migrated.
 * No rows, severities or timestamps are ever fabricated.
 */

interface Alert {
  id: string;
  severity: string;
  title: string;
  description: string | null;
  source: string | null;
  category: string | null;
  target: string | null;
  acknowledged: boolean;
  created_at: string;
}

interface FeedResponse {
  alerts: Alert[];
  available: boolean;
}

const SEVERITY: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
  high:     { label: 'High',     color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  warn:     { label: 'High',     color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  medium:   { label: 'Medium',   color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  low:      { label: 'Low',      color: '#8B7CFF', bg: 'rgba(139,124,255,0.12)' },
};

function severityMeta(sev: string) {
  return SEVERITY[sev?.toLowerCase()] ?? { label: sev || 'Info', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} yr ago`;
}

function shortTarget(target: string): string {
  if (target.length <= 18) return target;
  return `${target.slice(0, 8)}…${target.slice(-6)}`;
}

export function LiveThreatFeed() {
  const [state, setState] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/security/threats', { cache: 'no-store' });
        if (!cancelled && res.ok) setState(await res.json() as FeedResponse);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    // Poll every 30s so the feed stays live without a socket.
    const id = setInterval(() => void load(), 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const alerts = state?.alerts ?? [];

  return (
    <div className="nl-glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <RadioTower className="w-4 h-4 text-[#0066FF]" aria-hidden="true" />
        <h2 className="text-base font-semibold">Live threat feed</h2>
        {!loading && alerts.length > 0 && (
          <span className="ms-auto flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0066FF] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0066FF]" />
            </span>
            {alerts.length} active
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
            <ShieldCheck className="w-6 h-6 text-emerald-400" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-slate-200">No active threats</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
            {state?.available === false
              ? 'Monitoring feed is initializing. Alerts will appear here once security scans run against your wallet.'
              : 'Nothing flagged across your wallet, approvals or held tokens right now. New alerts land here as scans run.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => {
            const meta = severityMeta(a.severity);
            return (
              <li
                key={a.id}
                className="nl-glass nl-glass--interactive rounded-xl p-3 flex items-start gap-3"
                style={{ boxShadow: `inset 3px 0 0 0 ${meta.color}` }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.bg }}>
                  <ShieldAlert className="w-4 h-4" style={{ color: meta.color }} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
                      style={{ color: meta.color, backgroundColor: meta.bg }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-sm font-medium text-slate-100 truncate">{a.title}</span>
                  </div>
                  {a.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{a.description}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[10px] text-slate-500">
                    {a.source && (
                      <span className="bg-white/[0.04] border border-white/5 rounded px-1.5 py-0.5 font-medium text-slate-400">
                        {a.source}
                      </span>
                    )}
                    {a.category && <span className="capitalize">{a.category}</span>}
                    {a.target && (
                      <span className="font-mono inline-flex items-center gap-1">
                        <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                        {shortTarget(a.target)}
                      </span>
                    )}
                    <span className="ms-auto">{timeAgo(a.created_at)}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
