'use client';

import { ArrowRightLeft } from 'lucide-react';

/**
 * BridgeLinkChip — surfaces a cross-chain bridge link inferred by
 * lib/clusters/bridgeDetector.ts. Renders source-chain →
 * dest-chain with the bridge name and a 0..1 confidence pip.
 */

export interface BridgeLinkChipProps {
  sourceChain: string;
  destChain: string;
  bridge?: string;
  confidence?: number;
  amountUsd?: number;
}

const CHAIN_LABELS: Record<string, string> = {
  ethereum: 'ETH',
  base: 'BASE',
  arbitrum: 'ARB',
  optimism: 'OP',
  polygon: 'POLY',
  bsc: 'BSC',
  avalanche: 'AVAX',
  solana: 'SOL',
};

function chainLabel(c: string): string {
  return CHAIN_LABELS[c.toLowerCase()] ?? c.toUpperCase().slice(0, 4);
}

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export function BridgeLinkChip({ sourceChain, destChain, bridge, confidence, amountUsd }: BridgeLinkChipProps) {
  const conf = typeof confidence === 'number' ? Math.round(confidence * 100) : null;
  const tooltip = [
    `${chainLabel(sourceChain)} → ${chainLabel(destChain)}`,
    bridge ? `via ${bridge}` : null,
    amountUsd ? fmtUsd(amountUsd) : null,
    conf !== null ? `${conf}% confidence` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-cyan-500/40 bg-cyan-500/15 text-cyan-200 text-[11px] font-semibold"
      title={tooltip}
      aria-label={tooltip}
    >
      <ArrowRightLeft className="w-3 h-3" />
      {chainLabel(sourceChain)} → {chainLabel(destChain)}
      {amountUsd ? <span className="opacity-70 font-normal tabular-nums">{fmtUsd(amountUsd)}</span> : null}
    </span>
  );
}
