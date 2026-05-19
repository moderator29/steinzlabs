'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Flag, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

/**
 * /admin/social-reports — moderator queue.
 * Filter by status + category, resolve or dismiss with admin notes.
 * All writes go through verifyAdminRequest on the API side; this page
 * relies on the admin layout providing the Bearer header via cookies.
 */

interface Report {
  id: string;
  reporter_id: string | null;
  reported_id: string;
  reason: string;
  category: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
  reported: { id: string; username: string | null; display_name: string | null; avatar_url: string | null } | null;
}

const CATS = ['all', 'spam', 'harassment', 'scam', 'impersonation', 'other'] as const;
const STATUSES = ['pending', 'resolved', 'dismissed', 'all'] as const;

export default function SocialReportsAdminPage() {
  const [status, setStatus] = useState<typeof STATUSES[number]>('pending');
  const [category, setCategory] = useState<typeof CATS[number]>('all');
  const [rows, setRows] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRows(null); setError(null);
    const params = new URLSearchParams();
    params.set('status', status);
    if (category !== 'all') params.set('category', category);
    try {
      const res = await fetch(`/api/admin/social/reports?${params}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed'); return; }
      setRows(json.reports ?? []);
    } catch {
      setError('Network error');
    }
  }, [status, category]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (id: string, action: 'resolved' | 'dismissed') => {
    setPendingAction(id + action);
    try {
      const res = await fetch('/api/admin/social/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: action }),
      });
      if (res.ok) load();
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-5">
        <Flag className="w-5 h-5 text-red-400" />
        <h1 className="text-xl sm:text-2xl font-bold text-white">Social Reports</h1>
      </div>
      <div className="flex gap-2 mb-4">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof STATUSES[number])} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value as typeof CATS[number])} className="bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white">
          {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {error ? (
        <div className="text-sm text-red-400">{error}</div>
      ) : rows === null ? (
        <div className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-400 italic">No reports match this filter.</div>
      ) : (
        <div className="rounded-xl bg-white/[0.025] border border-white/[0.06] divide-y divide-white/[0.05]">
          {rows.map((r) => (
            <div key={r.id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 uppercase">{r.category}</span>
                  <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/10 text-slate-300 uppercase">{r.status}</span>
                  <span className="text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <div className="text-sm text-slate-200">
                  <span className="text-slate-400">By</span>{' '}
                  {r.reporter ? <Link href={`/u/${r.reporter.username}`} className="text-[var(--nl-blue,#0A1EFF)]">@{r.reporter.username}</Link> : <span className="italic text-slate-500">unknown</span>}{' '}
                  <span className="text-slate-400">against</span>{' '}
                  {r.reported ? <Link href={`/u/${r.reported.username}`} className="text-[var(--nl-blue,#0A1EFF)]">@{r.reported.username}</Link> : <span className="italic text-slate-500">unknown</span>}
                </div>
                <p className="text-sm text-slate-100 whitespace-pre-wrap">{r.reason}</p>
                {r.admin_notes && <p className="text-[11px] text-slate-400 italic">Note: {r.admin_notes}</p>}
              </div>
              {r.status === 'pending' && (
                <div className="flex md:flex-col gap-2">
                  <button
                    disabled={pendingAction === r.id + 'resolved'}
                    onClick={() => resolve(r.id, 'resolved')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[12px] font-semibold disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />Resolve
                  </button>
                  <button
                    disabled={pendingAction === r.id + 'dismissed'}
                    onClick={() => resolve(r.id, 'dismissed')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 text-[12px] font-semibold disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
