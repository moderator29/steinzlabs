'use client';

import { useState } from 'react';
import { Crosshair, AlertTriangle, Power, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { StatusDot } from '@/components/ui/StatusDot';
import { formatUSD, formatTimeAgo } from '@/lib/formatters';

interface SniperJob {
  id: string;
  token: string;
  chain: string;
  targetPrice: number;
  currentPrice: number;
  walletAddress: string;
  createdAt: number;
  status: 'active' | 'paused' | 'triggered' | 'failed';
  pnl?: number;
}

const MOCK_JOBS: SniperJob[] = [
  { id: 'snp_001', token: 'PEPE2',  chain: 'ETH',  targetPrice: 0.00001200, currentPrice: 0.00001150, walletAddress: '0xAb3f...B12E', createdAt: Date.now() - 3600_000, status: 'active' },
  { id: 'snp_002', token: 'BONK',   chain: 'SOL',  targetPrice: 0.0000250,  currentPrice: 0.0000248,  walletAddress: '9UeS...mK7J', createdAt: Date.now() - 7200_000, status: 'active' },
  { id: 'snp_003', token: 'WOJAK',  chain: 'BASE', targetPrice: 0.000500,   currentPrice: 0.000620,   walletAddress: '0xF2a1...D94C', createdAt: Date.now() - 1800_000, status: 'triggered', pnl: 240 },
  { id: 'snp_004', token: 'FLOKI',  chain: 'BSC',  targetPrice: 0.0000180,  currentPrice: 0.0000140,  walletAddress: '0x9B2d...A3E1', createdAt: Date.now() - 14400_000, status: 'paused' },
  { id: 'snp_005', token: 'MEME',   chain: 'ARB',  targetPrice: 0.0120,     currentPrice: 0.0105,     walletAddress: '0xC4e2...F87D', createdAt: Date.now() - 28800_000, status: 'failed' },
];

const STATUS_COLOR: Record<string, string> = {
  active: 'active', paused: 'inactive', triggered: 'active', failed: 'error',
};

export default function SniperOversightPage() {
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [killSwitch, setKillSwitch] = useState(false);

  const toggleJob = (id: string) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: j.status === 'active' ? 'paused' : 'active' } : j));
  };

  const activeCount = jobs.filter(j => j.status === 'active').length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Sniper Oversight</h1>
          <p className="text-xs text-gray-500 mt-0.5">Monitor and control all active sniper agent jobs</p>
        </div>
        <div className="flex items-center gap-3">
          {killSwitch && (
            <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-lg">
              <AlertTriangle className="w-3 h-3" /> Kill switch active — all snipers halted
            </span>
          )}
          <button
            onClick={() => setKillSwitch(prev => !prev)}
            className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-all ${killSwitch ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600 hover:text-white'}`}>
            <Power className="w-4 h-4" />
            {killSwitch ? 'Resume All' : 'Kill Switch'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Jobs', value: activeCount, icon: Crosshair },
          { label: 'Triggered Today', value: jobs.filter(j => j.status === 'triggered').length, icon: Activity },
          { label: 'Total PnL (30d)', value: formatUSD(jobs.reduce((s, j) => s + (j.pnl ?? 0), 0)), icon: TrendingUp },
          { label: 'Failed Jobs', value: jobs.filter(j => j.status === 'failed').length, icon: AlertTriangle },
        ].map(k => (
          <div key={k.label} className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0A1EFF]/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <k.icon className="w-4 h-4 text-[#0A1EFF]" />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{k.value}</div>
              <div className="text-xs text-gray-400">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="border-b border-[#1E2433]">
            <tr>{['Token', 'Chain', 'Target', 'Current', 'Wallet', 'Created', 'Status', 'PnL', 'Action'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {jobs.map(job => {
              const priceDiff = ((job.currentPrice - job.targetPrice) / job.targetPrice * 100);
              return (
                <tr key={job.id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                  <td className="px-4 py-3 text-white font-bold">{job.token}</td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-[#0A1EFF]/10 text-[#0A1EFF] rounded text-[10px] font-mono">{job.chain}</span></td>
                  <td className="px-4 py-3 font-mono text-gray-300">${job.targetPrice.toFixed(8)}</td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-white">${job.currentPrice.toFixed(8)}</div>
                    <div className={`text-[10px] ${priceDiff >= 0 ? 'text-green-400' : 'text-red-400'}`}>{priceDiff >= 0 ? '+' : ''}{priceDiff.toFixed(2)}%</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-400">{job.walletAddress}</td>
                  <td className="px-4 py-3 text-gray-400">{formatTimeAgo(job.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusDot status={STATUS_COLOR[job.status] as 'active' | 'inactive' | 'error'} label={job.status} />
                  </td>
                  <td className="px-4 py-3">
                    {job.pnl !== undefined ? (
                      <span className={job.pnl >= 0 ? 'text-green-400 font-semibold' : 'text-red-400'}>{job.pnl >= 0 ? '+' : ''}{formatUSD(job.pnl)}</span>
                    ) : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {(job.status === 'active' || job.status === 'paused') && (
                      <button onClick={() => toggleJob(job.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${job.status === 'active' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/40' : 'bg-green-500/20 text-green-400 hover:bg-green-500/40'}`}>
                        {job.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
