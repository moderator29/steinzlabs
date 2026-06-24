'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { FollowButton } from '@/components/social/FollowButton';

/**
 * /leaderboard/[kind] — top-100 dedicated page for any of the 8
 * leaderboards. Server route applies the kind-specific ordering;
 * page renders top 100 with inline Follow buttons.
 */

const KIND_TITLES: Record<string, { title: string; sub: string }> = {
  'success-rate':   { title: 'Top Success Rate',   sub: 'Composite of copy trades, whale picks, portfolio performance, community + activity.' },
  'followers':      { title: 'Top Followers',      sub: 'Most-followed members on the platform.' },
  'new-users':      { title: 'New Users',          sub: 'Recently joined accounts.' },
  'max-tier':       { title: 'Max Tier',           sub: 'Members on the Max subscription tier.' },
  'top-traders':    { title: 'Top Traders',        sub: 'Highest 30-day portfolio percentile.' },
  'copy-traders':   { title: 'Top Copy Traders',   sub: 'Best win rate on copy trades.' },
  'whale-watchers': { title: 'Top Whale Watchers', sub: 'Most accurate at picking profitable whales to follow.' },
  'most-active':    { title: 'Most Active',        sub: 'Daily active engagement score.' },
};

interface Row {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  verified_badge: string | null;
  is_chosen: boolean | null;
  metric_value: number | string | null;
  metric_label: string;
}

function formatMetric(v: number | string | null, kind: string): string {
  if (v === null || v === undefined) return '—';
  if (kind === 'new-users') {
    try { return new Date(String(v)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return '—'; }
  }
  if (kind === 'success-rate' || kind === 'most-active') return `${v}/100`;
  if (kind === 'top-traders') {
    const n = Number(v); return isFinite(n) ? `${n >= 0 ? '+' : ''}${n.toFixed(1)}%` : '—';
  }
  if (kind === 'copy-traders' || kind === 'whale-watchers') {
    const n = Number(v); return isFinite(n) ? `${(n * 100).toFixed(0)}%` : '—';
  }
  return String(v);
}

export default function LeaderboardPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = use(params);
  const meta = KIND_TITLES[kind];
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meta) { setError('Unknown leaderboard'); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/social/leaderboards/${kind}?limit=100`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) setRows(json.rows ?? []);
        else setError(json.error ?? 'Failed to load');
      } catch {
        if (!cancelled) setError('Network error');
      }
    })();
    return () => { cancelled = true; };
  }, [kind, meta]);

  if (!meta) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Unknown leaderboard. <Link href="/discover" className="ms-2 text-[var(--nl-blue,#0066FF)] underline">Back to Discover</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <BackButton />
        <Trophy className="w-5 h-5 text-[var(--nl-blue,#0066FF)]" />
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{meta.title}</h1>
          <p className="text-[12px] text-slate-400">{meta.sub}</p>
        </div>
      </div>

      {error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : rows === null ? (
        <ul className="space-y-1.5" aria-busy="true">
          {Array.from({ length: 10 }).map((_, i) => <li key={i} className="h-12 rounded-lg bg-white/[0.03] animate-pulse" />)}
        </ul>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-400">No entries yet.</div>
      ) : (
        <ol className="rounded-2xl bg-white/[0.025] border border-white/[0.06] divide-y divide-white/[0.05]">
          {rows.map((r, idx) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <span className="w-8 text-[12px] tabular-nums text-slate-400 text-end">{idx + 1}.</span>
              <Link href={`/u/${r.username ?? r.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                {r.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-[12px] font-bold text-white">
                    {(r.display_name || r.username || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white truncate">{r.display_name || r.username}</div>
                  <div className="text-[11px] text-slate-400 truncate">@{r.username}</div>
                </div>
              </Link>
              <div className="text-[12px] tabular-nums text-slate-300 me-2">{formatMetric(r.metric_value, kind)}</div>
              <FollowButton targetId={r.id} initialState="not_following" size="sm" />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
