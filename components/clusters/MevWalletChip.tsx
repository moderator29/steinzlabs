'use client';

import { Zap } from 'lucide-react';

/**
 * MevWalletChip — flags wallets the cluster pipeline tagged as MEV
 * bots via lib/clusters/mevDetector.ts. Filters them out of
 * smart-money displays so users don't accidentally copy a sandwich
 * bot thinking it's an alpha trader.
 */

export interface MevWalletChipProps {
  pattern: 'sandwich' | 'frontrun' | 'jit' | 'arbitrage' | 'none';
  confidence: number;
  extractedUsd?: number;
}

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

const PATTERN_LABEL: Record<MevWalletChipProps['pattern'], string> = {
  sandwich: 'MEV — sandwich',
  frontrun: 'MEV — frontrun',
  jit: 'MEV — JIT',
  arbitrage: 'MEV — arb',
  none: '',
};

export function MevWalletChip({ pattern, confidence, extractedUsd }: MevWalletChipProps) {
  if (pattern === 'none' || confidence < 0.4) return null;
  const label = PATTERN_LABEL[pattern];
  const conf = Math.round(confidence * 100);
  const tooltip = [
    label,
    `${conf}% confidence`,
    extractedUsd ? `extracted ${fmtUsd(extractedUsd)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-yellow-500/40 bg-yellow-500/15 text-yellow-200 text-[11px] font-semibold"
      title={tooltip}
      aria-label={tooltip}
    >
      <Zap className="w-3 h-3" />
      {label}
      {extractedUsd ? <span className="opacity-70 font-normal tabular-nums">{fmtUsd(extractedUsd)}</span> : null}
    </span>
  );
}
