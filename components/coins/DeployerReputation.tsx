'use client';

/**
 * DeployerReputation — a compact, honest chip for the coin page that reports
 * the token creator's track record from the shared deployer-history service
 * (the same on-chain data behind the Security Panel and Deployer DNA). It loads
 * on demand so it never blocks the coin page, shows an emerald / amber / rose
 * accent by risk, and falls back to an honest note when a chain or provider has
 * no data. It never renders a fabricated stat.
 */

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, History } from 'lucide-react';
import { Copyable } from './atoms';

type RiskLabel = 'clean' | 'mixed' | 'serial_rugger' | 'unknown';

interface DeployerSummary {
  available: boolean;
  deployer?: string;
  launchCount?: number;
  ruggedCount?: number;
  riskLabel?: RiskLabel;
  summary?: string;
  reason?: string;
}

const RISK_STYLE: Record<Exclude<RiskLabel, 'unknown'>, { color: string; ring: string; icon: typeof ShieldCheck; word: string }> = {
  clean: { color: '#10B981', ring: 'rgba(16,185,129,.35)', icon: ShieldCheck, word: 'Clean' },
  mixed: { color: '#F59E0B', ring: 'rgba(245,158,11,.35)', icon: ShieldAlert, word: 'Mixed' },
  serial_rugger: { color: '#F43F5E', ring: 'rgba(244,63,94,.4)', icon: ShieldX, word: 'Serial rugger' },
};

function shorten(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function DeployerReputation({ chain, address }: { chain: string; address: string }) {
  const [data, setData] = useState<DeployerSummary | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setData(undefined);
    (async () => {
      try {
        const r = await fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/deployer`, { cache: 'no-store' });
        const j = (await r.json()) as DeployerSummary;
        if (alive) setData(j);
      } catch {
        if (alive) setData(null);
      }
    })();
    return () => { alive = false; };
  }, [chain, address]);

  // Loading: stay quiet so the page never blocks or flickers a fake stat.
  if (data === undefined) return null;

  // Unavailable: honest one-line note, no invented numbers.
  if (!data || !data.available) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-white/40">
        <History className="w-3.5 h-3.5 shrink-0" />
        <span>Deployer history unavailable on this chain</span>
      </div>
    );
  }

  const label: RiskLabel = data.riskLabel ?? 'unknown';
  const launches = data.launchCount ?? 0;
  const rugged = data.ruggedCount ?? 0;

  if (label === 'unknown') {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-white/40">
        <History className="w-3.5 h-3.5 shrink-0" />
        <span>Deployer history unavailable on this chain</span>
      </div>
    );
  }

  const s = RISK_STYLE[label];
  const Icon = s.icon;
  const line = data.summary ?? `Deployer launched ${launches} ${launches === 1 ? 'coin' : 'coins'}, ${rugged} rugged`;

  return (
    <div
      className="nl-glass rounded-2xl px-3 py-2.5 flex items-center gap-2.5"
      style={{ boxShadow: `inset 0 0 0 1px ${s.ring}` }}
    >
      <span
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: `${s.color}1f` }}
      >
        <Icon className="w-4 h-4" style={{ color: s.color }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">Deployer</span>
          <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.word}</span>
        </div>
        <div className="text-[12px] text-white/80 truncate leading-tight mt-0.5">{line}</div>
      </div>
      {data.deployer ? (
        <Copyable text={data.deployer} label={shorten(data.deployer)} className="shrink-0 text-[11px] font-mono" />
      ) : null}
    </div>
  );
}
