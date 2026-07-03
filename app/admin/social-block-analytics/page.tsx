'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserMinus, VolumeX, Loader2 } from 'lucide-react';

interface Row { count: number; profile: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; tier: string | null } | null }

export default function BlockAnalyticsPage() {
  const [data, setData] = useState<{ most_blocked: Row[]; most_muted: Row[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/social/block-analytics', { headers: { Authorization: `Bearer ${sessionStorage.getItem('admin_token') ?? ''}` } });
        const json = await res.json();
        if (!res.ok) setError(json.error ?? 'Failed');
        else setData(json);
      } catch { setError('Network error'); }
    })();
  }, []);

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold text-white mb-5">Block / Mute analytics</h1>
      {error ? <div className="text-sm text-red-400">{error}</div>
        : data === null ? <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
        : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Column title="Most blocked" Icon={UserMinus} rows={data.most_blocked} tone="red" />
          <Column title="Most muted" Icon={VolumeX} rows={data.most_muted} tone="amber" />
        </div>
      )}
    </div>
  );
}

function Column({ title, Icon, rows, tone }: { title: string; Icon: React.ComponentType<{ className?: string }>; rows: Row[]; tone: 'red' | 'amber' }) {
  return (
    <section className="rounded-2xl nl-glass p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${tone === 'red' ? 'text-red-400' : 'text-amber-300'}`} />
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-slate-500 italic">No data yet.</div>
      ) : (
        <ol className="space-y-1">
          {rows.map((r, i) => (
            <li key={r.profile?.id ?? i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]">
              <span className="w-6 text-[11px] tabular-nums text-slate-400 text-end">{i + 1}.</span>
              {r.profile ? (
                <Link href={`/admin/social-users?id=${r.profile.id}`} className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-[12px] font-medium text-white truncate">@{r.profile.username}</span>
                  {r.profile.tier ? <span className="text-[9px] px-1 py-[1px] rounded bg-white/[0.04] text-slate-400 uppercase">{r.profile.tier}</span> : null}
                </Link>
              ) : (
                <span className="text-[12px] text-slate-500 italic flex-1">unknown user</span>
              )}
              <span className="text-[12px] tabular-nums text-slate-300">{r.count}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
