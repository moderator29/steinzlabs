'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Eye, TrendingUp, Users } from 'lucide-react';
import { formatLargeNumber } from '@/lib/formatters';

const TOP_WATCHED = [
  { token: 'PEPE', symbol: 'PEPE',  chain: 'ETH', watchlistCount: 8420, change7d: 12 },
  { token: 'BONK', symbol: 'BONK',  chain: 'SOL', watchlistCount: 7140, change7d: 8 },
  { token: 'WIF',  symbol: 'WIF',   chain: 'SOL', watchlistCount: 6820, change7d: -3 },
  { token: 'WOJAK',symbol: 'WOJAK', chain: 'BASE',watchlistCount: 4210, change7d: 45 },
  { token: 'FLOKI',symbol: 'FLOKI', chain: 'BSC', watchlistCount: 3980, change7d: 2 },
  { token: 'MEME', symbol: 'MEME',  chain: 'ETH', watchlistCount: 3640, change7d: -7 },
  { token: 'BRETT',symbol: 'BRETT', chain: 'BASE',watchlistCount: 3120, change7d: 18 },
  { token: 'MOG',  symbol: 'MOG',   chain: 'ETH', watchlistCount: 2840, change7d: 22 },
];

const DAILY_ADDS = Array.from({ length: 14 }, (_, i) => ({
  day: `Day ${i + 1}`, adds: 150 + i * 20, removes: 30 + i * 5,
}));

export default function WatchlistInsightsPage() {
  const totalWatches = TOP_WATCHED.reduce((s, t) => s + t.watchlistCount, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Watchlist Insights</h1>
        <p className="text-xs text-gray-500 mt-0.5">Most watched tokens and watchlist activity trends</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: Eye, label: 'Total Watchlist Items', value: formatLargeNumber(totalWatches) },
          { icon: Users, label: 'Users with Watchlists', value: formatLargeNumber(28420) },
          { icon: TrendingUp, label: 'Avg Items / User', value: (totalWatches / 28420).toFixed(1) },
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

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Daily Watchlist Activity (14d)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={DAILY_ADDS}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="adds" fill="#059669" radius={[2, 2, 0, 0]} name="Added" />
              <Bar dataKey="removes" fill="#EF4444" radius={[2, 2, 0, 0]} name="Removed" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Top Watched by Chain</h3>
          <div className="space-y-2">
            {[['SOL', 14_320], ['ETH', 12_840], ['BASE', 8_210], ['BSC', 3_980], ['ARB', 1_840]].map(([chain, count]) => (
              <div key={chain} className="flex items-center gap-3 text-xs">
                <span className="text-gray-400 w-10 font-mono">{chain}</span>
                <div className="flex-1 bg-[#0A0E1A] rounded-full h-2">
                  <div className="bg-[#0A1EFF] h-2 rounded-full" style={{ width: `${(count as number / 14_320 * 100).toFixed(0)}%` }} />
                </div>
                <span className="text-white w-12 text-right font-medium">{formatLargeNumber(count as number)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E2433]">
          <h3 className="text-sm font-semibold text-white">Top Watched Tokens</h3>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-[#1E2433]">
            <tr>{['#', 'Token', 'Chain', 'Watchlist Count', '7d Change'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {TOP_WATCHED.map((t, i) => (
              <tr key={t.token} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                <td className="px-4 py-3 text-gray-500 font-mono">{i + 1}</td>
                <td className="px-4 py-3 text-white font-bold">{t.symbol}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-[#1E2433] text-gray-300 rounded text-[10px] font-mono">{t.chain}</span></td>
                <td className="px-4 py-3 text-white font-semibold">{t.watchlistCount.toLocaleString()}</td>
                <td className="px-4 py-3"><span className={t.change7d >= 0 ? 'text-green-400' : 'text-red-400'}>{t.change7d >= 0 ? '+' : ''}{t.change7d}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
