'use client';

/**
 * §5.6 Trading Terminal Dune-intelligence strip. Drop this beside the
 * AdvancedChart on the token detail page to surface holder
 * concentration, wash-trade score, smart-money net flow, etc.
 *
 * All values are pulled from /api/market/token/[chain]/[address]/intelligence
 * which reads Dune-materialized tables. When the tables are empty
 * (Dune not yet provisioned), the strip renders a single "Intelligence
 * data not yet available" line — never fabricated numbers.
 */

import { useEffect, useState } from 'react';
import { Activity, Users, AlertTriangle } from 'lucide-react';

interface Strip {
  holder_concentration?: {
    top10_pct: number | null;
    gini: number | null;
    nakamoto: number | null;
  } | null;
  smart_money_net_flow_24h_usd?: number | null;
  wash_trade_score?: number | null;
}

export default function DuneIntelligenceStrip({ chain, address, className = '' }: { chain: string; address: string; className?: string }) {
  const [data, setData] = useState<Strip | null>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!chain || !address) return;
    let cancelled = false;
    fetch(`/api/market/token/${encodeURIComponent(chain)}/${encodeURIComponent(address)}/intelligence`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Strip | null) => {
        if (!cancelled) {
          setData(j);
          setLoaded(true);
        }
      })
      .catch(() => setLoaded(true));
    return () => { cancelled = true; };
  }, [chain, address]);

  if (!loaded) return null;

  const hc = data?.holder_concentration;
  const ws = data?.wash_trade_score;
  const flow = data?.smart_money_net_flow_24h_usd;
  const anyData = (hc && (hc.top10_pct !== null || hc.gini !== null)) || ws !== null || flow !== null;
  if (!anyData) {
    return (
      <div className={`text-[11px] text-slate-500 ${className}`}>
        Dune intelligence not yet available for this token.
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {hc?.top10_pct !== null && hc?.top10_pct !== undefined && (
        <Chip
          icon={<Users className="w-3 h-3" />}
          label="Top 10%"
          value={`${hc.top10_pct.toFixed(1)}%`}
          tone={hc.top10_pct > 60 ? 'danger' : hc.top10_pct > 35 ? 'warn' : 'safe'}
          title={`Gini ${hc.gini?.toFixed(2) ?? '—'} · Nakamoto ${hc.nakamoto ?? '—'}`}
        />
      )}
      {ws !== null && ws !== undefined && (
        <Chip
          icon={<AlertTriangle className="w-3 h-3" />}
          label="Wash"
          value={`${Math.round(ws)}/100`}
          tone={ws >= 70 ? 'danger' : ws >= 40 ? 'warn' : 'safe'}
          title="Dune wash-trade score (higher = more wash-like)"
        />
      )}
      {flow !== null && flow !== undefined && (
        <Chip
          icon={<Activity className="w-3 h-3" />}
          label="Smart $ 24h"
          value={`${flow >= 0 ? '+' : ''}$${(Math.abs(flow) / 1_000).toFixed(1)}K`}
          tone={flow >= 0 ? 'safe' : 'warn'}
          title="Net smart-money flow into this token in the last 24h"
        />
      )}
    </div>
  );
}

const TONE_CLASS: Record<'safe' | 'warn' | 'danger', string> = {
  safe:   'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  warn:   'bg-amber-500/10 text-amber-300 border-amber-500/20',
  danger: 'bg-red-500/10 text-red-300 border-red-500/20',
};

function Chip({ icon, label, value, tone, title }: { icon: React.ReactNode; label: string; value: string; tone: 'safe' | 'warn' | 'danger'; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${TONE_CLASS[tone]} text-[10px] font-semibold`}>
      {icon}
      <span className="text-slate-400 uppercase tracking-wider">{label}</span>
      <span className="font-mono">{value}</span>
    </span>
  );
}
