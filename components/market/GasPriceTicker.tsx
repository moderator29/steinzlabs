'use client';

/**
 * GasPriceTicker — header chip showing live gas prices across the
 * supported chains. Each chip renders the current standard gas tier
 * (gwei on EVM, microlamports/CU on Solana) with a color cue:
 *
 *   • emerald   cheap   < 20% of 24h median
 *   • slate     normal  20–80%
 *   • amber     pricey  80–150%
 *   • red       hot     > 150%
 *
 * Hovering shows the slow / standard / fast tiers. Caller supplies
 * the GasSnapshot map — the ticker is presentation-only so it can
 * mount against SSE, polling, or static demo data without changes.
 */

import { Fuel } from 'lucide-react';

export interface GasSnapshot {
  chain: 'ethereum' | 'base' | 'arbitrum' | 'optimism' | 'bsc' | 'polygon' | 'solana';
  /** Standard tier value — unit varies per chain (gwei on EVM, microlamports/CU on Solana). */
  standard: number;
  slow?: number;
  fast?: number;
  /** Rolling 24h median for tier comparison. */
  median24h?: number;
  /** Suffix shown after the number — 'gwei', 'μlam/CU'. */
  unit?: string;
}

const CHAIN_LABEL: Record<GasSnapshot['chain'], string> = {
  ethereum: 'ETH',
  base: 'BASE',
  arbitrum: 'ARB',
  optimism: 'OP',
  bsc: 'BSC',
  polygon: 'POLY',
  solana: 'SOL',
};

function classify(snapshot: GasSnapshot): 'cheap' | 'normal' | 'pricey' | 'hot' {
  const median = snapshot.median24h ?? snapshot.standard;
  if (median <= 0) return 'normal';
  const ratio = snapshot.standard / median;
  if (ratio < 0.2) return 'cheap';
  if (ratio < 0.8) return 'normal';
  if (ratio < 1.5) return 'pricey';
  return 'hot';
}

const TIER_COLOR = {
  cheap: '#10B981',
  normal: '#94A3B8',
  pricey: '#F59E0B',
  hot: '#EF4444',
};

function fmt(value: number): string {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

export interface GasPriceTickerProps {
  snapshots: GasSnapshot[];
  onChainClick?: (chain: GasSnapshot['chain']) => void;
}

export function GasPriceTicker({ snapshots, onChainClick }: GasPriceTickerProps) {
  if (snapshots.length === 0) return null;
  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap" role="group" aria-label="Live gas prices">
      <Fuel className="w-3 h-3 text-slate-500" />
      {snapshots.map((s) => {
        const tier = classify(s);
        const color = TIER_COLOR[tier];
        const tooltipParts = [
          `${CHAIN_LABEL[s.chain]} · ${tier}`,
          s.slow !== undefined ? `slow ${fmt(s.slow)}` : null,
          `standard ${fmt(s.standard)}`,
          s.fast !== undefined ? `fast ${fmt(s.fast)}` : null,
          s.median24h !== undefined ? `24h median ${fmt(s.median24h)}` : null,
          s.unit ?? '',
        ].filter(Boolean);
        return (
          <button
            key={s.chain}
            onClick={() => onChainClick?.(s.chain)}
            title={tooltipParts.join(' · ')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-white/[0.02] text-[10px] font-semibold transition-colors hover:border-white/30"
            style={{ borderColor: `${color}55`, color }}
          >
            <span aria-hidden className="text-slate-500 font-mono">{CHAIN_LABEL[s.chain]}</span>
            <span className="tabular-nums">{fmt(s.standard)}</span>
          </button>
        );
      })}
    </div>
  );
}
