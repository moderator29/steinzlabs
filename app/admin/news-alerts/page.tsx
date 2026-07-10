'use client';

import { useState, useEffect, useCallback } from 'react';
import { Newspaper, RefreshCw, Send, Mail, Bell, MessageSquare, CheckCircle2, XCircle } from 'lucide-react';

interface Run {
  id: string;
  status: string | null;
  duration_ms: number | null;
  items_processed: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}
interface NewsData {
  cronName: string;
  reach: { opted_in: number; telegram: number; email: number; push: number };
  recentRuns: Run[];
}

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}` };
}

export default function NewsAlertsPage() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/news-alerts', { headers: authHeader() });
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error('[admin/news-alerts] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const reach = data?.reach;
  const channels = [
    { label: 'Opted In', value: reach?.opted_in ?? 0, icon: Send, accent: 'text-[#0066FF]' },
    { label: 'Telegram', value: reach?.telegram ?? 0, icon: MessageSquare, accent: 'text-white' },
    { label: 'Email', value: reach?.email ?? 0, icon: Mail, accent: 'text-white' },
    { label: 'Push', value: reach?.push ?? 0, icon: Bell, accent: 'text-white' },
  ];
  const lastRun = data?.recentRuns[0];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">News Alerts / Digest</h1>
          <p className="text-xs text-gray-500 mt-0.5">Opt-in reach by channel and delivery health of the notification digest</p>
        </div>
        <button onClick={load} disabled={loading} className="nl-button nl-button--ghost">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {channels.map((c) => (
          <div key={c.label} className="nl-glass rounded-2xl p-4">
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1">
              <c.icon className="w-3.5 h-3.5" />{c.label}
            </div>
            <div className={`text-xl font-bold tabular-nums ${c.accent}`}>{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="nl-glass rounded-2xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Last Digest Send</h3>
        {loading && !data ? (
          <div className="text-xs text-gray-500">Loading...</div>
        ) : !lastRun ? (
          <p className="text-xs text-gray-500">No digest runs recorded yet for cron <span className="font-mono text-gray-400">{data?.cronName}</span>.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1">Status</div>
              <div className={`font-semibold inline-flex items-center gap-1 ${lastRun.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {lastRun.status === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                {lastRun.status ?? 'unknown'}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1">Items Sent</div>
              <div className="text-white font-semibold tabular-nums">{lastRun.items_processed ?? '-'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1">Duration</div>
              <div className="text-white font-semibold tabular-nums">{lastRun.duration_ms != null ? `${lastRun.duration_ms}ms` : '-'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-gray-500 mb-1">When</div>
              <div className="text-white font-semibold">{lastRun.started_at ? new Date(lastRun.started_at).toLocaleString() : '-'}</div>
            </div>
          </div>
        )}
      </div>

      <div className="nl-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10"><h3 className="text-sm font-semibold text-white">Recent Digest Runs</h3></div>
        {(data?.recentRuns.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Newspaper className="w-8 h-8 text-gray-700 mb-2" />
            <p className="text-sm text-gray-400">No runs logged yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead className="border-b border-white/10"><tr>
                {['Status', 'Items', 'Duration', 'Started', 'Error'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-start text-gray-500 font-medium">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data!.recentRuns.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className={`px-4 py-2.5 capitalize font-medium ${r.status === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{r.status ?? 'unknown'}</td>
                    <td className="px-4 py-2.5 text-gray-300 tabular-nums">{r.items_processed ?? '-'}</td>
                    <td className="px-4 py-2.5 text-gray-300 tabular-nums">{r.duration_ms != null ? `${r.duration_ms}ms` : '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500">{r.started_at ? new Date(r.started_at).toLocaleString() : '-'}</td>
                    <td className="px-4 py-2.5 text-red-400/80 max-w-xs truncate">{r.error_message ?? ''}</td>
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
