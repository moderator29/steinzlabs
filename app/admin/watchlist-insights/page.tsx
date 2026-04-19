'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Eye, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { formatLargeNumber } from '@/lib/formatters';

interface WatchedToken {
  token_id: string;
  token_symbol: string;
  watcher_count: number;
}

interface InsightsData {
  tokens: WatchedToken[];
  totalWatches: number;
  uniqueUsers: number;
}

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const EMPTY: InsightsData = { tokens: [], totalWatches: 0, uniqueUsers: 0 };

export default function WatchlistInsightsPage() {
  const [data, setData] = useState<InsightsData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/watchlist-insights', { headers: authHeader() });
      if (res.ok) {
        const payload = await res.json();
        setData({
          tokens: Array.isArray(payload.tokens) ? payload.tokens : [],
          totalWatches: Number(payload.totalWatches) || 0,
          uniqueUsers: Number(payload.uniqueUsers) || 0,
        });
      }
    } catch (err) {
      console.error('[watchlist-insights] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isEmpty = !loading && data.tokens.length === 0;
  const avgPerUser = data.uniqueUsers > 0 ? (data.totalWatches / data.uniqueUsers).toFixed(1) : '0.0';
  const chartData = data.tokens.slice(0, 10).map(t => ({
    symbol: t.token_symbol,
    count: t.watcher_count,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Watchlist Insights</h1>
          <p className="text-xs text-gray-500 mt-0.5">Most watched tokens across the platform</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 text-gray-400 hover:text-white border border-[#1E2433] rounded-lg hover:border-[#2E3443] transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && data.tokens.length === 0 && (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Loading watchlist insights...</span>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Eye className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-sm text-gray-400">No watchlist activity yet</p>
          <p className="text-xs text-gray-600 mt-1">Tokens will appear here once users start adding them to watchlists</p>
        </div>
      )}

      {!isEmpty && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
            {[
              { icon: Eye, label: 'Total Watchlist Items', value: formatLargeNumber(data.totalWatches) },
              { icon: Users, label: 'Users with Watchlists', value: formatLargeNumber(data.uniqueUsers) },
              { icon: TrendingUp, label: 'Avg Items / User', value: avgPerUser },
            ].map(k => (
              <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 flex items-center gap-3">
                <div className="w-9 h-9 bg-[#0A1EFF]/10 rounded-xl flex items-center justify-center">
                  <k.icon className="w-4 h-4 text-[#0A1EFF]" />
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{k.value}</div>
                  <div className="text-xs text-gray-400">{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4">
            <h3 className="text-sm font-semibold text-white mb-4">Top 10 Watched Tokens</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                <XAxis dataKey="symbol" tick={{ fontSize: 10, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={v => formatLargeNumber(v)} />
                <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => formatLargeNumber(v)} />
                <Bar dataKey="count" fill="#0A1EFF" radius={[2, 2, 0, 0]} name="Watchers" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-[#1E2433]">
              <h3 className="text-sm font-semibold text-white">Top Watched Tokens</h3>
            </div>
            <table className="w-full text-xs min-w-[600px]">
              <thead className="border-b border-[#1E2433]">
                <tr>{['#', 'Symbol', 'Token ID', 'Watcher Count'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {data.tokens.map((t, i) => (
                  <tr key={`${t.token_id}-${i}`} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                    <td className="px-4 py-3 text-gray-500 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-bold">{t.token_symbol}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-[10px] truncate max-w-[280px]">{t.token_id}</td>
                    <td className="px-4 py-3 text-white font-semibold">{t.watcher_count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
