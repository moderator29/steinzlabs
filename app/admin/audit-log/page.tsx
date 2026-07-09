'use client';

import { useEffect, useState, useCallback } from 'react';
import { ScrollText, RefreshCw, Filter, Loader2 } from 'lucide-react';

interface AuditEntry {
  id: string;
  admin_id: string;
  target_user_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_OPTIONS = [
  '',
  'set_tier',
  'set_role',
  'ban',
  'unban',
  'delete',
  'copy_rule_create',
  'copy_rule_update',
  'copy_rule_delete',
  'copy_trade_execute',
  'other',
];

function shortId(s: string | null): string {
  if (!s) return '—';
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export default function AdminAuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [actor, setActor] = useState('');
  const [target, setTarget] = useState('');
  const [action, setAction] = useState('');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (actor) params.set('actor', actor);
      if (target) params.set('target', target);
      if (action) params.set('action', action);
      if (since) params.set('since', new Date(since).toISOString());
      if (until) params.set('until', new Date(until).toISOString());
      params.set('limit', '200');
      // The audit-log API authenticates via the admin bearer (same as every
      // other admin page) — without this header the request was always 401.
      const token = sessionStorage.getItem('admin_token') ?? '';
      const res = await fetch(`/api/admin/audit-log?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { entries: AuditEntry[] };
      setEntries(json.entries ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'load failed');
    } finally {
      setLoading(false);
    }
  }, [actor, target, action, since, until]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <ScrollText className="w-5 h-5 text-[var(--nl-blue,#0066FF)]" aria-hidden />
        <h1 className="text-xl sm:text-2xl font-bold text-white">Admin audit log</h1>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 nl-button nl-button--ghost text-xs"
          aria-label="Refresh audit log"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <RefreshCw className="w-3.5 h-3.5" aria-hidden />}
          Refresh
        </button>
      </div>
      <p className="text-[12px] text-slate-300 mb-5">
        Append-only record of every admin write + sensitive user-money action. Filter by actor, target, action, or time range.
      </p>

      <div className="rounded-2xl nl-glass p-3 mb-4 flex flex-wrap items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-slate-400" aria-hidden />
        <input
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          placeholder="actor uuid"
          className="bg-[#0A0E1A]/60 border border-white/[0.08] rounded-xl px-2 py-1 text-[11px] text-slate-100 font-mono w-44 focus:outline-none focus:border-[#0066FF]/50 transition-colors"
          aria-label="Filter by actor uuid"
        />
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="target uuid"
          className="bg-[#0A0E1A]/60 border border-white/[0.08] rounded-xl px-2 py-1 text-[11px] text-slate-100 font-mono w-44 focus:outline-none focus:border-[#0066FF]/50 transition-colors"
          aria-label="Filter by target uuid"
        />
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="bg-[#0A0E1A]/60 border border-white/[0.08] rounded-xl px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-[#0066FF]/50 transition-colors"
          aria-label="Filter by action"
        >
          {ACTION_OPTIONS.map((a) => (
            <option key={a || 'any'} value={a}>{a || 'Any action'}</option>
          ))}
        </select>
        <label className="text-[10px] text-slate-300">From
          <input
            type="datetime-local"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            className="ml-1 bg-[#0A0E1A]/60 border border-white/[0.08] rounded-xl px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-[#0066FF]/50 transition-colors"
          />
        </label>
        <label className="text-[10px] text-slate-300">To
          <input
            type="datetime-local"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="ml-1 bg-[#0A0E1A]/60 border border-white/[0.08] rounded-xl px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:border-[#0066FF]/50 transition-colors"
          />
        </label>
        <button
          onClick={() => { setActor(''); setTarget(''); setAction(''); setSince(''); setUntil(''); }}
          className="text-[10px] text-slate-300 hover:text-white underline"
        >
          Clear
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      <div className="rounded-2xl nl-glass overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-white/[0.02]">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">When</th>
              <th className="text-left px-3 py-2 font-semibold">Actor</th>
              <th className="text-left px-3 py-2 font-semibold">Target</th>
              <th className="text-left px-3 py-2 font-semibold">Action</th>
              <th className="text-left px-3 py-2 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {entries.length === 0 && !loading ? (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-400">No entries match these filters.</td></tr>
            ) : entries.map((e) => (
              <tr key={e.id} className="hover:bg-white/[0.02]">
                <td className="px-3 py-2 font-mono text-slate-200 whitespace-nowrap">{new Date(e.created_at).toISOString().replace('T', ' ').slice(0, 19)}</td>
                <td className="px-3 py-2 font-mono text-slate-200">{shortId(e.admin_id)}</td>
                <td className="px-3 py-2 font-mono text-slate-200">{shortId(e.target_user_id)}</td>
                <td className="px-3 py-2"><span className="rounded bg-[var(--nl-blue,#0066FF)]/15 text-[var(--nl-blue-lighter,#4D6BFF)] px-1.5 py-0.5 text-[10px] font-semibold">{e.action}</span></td>
                <td className="px-3 py-2 max-w-md">
                  <pre className="text-[10px] text-slate-300 whitespace-pre-wrap break-all leading-relaxed">{e.details ? JSON.stringify(e.details, null, 0) : '—'}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
