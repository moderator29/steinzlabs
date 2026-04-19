'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, TrendingUp, Inbox } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';

interface TopQuery { query: string; count: number; chain: string; noResults: boolean; }
interface RecentQuery { query: string; userId: string; timestamp: number; found: boolean; }
interface HourlyBucket { hour: string; searches: number; }
interface LogsPayload {
  totalSearches: number;
  uniqueQueries: number;
  noResultRatePct: number;
  top: TopQuery[];
  recent: RecentQuery[];
  hourly: HourlyBucket[];
}

const EMPTY: LogsPayload = {
  totalSearches: 0,
  uniqueQueries: 0,
  noResultRatePct: 0,
  top: [],
  recent: [],
  hourly: Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, searches: 0 })),
};

export default function SearchLogsPage() {
  const [data, setData] = useState<LogsPayload>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/search-logs', {
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Partial<LogsPayload>;
        if (cancelled) return;
        setData({ ...EMPTY, ...json });
      } catch {
        // endpoint missing or errored — keep the empty state, don't fabricate.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasData = data.top.length > 0 || data.recent.length > 0 || data.totalSearches > 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Search Logs</h1>
        <p className="text-xs text-gray-500 mt-0.5">Token and wallet search analytics — top queries and empty results</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total Searches (30d)', value: data.totalSearches.toLocaleString() },
          { label: 'Unique Queries', value: data.uniqueQueries.toLocaleString() },
          { label: 'No-Result Rate', value: `${data.noResultRatePct}%` },
        ].map((k) => (
          <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold text-white">{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      {!hasData && !loading ? (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-10 text-center">
          <Inbox className="w-8 h-8 text-gray-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white">No search activity yet</p>
          <p className="text-xs text-gray-500 mt-1">Search logs will populate here as users query tokens and wallets.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Searches by Hour (Today)</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.hourly}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#6B7280' }} interval={5} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="searches" fill="#0A1EFF" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-white mb-4">Top Search Queries</h3>
              {data.top.length === 0 ? (
                <p className="text-xs text-gray-500 py-8 text-center">No queries logged yet.</p>
              ) : (
                <div className="space-y-2">
                  {data.top.slice(0, 6).map((q, i) => (
                    <div key={q.query} className="flex items-center gap-3 text-xs">
                      <span className="text-gray-600 font-mono w-4">{i + 1}</span>
                      <span className={`flex-1 font-medium truncate ${q.noResults ? 'text-red-400' : 'text-white'}`}>{q.query}</span>
                      <span className="text-[10px] font-mono bg-[#1E2433] text-gray-400 px-1.5 py-0.5 rounded">{q.chain}</span>
                      <span className="text-gray-400 w-12 text-right">{q.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E2433] flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-[#0A1EFF]" />
                <h3 className="text-sm font-semibold text-white">Trending Searches</h3>
              </div>
              <div className="p-4 space-y-2 overflow-x-auto">
                {data.top.length === 0 ? (
                  <p className="text-xs text-gray-500">No trends yet.</p>
                ) : data.top.map((q, i) => (
                  <div key={q.query} className="flex items-center gap-3 text-xs">
                    <span className="text-gray-600 w-4 font-mono">{i + 1}</span>
                    <span className="flex-1 text-gray-200 font-medium truncate">{q.query}</span>
                    {q.noResults && <span className="text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">No results</span>}
                    <span className="text-gray-500 font-mono">{q.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1E2433] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[#0A1EFF]" />
                <h3 className="text-sm font-semibold text-white">Recent Searches</h3>
              </div>
              <div className="divide-y divide-[#1E2433] overflow-x-auto">
                {data.recent.length === 0 ? (
                  <p className="text-xs text-gray-500 p-4">No recent searches.</p>
                ) : data.recent.map((s, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-xs hover:bg-[#1E2433]/30">
                    <span className={`font-mono font-medium truncate ${s.found ? 'text-white' : 'text-red-400'}`}>{s.query}</span>
                    <span className="flex-1 text-gray-500 truncate">{s.userId}</span>
                    {!s.found && <span className="text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">No results</span>}
                    <span className="text-gray-600">{formatTimeAgo(s.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
