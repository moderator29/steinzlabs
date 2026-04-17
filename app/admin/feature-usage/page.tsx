'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { formatLargeNumber } from '@/lib/formatters';
import { Zap, RefreshCw } from 'lucide-react';

interface Feature {
  name: string;
  usage_count: number;
  unique_users: number;
}

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function FeatureUsagePage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/feature-usage', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.features)) {
          setFeatures(data.features.map((f: Record<string, unknown>) => ({
            name: (f.name as string) || 'Unknown',
            usage_count: Number(f.usage_count) || 0,
            unique_users: Number(f.unique_users) || 0,
          })));
        }
      }
    } catch (err) {
      console.error('[feature-usage] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalUsage = features.reduce((s, f) => s + f.usage_count, 0);
  const isEmpty = !loading && features.length === 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Feature Usage Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Usage counts and unique users per feature (last 30 days)</p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 text-gray-400 hover:text-white border border-[#1E2433] rounded-lg hover:border-[#2E3443] transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && features.length === 0 && (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Loading feature usage...</span>
        </div>
      )}

      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Zap className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-sm text-gray-400">No feature usage data yet</p>
          <p className="text-xs text-gray-600 mt-1">Stats will populate as users start interacting with platform features</p>
        </div>
      )}

      {!isEmpty && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Usage Events (30d)', value: formatLargeNumber(totalUsage) },
              { label: 'Tracked Features', value: features.length.toString() },
              { label: 'Top Feature', value: features[0]?.name ?? '—' },
            ].map(k => (
              <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
                <div className="text-xs text-gray-400 mb-2">{k.label}</div>
                <div className="text-xl font-bold text-white">{k.value}</div>
              </div>
            ))}
          </div>

          <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-white mb-4">Usage by Feature</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={features} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#6B7280' }} tickFormatter={v => formatLargeNumber(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#6B7280' }} width={120} />
                <Tooltip formatter={(v: number) => formatLargeNumber(v)} contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
                <Bar dataKey="usage_count" fill="#0A1EFF" radius={[0, 2, 2, 0]} name="Usage" />
                <Bar dataKey="unique_users" fill="#7C3AED" radius={[0, 2, 2, 0]} name="Unique users" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden overflow-x-auto">
            <div className="px-4 py-3 border-b border-[#1E2433]">
              <h3 className="text-sm font-semibold text-white">Feature Engagement Table</h3>
            </div>
            <table className="w-full text-xs min-w-[600px]">
              <thead className="border-b border-[#1E2433]">
                <tr>{['Feature', 'Usage Count', 'Unique Users', 'Avg Events / User'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {features.map(f => (
                  <tr key={f.name} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Zap className="w-3 h-3 text-[#0A1EFF]" />
                        <span className="text-white font-medium">{f.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white font-semibold">{formatLargeNumber(f.usage_count)}</td>
                    <td className="px-4 py-3 text-gray-300">{formatLargeNumber(f.unique_users)}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {f.unique_users > 0 ? (f.usage_count / f.unique_users).toFixed(1) : '—'}
                    </td>
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
