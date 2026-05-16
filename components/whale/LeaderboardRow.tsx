'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Crown, Medal } from 'lucide-react';

/**
 * LeaderboardRow — one row in the whale leaderboard (top profitable
 * traders / top trending followers / etc). Compact tabular layout
 * so 20 rows fit on a 1080p viewport without scrolling.
 *
 * Rank 1..3 get colored medal icons (gold / silver / bronze); the
 * rest get the plain number. Audit §B.17 onboarding leaderboard
 * + §B.10 whale tracker P1.
 */

export interface LeaderboardRowProps {
  rank: number;
  address: string;
  label?: string | null;
  metricLabel: string;          // e.g. 'PnL', 'Followers', 'Trades'
  metricValue: number;
  metricFmt?: (n: number) => string;
  change?: number | null;       // delta vs previous period
  /** Optional chain pill. */
  chain?: string;
}

function shortAddr(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function defaultFmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toLocaleString('en-US')}`;
}

const MEDAL_COLOR: Record<number, string> = { 1: '#FACC15', 2: '#94A3B8', 3: '#B45309' };

export function LeaderboardRow({
  rank,
  address,
  label,
  metricLabel,
  metricValue,
  metricFmt,
  change,
  chain,
}: LeaderboardRowProps) {
  const fmt = metricFmt ?? defaultFmt;
  const isUp = typeof change === 'number' && change > 0;
  const isDown = typeof change === 'number' && change < 0;
  return (
    <Link
      href={`/dashboard/whales/${address}`}
      className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/10 transition-all"
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold tabular-nums"
        style={{
          color: MEDAL_COLOR[rank] ?? '#94A3B8',
          background: rank <= 3 ? `${MEDAL_COLOR[rank]}15` : 'transparent',
          border: rank <= 3 ? `1px solid ${MEDAL_COLOR[rank]}55` : '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {rank <= 3 ? rank === 1 ? <Crown className="w-3.5 h-3.5" /> : <Medal className="w-3.5 h-3.5" /> : rank}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate">
            {label || shortAddr(address)}
          </span>
          {chain ? (
            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-mono">{chain}</span>
          ) : null}
        </div>
        {label ? <span className="text-[11px] text-slate-500 font-mono">{shortAddr(address)}</span> : null}
      </div>
      <div className="text-right">
        <div className="text-sm font-mono font-semibold text-white tabular-nums">{fmt(metricValue)}</div>
        <div className="text-[10px] text-slate-500 inline-flex items-center gap-1">
          {metricLabel}
          {isUp && change !== null && change !== undefined ? (
            <span className="text-emerald-300 inline-flex items-center gap-0.5">
              <TrendingUp className="w-2.5 h-2.5" />
              {fmt(change)}
            </span>
          ) : null}
          {isDown && change !== null && change !== undefined ? (
            <span className="text-red-300 inline-flex items-center gap-0.5">
              <TrendingDown className="w-2.5 h-2.5" />
              {fmt(Math.abs(change))}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
