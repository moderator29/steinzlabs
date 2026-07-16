'use client';

/**
 * Batch 7 / checkprice-style — Recent Trades sidebar. LIVE badge +
 * rolling list of recent trades for the selected token. Uses the
 * existing useRecentTrades hook which polls DexScreener for pair data.
 */

import { useRecentTrades } from '@/hooks/market/useRecentTrades';
import type { RecentTrade } from '@/lib/market/types';

interface Props {
  pairAddress: string | null;
  chain: string;
}

function shortWallet(addr: string): string {
  if (!addr) return '—';
  return addr.length > 10 ? `${addr.slice(0, 4)}…${addr.slice(-4)}` : addr;
}

function timeAgo(tsMs: number): string {
  if (!tsMs) return '—';
  const secs = Math.max(0, Math.round((Date.now() - tsMs) / 1000));
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.round(secs / 60)}m`;
  return `${Math.round(secs / 3600)}h`;
}

export default function RecentTradesRail({ pairAddress, chain }: Props) {
  const { trades } = useRecentTrades(pairAddress, chain);

  return (
    <div className="nl-glass rounded-xl overflow-hidden" style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/70">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Recent Trades</span>
        {/* Only claim LIVE (pulsing) when we actually have a trade tape; an
            empty tape shows a muted Idle state, not a fake-live pulse. */}
        {trades.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase font-semibold text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase font-semibold text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            Idle
          </span>
        )}
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-4 gap-2 px-3 py-1.5 text-[9px] uppercase tracking-wider text-slate-600 border-b border-slate-800/50 font-semibold">
        <span>Price</span>
        <span className="text-end">Size</span>
        <span className="text-end">Maker</span>
        <span className="text-end">Time</span>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {trades.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-slate-500">
            Waiting for trades…
          </div>
        ) : (
          trades.slice(0, 30).map((t: RecentTrade, i) => {
            // Real RecentTrade shape: { timestamp (ms), type, price, amount,
            // valueUSD, wallet }. Reading the true fields — the old code read
            // side/amountUsd/source/time*1000, none of which exist, so every
            // row rendered red with "—" size and a garbage timestamp.
            const isBuy = t.type === 'buy';
            const price = t.price ?? 0;
            const size = t.valueUSD ?? 0;
            return (
              <div
                key={`${t.timestamp}-${i}`}
                className={`grid grid-cols-4 gap-2 px-3 py-1.5 text-[11px] border-b border-slate-900/40 ${
                  isBuy ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                <span className="font-mono tabular-nums">{price > 0 ? price.toFixed(price < 0.01 ? 6 : 4) : '—'}</span>
                <span className="text-end font-mono text-slate-300 tabular-nums">{size > 0 ? `$${Math.round(size).toLocaleString()}` : '—'}</span>
                <span className="text-end text-slate-500 truncate font-mono">{shortWallet(t.wallet)}</span>
                <span className="text-end text-slate-500 tabular-nums">{timeAgo(t.timestamp)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
