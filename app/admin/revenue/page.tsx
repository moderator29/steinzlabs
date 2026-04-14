'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Download, TrendingUp, Loader2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface AnalyticsData {
  revenue: {
    totalFeesUsd: number;
    feesToday: number;
    feesThisMonth: number;
    projectedMonthly: number;
    dailyFeesChart: Array<{ date: string; fees: number }>;
    chainFees: Record<number, number>;
  };
  volume: {
    totalTrades: number;
    standardCount: number;
    gaslessCount: number;
    gaslessRatio: number;
  };
  topTraders: Array<{ wallet: string; volume: number }>;
  trades: Array<{
    txHash: string;
    chainId: number;
    sellToken: string;
    buyToken: string;
    sellAmountUsd: string;
    feeUsd: string;
    taker: string;
    timestamp: string;
  }>;
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum',
  137: 'Polygon', 43114: 'Avalanche', 56: 'BNB', 10: 'Optimism',
};

function fmtUsd(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

function exportCSV(trades: AnalyticsData['trades']) {
  const header = 'TxHash,Chain,Sell,Buy,Amount USD,Fee USD,Taker,Time\n';
  const body = trades.map(t =>
    `${t.txHash},${CHAIN_NAMES[t.chainId] || t.chainId},${t.sellToken},${t.buyToken},${t.sellAmountUsd},${t.feeUsd},${t.taker},${t.timestamp}`
  ).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'steinz_revenue_export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/admin')
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-500">
        No analytics data available. Trades will appear here after swaps are executed.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Revenue Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Powered by 0x Trade Analytics — real fee data
          </p>
        </div>
        <button onClick={() => exportCSV(data.trades)}
          className="flex items-center gap-2 text-xs border border-[#1E2433] text-gray-300 hover:text-white px-3 py-2 rounded-lg">
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'All-Time Fees', value: fmtUsd(data.revenue.totalFeesUsd) },
          { label: 'This Month', value: fmtUsd(data.revenue.feesThisMonth) },
          { label: 'Today', value: fmtUsd(data.revenue.feesToday) },
          { label: 'Projected Monthly', value: fmtUsd(data.revenue.projectedMonthly) },
        ].map(k => (
          <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">{k.label}</div>
            <div className="text-lg font-bold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Daily Fees Chart */}
      <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Daily Fee Revenue (30d)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data.revenue.dailyFeesChart}>
            <defs>
              <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0A1EFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0A1EFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
            <Area type="monotone" dataKey="fees" stroke="#0A1EFF" fill="url(#feeGrad)" strokeWidth={2} name="Fees USD" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <div className="text-xs text-gray-400">Total Trades</div>
          <div className="text-lg font-bold text-white">{data.volume.totalTrades}</div>
        </div>
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <div className="text-xs text-gray-400">Gasless Trades</div>
          <div className="text-lg font-bold text-white">{data.volume.gaslessCount}</div>
        </div>
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <div className="text-xs text-gray-400">Gasless Adoption</div>
          <div className="text-lg font-bold text-white">
            {(data.volume.gaslessRatio * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Recent Trades Table */}
      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E2433]">
          <h3 className="text-sm font-semibold text-white">Trade History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#1E2433]">
              <tr>
                {['Pair', 'Chain', 'Amount', 'Fee', 'Trader', 'Time'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.trades.slice(0, 50).map((t, i) => (
                <tr key={i} className="border-b border-[#1E2433] last:border-0">
                  <td className="px-4 py-2 text-white">{t.sellToken}/{t.buyToken}</td>
                  <td className="px-4 py-2 text-gray-400">{CHAIN_NAMES[t.chainId] || t.chainId}</td>
                  <td className="px-4 py-2 text-gray-300">${parseFloat(t.sellAmountUsd || '0').toFixed(2)}</td>
                  <td className="px-4 py-2 text-green-400">${parseFloat(t.feeUsd || '0').toFixed(4)}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono">{t.taker ? `${t.taker.slice(0, 6)}...${t.taker.slice(-4)}` : '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{new Date(t.timestamp).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
