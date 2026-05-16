'use client';

/**
 * SnipeRiskCell — per-row risk summary for the sniper History tab.
 * Shows max loss budget, max gas budget, and the kill-switch reason
 * if the snipe was aborted before fill. Pairs with the audit B.2 P1
 * 'risk dashboard per snipe' spec.
 */

import { AlertTriangle, ShieldCheck } from 'lucide-react';

export interface SnipeRiskCellProps {
  /** Max loss the rule was willing to take, USD. */
  maxLossUsd?: number | null;
  /** Max gas the rule was willing to pay, USD. */
  maxGasUsd?: number | null;
  /** When set, the snipe was killed before fill with this reason. */
  killSwitchReason?: string | null;
  /** Actual loss observed (USD). Only render when populated. */
  realizedLossUsd?: number | null;
}

function fmtUsd(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

export function SnipeRiskCell({
  maxLossUsd,
  maxGasUsd,
  killSwitchReason,
  realizedLossUsd,
}: SnipeRiskCellProps) {
  if (killSwitchReason) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200 max-w-[280px]"
        title={`Killed: ${killSwitchReason}`}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" />
        <span className="truncate">Kill · {killSwitchReason}</span>
      </div>
    );
  }
  const lossBreach = typeof realizedLossUsd === 'number' && typeof maxLossUsd === 'number' && realizedLossUsd > maxLossUsd;
  return (
    <div className="inline-flex items-center gap-2 text-[11px] text-slate-300">
      {typeof maxLossUsd === 'number' && (
        <span className={`tabular-nums ${lossBreach ? 'text-red-300' : ''}`}>
          Max loss <span className="font-mono">{fmtUsd(maxLossUsd)}</span>
        </span>
      )}
      {typeof maxGasUsd === 'number' && (
        <span className="tabular-nums text-slate-400">
          Gas ≤<span className="font-mono ml-0.5">{fmtUsd(maxGasUsd)}</span>
        </span>
      )}
      {!killSwitchReason && (typeof maxLossUsd === 'number' || typeof maxGasUsd === 'number') && (
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
      )}
    </div>
  );
}
