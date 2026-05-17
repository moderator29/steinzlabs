'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * TaxSimulationDelta — surfaces the gap between a token's CLAIMED
 * buy/sell tax and the SIMULATED actual tax measured via a 1-wei
 * eth_call against the contract. A discrepancy above 1.5% is the
 * single highest-signal honeypot detector — scam contracts often
 * advertise '5% tax' while charging 95% on sell.
 *
 * Audit §B.4 P1.
 */

export interface TaxSimulationDeltaProps {
  claimedBuyTaxPct: number | null;
  claimedSellTaxPct: number | null;
  actualBuyTaxPct: number | null;
  actualSellTaxPct: number | null;
  /** When the simulation was performed. */
  simulatedAt?: number; // unix seconds
}

function fmtPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(1)}%`;
}

function delta(claimed: number | null, actual: number | null): number | null {
  if (claimed === null || actual === null) return null;
  return actual - claimed;
}

function severity(d: number | null): 'ok' | 'warn' | 'danger' {
  if (d === null) return 'ok';
  if (Math.abs(d) <= 0.5) return 'ok';
  if (Math.abs(d) <= 1.5) return 'warn';
  return 'danger';
}

const SEV_STYLE: Record<'ok' | 'warn' | 'danger', { color: string; ring: string; label: string }> = {
  ok:     { color: '#10B981', ring: 'rgba(16,185,129,0.4)',  label: 'Within tolerance' },
  warn:   { color: '#F59E0B', ring: 'rgba(245,158,11,0.4)',  label: 'Discrepancy' },
  danger: { color: '#EF4444', ring: 'rgba(239,68,68,0.55)', label: 'Honeypot pattern' },
};

export function TaxSimulationDelta(props: TaxSimulationDeltaProps) {
  const buyDelta = delta(props.claimedBuyTaxPct, props.actualBuyTaxPct);
  const sellDelta = delta(props.claimedSellTaxPct, props.actualSellTaxPct);
  const worst: 'ok' | 'warn' | 'danger' =
    severity(sellDelta) === 'danger' || severity(buyDelta) === 'danger'
      ? 'danger'
      : severity(sellDelta) === 'warn' || severity(buyDelta) === 'warn'
        ? 'warn'
        : 'ok';
  const sev = SEV_STYLE[worst];
  return (
    <div
      className="rounded-xl border bg-white/[0.02] p-3"
      style={{ borderColor: sev.ring }}
    >
      <div className="flex items-center gap-2 mb-2">
        {worst === 'ok' ? (
          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: sev.color }} />
        ) : (
          <AlertTriangle className="w-3.5 h-3.5" style={{ color: sev.color }} />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: sev.color }}>
          {sev.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <Cell side="Buy" claimed={fmtPct(props.claimedBuyTaxPct)} actual={fmtPct(props.actualBuyTaxPct)} d={buyDelta} />
        <Cell side="Sell" claimed={fmtPct(props.claimedSellTaxPct)} actual={fmtPct(props.actualSellTaxPct)} d={sellDelta} />
      </div>
      {props.simulatedAt ? (
        <p className="text-[10px] text-slate-500 mt-2">
          Simulated {new Date(props.simulatedAt * 1000).toLocaleString()}
        </p>
      ) : null}
    </div>
  );
}

function Cell({ side, claimed, actual, d }: { side: string; claimed: string; actual: string; d: number | null }) {
  const sev = severity(d);
  return (
    <div>
      <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold mb-1">{side} tax</div>
      <div className="flex items-baseline gap-2">
        <span className="text-slate-300 tabular-nums">{claimed}</span>
        <span className="text-slate-500 text-[10px]">claimed</span>
      </div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <span className="font-bold tabular-nums" style={{ color: SEV_STYLE[sev].color }}>{actual}</span>
        <span className="text-slate-500 text-[10px]">actual</span>
      </div>
    </div>
  );
}
