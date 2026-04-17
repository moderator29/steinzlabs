'use client';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatUSD, formatLargeNumber } from '@/lib/formatters';

const COST_BREAKDOWN = [
  { service: 'Anthropic Claude API',   cost: 4280, calls: 24800, avgCost: 0.17 },
  { service: 'Alchemy Solana RPC',     cost: 0,    calls: 890000, avgCost: 0 },
  { service: 'Alchemy',                cost: 980,  calls: 520000, avgCost: 0.002 },
  { service: 'DexScreener',            cost: 0,    calls: 180000, avgCost: 0 },
  { service: 'CoinGecko Pro',          cost: 499,  calls: 320000, avgCost: 0.002 },
  { service: 'Birdeye',                cost: 680,  calls: 142000, avgCost: 0.005 },
  { service: 'Supabase',               cost: 350,  calls: 0,      avgCost: 0 },
];

const PIE_DATA = COST_BREAKDOWN.filter(c => c.cost > 0).map(c => ({ name: c.service.split(' ')[0], value: c.cost }));
const PIE_COLORS = ['#0A1EFF', '#7C3AED', '#059669', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899'];

const FEATURE_USAGE = [
  { feature: 'Security Scan',      calls: 48200, revenue: 0 },
  { feature: 'Context Feed',       calls: 124000, revenue: 0 },
  { feature: 'VTX AI Analysis',    calls: 18400, revenue: 3680 },
  { feature: 'Smart Money Feed',   calls: 72000, revenue: 0 },
  { feature: 'Swap Execution',     calls: 6200,  revenue: 18600 },
  { feature: 'Wallet Tracer',      calls: 31000, revenue: 0 },
  { feature: 'Portfolio Tracker',  calls: 52000, revenue: 0 },
];

export default function VtxAnalyticsPage() {
  const totalCost = COST_BREAKDOWN.reduce((s, c) => s + c.cost, 0);
  const totalCalls = COST_BREAKDOWN.reduce((s, c) => s + c.calls, 0);
  const totalRevenue = FEATURE_USAGE.reduce((s, f) => s + f.revenue, 0);
  const margin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1) : '0';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">VTX Analytics</h1>
        <p className="text-xs text-gray-500 mt-0.5">API cost breakdown, call volume, and revenue attribution</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total API Cost (30d)', value: formatUSD(totalCost) },
          { label: 'Total API Calls', value: formatLargeNumber(totalCalls) },
          { label: 'Attribution Revenue', value: formatUSD(totalRevenue) },
          { label: 'Gross Margin', value: `${margin}%` },
        ].map(k => (
          <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">{k.label}</div>
            <div className="text-xl font-bold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Cost by Service</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={PIE_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {PIE_DATA.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatUSD(v)} contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Feature Call Volume</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={FEATURE_USAGE} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={v => formatLargeNumber(v)} />
              <YAxis type="category" dataKey="feature" tick={{ fontSize: 9, fill: '#6B7280' }} width={100} />
              <Tooltip formatter={(v: number) => formatLargeNumber(v)} contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="calls" fill="#0A1EFF" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden overflow-x-auto">
        <div className="px-4 py-3 border-b border-[#1E2433]">
          <h3 className="text-sm font-semibold text-white">Cost Breakdown by Service</h3>
        </div>
        <table className="w-full text-xs min-w-[700px]">
          <thead className="border-b border-[#1E2433]">
            <tr>{['Service', 'API Calls', 'Cost (30d)', 'Avg Cost / Call', '% of Total'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {COST_BREAKDOWN.map(r => (
              <tr key={r.service} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                <td className="px-4 py-3 text-white font-medium">{r.service}</td>
                <td className="px-4 py-3 text-gray-300">{r.calls.toLocaleString()}</td>
                <td className="px-4 py-3 text-white font-semibold">{r.cost === 0 ? 'Free' : formatUSD(r.cost)}</td>
                <td className="px-4 py-3 font-mono text-gray-400">{r.avgCost === 0 ? '—' : `$${r.avgCost.toFixed(3)}`}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#0A0E1A] rounded-full h-1.5 w-20">
                      <div className="bg-[#0A1EFF] h-1.5 rounded-full" style={{ width: `${(r.cost / totalCost * 100).toFixed(0)}%` }} />
                    </div>
                    <span className="text-gray-400">{totalCost > 0 ? (r.cost / totalCost * 100).toFixed(1) : 0}%</span>
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
