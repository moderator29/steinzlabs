'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Search, TrendingUp } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';

const TOP_SEARCHES = [
  { query: 'PEPE',   count: 8420, chain: 'ETH', noResults: false },
  { query: 'BONK',   count: 7140, chain: 'SOL', noResults: false },
  { query: 'WOJAK',  count: 4210, chain: 'BASE',noResults: false },
  { query: '0xdead', count: 3820, chain: 'ETH', noResults: true },
  { query: 'WIF',    count: 3640, chain: 'SOL', noResults: false },
  { query: 'MEME',   count: 2980, chain: 'ETH', noResults: false },
  { query: 'BRETT',  count: 2740, chain: 'BASE',noResults: false },
  { query: 'MOG',    count: 2410, chain: 'ETH', noResults: false },
  { query: 'FLOKI',  count: 2180, chain: 'BSC', noResults: false },
  { query: 'DOGWIF', count: 1840, chain: 'SOL', noResults: false },
];

const RECENT_SEARCHES = [
  { query: 'PEPE',    userId: 'usr_0042', timestamp: Date.now() - 30_000,   found: true },
  { query: '0xAbcD...1234', userId: 'usr_0189', timestamp: Date.now() - 90_000,   found: true },
  { query: 'MOONRUG', userId: 'usr_0007', timestamp: Date.now() - 180_000,  found: false },
  { query: 'BONK',    userId: 'usr_0312', timestamp: Date.now() - 300_000,  found: true },
  { query: 'WIF',     userId: 'usr_0099', timestamp: Date.now() - 600_000,  found: true },
  { query: 'scam2024',userId: 'usr_0421', timestamp: Date.now() - 900_000,  found: false },
];

const HOURLY = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`, searches: Math.floor(Math.random() * 500 + 100),
}));

export default function SearchLogsPage() {
  const totalSearches = TOP_SEARCHES.reduce((s, q) => s + q.count, 0);
  const noResultRate = (TOP_SEARCHES.filter(q => q.noResults).length / TOP_SEARCHES.length * 100).toFixed(0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Search Logs</h1>
        <p className="text-xs text-gray-500 mt-0.5">Token and wallet search analytics — top queries and empty results</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Searches (30d)', value: totalSearches.toLocaleString() },
          { label: 'Unique Queries', value: '4,820' },
          { label: 'No-Result Rate', value: `${noResultRate}%` },
        ].map(k => (
          <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-2">{k.label}</div>
            <div className="text-2xl font-bold text-white">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Searches by Hour (Today)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={HOURLY}>
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#6B7280' }} interval={5} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="searches" fill="#0A1EFF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Top Search Queries</h3>
          <div className="space-y-2">
            {TOP_SEARCHES.slice(0, 6).map((q, i) => (
              <div key={q.query} className="flex items-center gap-3 text-xs">
                <span className="text-gray-600 font-mono w-4">{i + 1}</span>
                <span className={`flex-1 font-medium ${q.noResults ? 'text-red-400' : 'text-white'}`}>{q.query}</span>
                <span className="text-[10px] font-mono bg-[#1E2433] text-gray-400 px-1.5 py-0.5 rounded">{q.chain}</span>
                <span className="text-gray-400 w-12 text-right">{q.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E2433] flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-[#0A1EFF]" />
            <h3 className="text-sm font-semibold text-white">Trending Searches</h3>
          </div>
          <div className="p-4 space-y-2">
            {TOP_SEARCHES.map((q, i) => (
              <div key={q.query} className="flex items-center gap-3 text-xs">
                <span className="text-gray-600 w-4 font-mono">{i + 1}</span>
                <span className="flex-1 text-gray-200 font-medium">{q.query}</span>
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
          <div className="divide-y divide-[#1E2433]">
            {RECENT_SEARCHES.map((s, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3 text-xs hover:bg-[#1E2433]/30">
                <span className={`font-mono font-medium ${s.found ? 'text-white' : 'text-red-400'}`}>{s.query}</span>
                <span className="flex-1 text-gray-500">{s.userId}</span>
                {!s.found && <span className="text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">No results</span>}
                <span className="text-gray-600">{formatTimeAgo(s.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
