'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

/**
 * WhaleAlphaCard — compact glass card used on the whale tracker
 * directory + on the dashboard 'Whales worth following' rail. Single
 * source of truth for whale-row presentation so the directory and
 * dashboard cards never diverge.
 *
 * Fields render conditionally: when realizedPnl / winRate / archetype
 * are missing the row collapses gracefully rather than rendering 'N/A'.
 */

export interface WhaleAlphaCardProps {
  address: string;
  label?: string | null;
  chain: string;
  realizedPnlUsd?: number | null;
  winRate?: number | null; // 0..1
  followCount?: number;
  archetype?: string | null;
  trustScore?: number | null;
  /** External Arkham / explorer URL when available. */
  externalUrl?: string;
}

function shortAddr(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function WhaleAlphaCard({
  address,
  label,
  chain,
  realizedPnlUsd,
  winRate,
  followCount,
  archetype,
  trustScore,
  externalUrl,
}: WhaleAlphaCardProps) {
  const isProfitable = typeof realizedPnlUsd === 'number' && realizedPnlUsd > 0;
  return (
    <Link
      href={`/dashboard/whales/${address}`}
      className="block rounded-xl border border-white/10 bg-white/[0.02] hover:border-[#0A1EFF]/40 hover:bg-white/[0.04] p-3.5 transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">
              {label || shortAddr(address)}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              {chain}
            </span>
            {archetype ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300">
                {archetype}
              </span>
            ) : null}
          </div>
          {label ? (
            <span className="text-[11px] text-slate-500 font-mono">{shortAddr(address)}</span>
          ) : null}
        </div>
        {externalUrl ? (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-slate-500 hover:text-slate-200"
            aria-label="Open in external explorer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        ) : null}
      </div>
      <div className="mt-3 flex items-center flex-wrap gap-x-4 gap-y-1 text-[11px]">
        {typeof realizedPnlUsd === 'number' && (
          <span className={`inline-flex items-center gap-1 font-mono font-semibold ${isProfitable ? 'text-emerald-300' : 'text-red-300'}`}>
            {isProfitable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtUsd(realizedPnlUsd)}
          </span>
        )}
        {typeof winRate === 'number' && (
          <span className="text-slate-400">
            Win <span className="text-slate-200 tabular-nums">{(winRate * 100).toFixed(1)}%</span>
          </span>
        )}
        {typeof trustScore === 'number' && (
          <span className="text-slate-400">
            Trust <span className="text-slate-200 tabular-nums">{trustScore.toFixed(0)}</span>
          </span>
        )}
        {typeof followCount === 'number' && followCount > 0 && (
          <span className="ml-auto text-[10px] text-slate-500">{followCount.toLocaleString('en-US')} followers</span>
        )}
      </div>
    </Link>
  );
}
