'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Brain, RefreshCw, Users } from 'lucide-react';
import { formatLargeNumber } from '@/lib/formatters';

interface TopUser {
  user_id: string;
  count: number;
}

interface AnalyticsData {
  totalQueries: number;
  queriesToday: number;
  queriesWeek: number;
  topUsers: TopUser[];
}

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

const EMPTY: AnalyticsData = { totalQueries: 0, queriesToday: 0, queriesWeek: 0, topUsers: [] };

export default function VtxAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/vtx-analytics', { headers: authHeader() });
      if (res.ok) {
        const payload = await res.json();
        setData({
          totalQueries: Number(payload.totalQueries) || 0,
          queriesToday: Number(payload.queriesToday) || 0,
          queriesWeek: Number(payload.queriesWeek) || 0,
          topUsers: Array.isArray(payload.topUsers) ? payload.topUsers : [],
        });
      }
    } catch (err) {
      console.error('[vtx-analytics] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isEmpty = !loading && data.totalQueries === 0 && data.topUsers.length === 0;
  const chartData = data.topUsers.map(u => ({
    user: u.user_id.length > 8 ? `${u.user_id.slice(0, 8)}…` : u.user_id,
    full: u.user_id,
    count: u.count,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">VTX Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">VTX AI conversation volume and top users</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 text-gray-400 hover:text-white border border-[#1E2433] rounded-lg hover:border-[#2E3443] transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && data.totalQueries === 0 && (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Loading VTX analytics...</span>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Brain className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-sm text-gray-400">No VTX conversations yet</p>
          <p className="text-xs text-gray-600 mt-1">Stats will populate once users start interacting with VTX AI</p>
        </div>
      )}

      {!isEmpty && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Queries', value: formatLargeNumber(data.totalQueries) },
              { label: 'Queries Today', value: formatLargeNumber(data.queriesToday) },
              { label: 'Queries This Week', value: formatLargeNumber(data.queriesWeek) },
            ].map(k => (
              <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-2">{k.label}</div>
                <div className="text-xl font-bold text-white">{k.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-white mb-4">Top Users by Query Count (30d)</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={v => formatLargeNumber(v)} />
                  <YAxis type="category" dataKey="user" tick={{ fontSize: 9, fill: '#6B7280' }} width={100} />
                  <Tooltip formatter={(v: number) => formatLargeNumber(v)} contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="count" fill="#0A1EFF" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-gray-500 py-6 text-center">No top user data available</div>
            )}
          </div>

          <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-[#1E2433] flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[#0A1EFF]" />
              <h3 className="text-sm font-semibold text-white">Top Users (30d)</h3>
            </div>
            <table className="w-full text-xs min-w-[500px]">
              <thead className="border-b border-[#1E2433]">
                <tr>{['#', 'User ID', 'Query Count'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {data.topUsers.map((u, i) => (
                  <tr key={u.user_id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                    <td className="px-4 py-3 text-gray-500 font-mono">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-mono">{u.user_id}</td>
                    <td className="px-4 py-3 text-white font-semibold">{u.count.toLocaleString()}</td>
                  </tr>
                ))}
                {data.topUsers.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">No users with VTX queries yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
