'use client';

/**
 * §5.6 Swap UI Dune-intelligence strip. Drop above the swap submit
 * button to surface sandwich risk, smart-money last-hour direction,
 * observed buy/sell tax, and slippage recommendation pre-trade.
 *
 * Reads from /api/swap/intelligence which hits Dune-materialized
 * tables; quietly renders nothing when none of the metrics are
 * available yet.
 */

import { useEffect, useState } from 'react';
import { ShieldAlert, TrendingUp, TrendingDown } from 'lucide-react';

interface Strip {
  sandwich_risk_score: number | null;
  honeypot_flag: 'safe' | 'warning' | 'danger' | 'unknown';
  smart_money_last_hour: 'buying' | 'selling' | 'mixed' | 'quiet' | null;
  liquidity_cliff_usd: number | null;
  observed_buy_tax_pct: number | null;
  observed_sell_tax_pct: number | null;
  recommended_slippage_bps: number | null;
}

interface Props {
  chain: string;
  token_in: string;
  token_out: string;
  size_usd: number;
  className?: string;
}

export default function SwapDuneStrip({ chain, token_in, token_out, size_usd, className = '' }: Props) {
  const [data, setData] = useState<Strip | null>(null);
  useEffect(() => {
    if (!chain || !token_in || !token_out) return;
    let cancelled = false;
    const params = new URLSearchParams({ chain, token_in, token_out, size_usd: String(size_usd || 0) });
    fetch(`/api/swap/intelligence?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Strip | null) => { if (!cancelled) setData(j); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chain, token_in, token_out, size_usd]);

  if (!data) return null;
  const hasAny = data.sandwich_risk_score !== null
    || data.honeypot_flag !== 'unknown'
    || data.smart_money_last_hour !== null
    || data.observed_buy_tax_pct !== null
    || data.observed_sell_tax_pct !== null;
  if (!hasAny) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 text-[10px] ${className}`}>
      {data.sandwich_risk_score !== null && (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border ${
          data.sandwich_risk_score >= 70 ? 'bg-red-500/10 text-red-300 border-red-500/20'
          : data.sandwich_risk_score >= 40 ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
        } font-semibold`}>
          <ShieldAlert className="w-3 h-3" />
          MEV {Math.round(data.sandwich_risk_score)}/100
        </span>
      )}
      {data.smart_money_last_hour && data.smart_money_last_hour !== 'quiet' && (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border font-semibold ${
          data.smart_money_last_hour === 'buying' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
          : data.smart_money_last_hour === 'selling' ? 'bg-red-500/10 text-red-300 border-red-500/20'
          : 'bg-slate-500/10 text-slate-300 border-slate-500/20'
        }`}>
          {data.smart_money_last_hour === 'buying' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          Smart $: {data.smart_money_last_hour}
        </span>
      )}
      {(data.observed_buy_tax_pct !== null || data.observed_sell_tax_pct !== null) && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-black/30 text-slate-300 font-semibold">
          Tax: buy {data.observed_buy_tax_pct?.toFixed(1) ?? '—'}% · sell {data.observed_sell_tax_pct?.toFixed(1) ?? '—'}%
        </span>
      )}
      {data.recommended_slippage_bps !== null && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-black/30 text-slate-300 font-semibold">
          Rec slippage: {(data.recommended_slippage_bps / 100).toFixed(2)}%
        </span>
      )}
    </div>
  );
}
