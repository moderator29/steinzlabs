'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { formatLargeNumber } from '@/lib/formatters';
import { Zap } from 'lucide-react';

const FEATURES = [
  { name: 'Context Feed',      dau: 18420, mau: 42100, sessions: 284000, avgSessionMin: 14.2, retention7d: 68 },
  { name: 'Security Scan',     dau: 12840, mau: 31200, sessions: 187000, avgSessionMin: 3.8,  retention7d: 45 },
  { name: 'Smart Money Feed',  dau: 9820,  mau: 24600, sessions: 143000, avgSessionMin: 11.5, retention7d: 58 },
  { name: 'Wallet Tracer',     dau: 7240,  mau: 19800, sessions: 84200,  avgSessionMin: 6.1,  retention7d: 42 },
  { name: 'Portfolio Tracker', dau: 6180,  mau: 18400, sessions: 72400,  avgSessionMin: 8.3,  retention7d: 71 },
  { name: 'Swap',              dau: 3420,  mau: 9800,  sessions: 28400,  avgSessionMin: 4.2,  retention7d: 52 },
  { name: 'VTX AI Predictions',dau: 2840,  mau: 8200,  sessions: 18600,  avgSessionMin: 5.7,  retention7d: 63 },
  { name: 'DNA Analyzer',      dau: 1940,  mau: 5600,  sessions: 12400,  avgSessionMin: 9.1,  retention7d: 38 },
];

const TREND_DATA = Array.from({ length: 14 }, (_, i) => ({
  day: `Day ${i + 1}`,
  feed: 15000 + i * 400,
  swap: 2800 + i * 100,
  wallet: 6000 + i * 150,
}));

export default function FeatureUsagePage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Feature Usage Analytics</h1>
        <p className="text-xs text-gray-500 mt-0.5">DAU, MAU, session metrics, and feature retention rates</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Active Users by Feature (DAU)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={FEATURES} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 9, fill: '#6B7280' }} tickFormatter={v => formatLargeNumber(v)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#6B7280' }} width={110} />
              <Tooltip formatter={(v: number) => formatLargeNumber(v)} contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="dau" fill="#0A1EFF" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">14-Day DAU Trend (Top Features)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={TREND_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
              <XAxis dataKey="day" hide />
              <YAxis tick={{ fontSize: 9, fill: '#6B7280' }} tickFormatter={v => formatLargeNumber(v)} />
              <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => formatLargeNumber(v)} />
              <Line type="monotone" dataKey="feed"   stroke="#0A1EFF" strokeWidth={2} dot={false} name="Context Feed" />
              <Line type="monotone" dataKey="wallet" stroke="#7C3AED" strokeWidth={2} dot={false} name="Wallet Tracer" />
              <Line type="monotone" dataKey="swap"   stroke="#059669" strokeWidth={2} dot={false} name="Swap" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E2433]">
          <h3 className="text-sm font-semibold text-white">Feature Engagement Table</h3>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-[#1E2433]">
            <tr>{['Feature', 'DAU', 'MAU', 'DAU/MAU', 'Avg Session', 'Sessions (30d)', '7d Retention'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {FEATURES.map(f => (
              <tr key={f.name} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-[#0A1EFF]" />
                    <span className="text-white font-medium">{f.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-white font-semibold">{formatLargeNumber(f.dau)}</td>
                <td className="px-4 py-3 text-gray-300">{formatLargeNumber(f.mau)}</td>
                <td className="px-4 py-3">
                  <span className={`font-semibold ${f.dau / f.mau > 0.5 ? 'text-green-400' : f.dau / f.mau > 0.3 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {(f.dau / f.mau * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{f.avgSessionMin}m</td>
                <td className="px-4 py-3 text-gray-300">{formatLargeNumber(f.sessions)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-[#0A0E1A] rounded-full h-1.5">
                      <div className="bg-[#0A1EFF] h-1.5 rounded-full" style={{ width: `${f.retention7d}%` }} />
                    </div>
                    <span className={`font-semibold ${f.retention7d >= 60 ? 'text-green-400' : f.retention7d >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>{f.retention7d}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
