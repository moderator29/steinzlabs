'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pause, Play, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface CronSummary {
  name: string;
  lastStatus: 'success' | 'failed' | 'timeout' | null;
  lastRunAt: string | null;
  lastDurationMs: number | null;
  successRate24h: number;
  runs24h: number;
  paused: boolean;
}

function relTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '—';
  if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}h ago`;
  return `${Math.floor(diffMs / 86_400_000)}d ago`;
}

export default function CronMonitorPage() {
  const [rows, setRows] = useState<CronSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/crons', { headers: adminHeaders() });
      if (!res.ok) { setError(`HTTP ${res.status}`); return; }
      const j = await res.json() as { crons: CronSummary[] };
      setRows(j.crons ?? []);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggle = async (name: string, paused: boolean) => {
    setBusy(name);
    try {
      const res = await fetch('/api/admin/crons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ name, action: paused ? 'resume' : 'pause' }),
      });
      if (!res.ok) { setError(`Toggle failed: ${res.status}`); return; }
      await load();
    } finally {
      setBusy(null);
    }
  };

  const trigger = async (name: string) => {
    setBusy(name + ':run');
    try {
      const res = await fetch(`/api/cron/${name}`, { headers: adminHeaders() });
      if (!res.ok) setError(`Trigger failed: ${res.status}`);
      else setTimeout(() => void load(), 1500);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen text-white p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl font-bold mb-1">Cron Monitor</h1>
        <p className="text-sm text-slate-400 mb-6">Live status of every scheduled job + pause/resume switches.</p>

        {error && <div className="mb-4 text-sm text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-4 py-2">{error}</div>}
        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading crons…</div>
        ) : (
          <div className="overflow-x-auto nl-glass rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-white/10">
                  <th className="px-4 py-3">Cron</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Last run</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3">24h success</th>
                  <th className="px-3 py-3">24h runs</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs">{r.name}{r.paused && <span className="ms-2 text-[10px] text-amber-300">PAUSED</span>}</td>
                    <td className="px-3 py-2.5">
                      {r.lastStatus === 'success' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="w-3.5 h-3.5" /> success</span>
                      ) : r.lastStatus === 'failed' || r.lastStatus === 'timeout' ? (
                        <span className="inline-flex items-center gap-1 text-red-300"><AlertTriangle className="w-3.5 h-3.5" /> {r.lastStatus}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-500"><Clock className="w-3.5 h-3.5" /> idle</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-300">{relTime(r.lastRunAt)}</td>
                    <td className="px-3 py-2.5 text-slate-300">{r.lastDurationMs != null ? `${r.lastDurationMs}ms` : '—'}</td>
                    <td className="px-3 py-2.5 text-slate-300">{r.successRate24h}%</td>
                    <td className="px-3 py-2.5 text-slate-300">{r.runs24h}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => void trigger(r.name)}
                        disabled={busy !== null}
                        className="text-[11px] text-blue-300 hover:text-blue-200 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 rounded-lg px-2 py-0.5 me-2 disabled:opacity-50"
                      >
                        {busy === r.name + ':run' ? 'Running…' : 'Run now'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggle(r.name, r.paused)}
                        disabled={busy !== null}
                        className={`text-[11px] rounded-lg px-2 py-0.5 border disabled:opacity-50 ${r.paused ? 'text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25' : 'text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/25'}`}
                      >
                        {r.paused ? <Play className="w-3 h-3 inline" /> : <Pause className="w-3 h-3 inline" />}
                        {r.paused ? ' Resume' : ' Pause'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function adminHeaders(): HeadersInit {
  // The existing admin pages keep the bearer token in sessionStorage so
  // the static ADMIN_BEARER_TOKEN never lands in localStorage. Read it
  // defensively — the auth route returns 401 if absent.
  if (typeof window === 'undefined') return {};
  // The admin layout stores the bearer under 'admin_token'; this page read
  // 'admin_bearer', so every request 401'd and the monitor stayed blank.
  const tok = sessionStorage.getItem('admin_token');
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}
