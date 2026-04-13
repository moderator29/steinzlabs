'use client';

import { useState, useCallback } from 'react';
import { DollarSign, Download, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { formatUSD, formatLargeNumber } from '@/lib/formatters';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REVENUE_DATA = MONTHS.map((month, i) => ({
  month,
  subscriptions: Math.floor(3000 + i * 400 + Math.random() * 500),
  swapFees:      Math.floor(1000 + i * 200 + Math.random() * 300),
  apiUsage:      Math.floor(500  + i * 100 + Math.random() * 200),
}));

const FEE_ROWS = [
  { chain: 'Ethereum', swaps: 1240, volume: 4_200_000, fees: 12_600, avgFee: 10.16 },
  { chain: 'Solana',   swaps: 3820, volume: 9_100_000, fees: 18_200, avgFee: 4.76 },
  { chain: 'Base',     swaps: 2100, volume: 3_500_000, fees:  7_000, avgFee: 3.33 },
  { chain: 'Arbitrum', swaps:  890, volume: 2_100_000, fees:  5_250, avgFee: 5.90 },
  { chain: 'BSC',      swaps: 1560, volume: 1_800_000, fees:  2_700, avgFee: 1.73 },
];

function exportCSV(rows: typeof FEE_ROWS) {
  const header = 'Chain,Swaps,Volume USD,Fees USD,Avg Fee USD\n';
  const body = rows.map(r => `${r.chain},${r.swaps},${r.volume},${r.fees},${r.avgFee}`).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'revenue_fees.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminRevenuePage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const totalRevenue = REVENUE_DATA.reduce((s, r) => s + r.subscriptions + r.swapFees + r.apiUsage, 0);
  const totalFees = FEE_ROWS.reduce((s, r) => s + r.fees, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Revenue</h1>
          <p className="text-xs text-gray-500 mt-0.5">Fee tracking, subscription revenue, and API billing</p>
        </div>
        <button onClick={() => exportCSV(FEE_ROWS)} className="flex items-center gap-2 text-xs border border-[#1E2433] text-gray-300 hover:text-white px-3 py-2 rounded-lg hover:border-[#2E3443] transition-colors">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Revenue (YTD)', value: formatUSD(totalRevenue), change: '+18.4%', up: true },
          { label: 'Swap Fees (30d)', value: formatUSD(totalFees), change: '+9.1%', up: true },
          { label: 'Avg Revenue / User', value: formatUSD(totalRevenue / 50247), change: '-2.3%', up: false },
        ].map(k => (
          <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">{k.label}</div>
            <div className="text-xl font-bold text-white mb-1">{k.value}</div>
            <div className={`flex items-center gap-1 text-xs ${k.up ? 'text-green-400' : 'text-red-400'}`}>
              {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {k.change} vs last period
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Revenue Breakdown</h3>
          <div className="flex gap-1">
            {(['7d', '30d', '90d', '1y'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${period === p ? 'bg-[#0A1EFF] text-white' : 'text-gray-400 hover:text-white hover:bg-[#1E2433]'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={REVENUE_DATA}>
            <defs>
              {['subscriptions', 'swapFees', 'apiUsage'].map((key, i) => (
                <linearGradient key={key} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={['#0A1EFF', '#7C3AED', '#059669'][i]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={['#0A1EFF', '#7C3AED', '#059669'][i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={v => `$${v / 1000}k`} />
            <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => formatUSD(v)} />
            <Area type="monotone" dataKey="subscriptions" stroke="#0A1EFF" fill="url(#grad0)" strokeWidth={2} name="Subscriptions" />
            <Area type="monotone" dataKey="swapFees" stroke="#7C3AED" fill="url(#grad1)" strokeWidth={2} name="Swap Fees" />
            <Area type="monotone" dataKey="apiUsage" stroke="#059669" fill="url(#grad2)" strokeWidth={2} name="API Usage" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E2433] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Fee Data by Chain</h3>
          <span className="text-xs text-gray-500">Last 30 days</span>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-[#1E2433]">
            <tr>{['Chain', 'Swaps', 'Volume', 'Fees Collected', 'Avg Fee'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {FEE_ROWS.map(r => (
              <tr key={r.chain} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                <td className="px-4 py-2.5 text-white font-medium">{r.chain}</td>
                <td className="px-4 py-2.5 text-gray-300">{r.swaps.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-gray-300">{formatUSD(r.volume, { compact: true })}</td>
                <td className="px-4 py-2.5 text-green-400 font-medium">{formatUSD(r.fees)}</td>
                <td className="px-4 py-2.5 text-gray-300">{formatUSD(r.avgFee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
