'use client';

/**
 * Batch 7 / checkprice-style — Recent Trades sidebar. LIVE badge +
 * rolling list of recent trades for the selected token. Uses the
 * existing useRecentTrades hook which polls DexScreener for pair data.
 */

import { useRecentTrades } from '@/hooks/market/useRecentTrades';

interface Props {
  pairAddress: string | null;
  chain: string;
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
        <span className="text-end">Source</span>
        <span className="text-end">Time</span>
      </div>

      <div className="max-h-[360px] overflow-y-auto">
        {trades.length === 0 ? (
          <div className="py-8 text-center text-[11px] text-slate-500">
            Waiting for trades…
          </div>
        ) : (
          trades.slice(0, 30).map((t, i) => {
            const t2 = t as unknown as { price?: number | string; amountUsd?: number; volumeUsd?: number; side?: string; source?: string; dex?: string; time?: number; timestamp?: number };
            const isBuy = (t2.side ?? '').toLowerCase() === 'buy';
            const price = typeof t2.price === 'string' ? parseFloat(t2.price) : (t2.price ?? 0);
            const size = t2.amountUsd ?? t2.volumeUsd ?? 0;
            const src = t2.source ?? t2.dex ?? '—';
            const ts = t2.time ?? t2.timestamp ?? 0;
            const ago = ts ? Math.max(0, Math.round((Date.now() - ts * 1000) / 1000)) : 0;
            return (
              <div
                key={i}
                className={`grid grid-cols-4 gap-2 px-3 py-1.5 text-[11px] border-b border-slate-900/40 ${
                  isBuy ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                <span className="font-mono tabular-nums">{price > 0 ? price.toFixed(price < 0.01 ? 6 : 4) : '—'}</span>
                <span className="text-end font-mono text-slate-300 tabular-nums">{size > 0 ? `$${Math.round(size).toLocaleString()}` : '—'}</span>
                <span className="text-end text-slate-500 truncate">{src}</span>
                <span className="text-end text-slate-500 tabular-nums">{ago < 60 ? `${ago}s` : `${Math.round(ago / 60)}m`}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
