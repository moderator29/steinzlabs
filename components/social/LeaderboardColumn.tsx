'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';

/**
 * LeaderboardColumn — top-10 list rendered as a card. Auto-refreshes
 * every 5 minutes so leaderboard movements show without a hard reload.
 */

export interface LeaderboardColumnProps {
  kind: 'success-rate' | 'followers' | 'new-users' | 'max-tier' | 'top-traders' | 'copy-traders' | 'whale-watchers' | 'most-active';
  title: string;
  description?: string;
  limit?: number;
}

interface Row {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  is_chosen: boolean | null;
  metric_value: number | string | null;
  metric_label: string;
}

const MEDAL = ['🥇', '🥈', '🥉'];

function formatMetric(v: number | string | null, kind: LeaderboardColumnProps['kind']): string {
  if (v === null || v === undefined) return '—';
  if (kind === 'new-users') {
    try { return `Joined ${new Date(String(v)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`; }
    catch { return '—'; }
  }
  if (kind === 'success-rate' || kind === 'most-active') return `${v}/100`;
  if (kind === 'top-traders') {
    const n = Number(v);
    if (!isFinite(n)) return '—';
    return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
  }
  if (kind === 'copy-traders' || kind === 'whale-watchers') {
    const n = Number(v);
    if (!isFinite(n)) return '—';
    return `${(n * 100).toFixed(0)}%`;
  }
  return String(v);
}

export function LeaderboardColumn({ kind, title, description, limit = 10 }: LeaderboardColumnProps) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/social/leaderboards/${kind}?limit=${limit}`, { cache: 'no-store' });
        const json = await res.json();
        if (!cancelled) {
          if (res.ok) setRows(json.rows ?? []);
          else setError(json.error ?? 'Failed to load');
        }
      } catch {
        if (!cancelled) setError('Network error');
      }
    };
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [kind, limit]);

  return (
    <section className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[var(--nl-blue,#0A1EFF)]" />
          <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
        </div>
        <Link href={`/leaderboard/${kind}`} className="text-[11px] text-slate-400 hover:text-white">View all →</Link>
      </header>
      {description ? <p className="text-[11px] text-slate-400 mb-2">{description}</p> : null}
      {error ? (
        <div className="text-[11px] text-red-400">{error}</div>
      ) : rows === null ? (
        <ul className="space-y-1.5" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="text-[11px] text-slate-500 italic">No data yet.</div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, idx) => (
            <li key={r.id}>
              <Link
                href={`/u/${r.username ?? r.id}`}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]"
              >
                <span className="w-6 text-[11px] tabular-nums text-slate-400 text-right">
                  {idx < 3 ? MEDAL[idx] : `${idx + 1}.`}
                </span>
                {r.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0A1EFF)] to-[#7C3AED] flex items-center justify-center text-[10px] font-bold text-white">
                    {(r.display_name || r.username || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="text-[12px] font-medium text-white truncate flex-1">
                  {r.display_name || r.username}
                </span>
                <span className="text-[11px] tabular-nums text-slate-300">
                  {formatMetric(r.metric_value, kind)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
