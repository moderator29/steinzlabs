'use client';

import { Crosshair, TrendingUp, Diamond, Zap, Hammer, Flame, HelpCircle } from 'lucide-react';

/**
 * Trade-style chip for wallet-intelligence cards. Pairs with
 * lib/walletIntel/tradeClassifier.ts — the lib decides the label;
 * this component picks the icon + color + confidence display.
 */

export type TradeStyleId =
  | 'sniper'
  | 'swing'
  | 'hodler'
  | 'arbitrage'
  | 'farmer'
  | 'degen'
  | 'unknown';

export interface TradeStyleBadgeProps {
  style: TradeStyleId;
  confidence: number;
  showConfidence?: boolean;
}

const META: Record<TradeStyleId, { label: string; icon: typeof Crosshair; bg: string; text: string }> = {
  sniper:    { label: 'Sniper',    icon: Crosshair,  bg: 'bg-red-500/15 border-red-500/40',          text: 'text-red-300' },
  swing:     { label: 'Swing',     icon: TrendingUp, bg: 'bg-cyan-500/15 border-cyan-500/40',        text: 'text-cyan-300' },
  hodler:    { label: 'HODLer',    icon: Diamond,    bg: 'bg-emerald-500/15 border-emerald-500/40',  text: 'text-emerald-300' },
  arbitrage: { label: 'Arbitrage', icon: Zap,        bg: 'bg-yellow-500/15 border-yellow-500/40',    text: 'text-yellow-200' },
  farmer:    { label: 'Farmer',    icon: Hammer,     bg: 'bg-indigo-500/15 border-indigo-500/40',    text: 'text-indigo-300' },
  degen:     { label: 'Degen',     icon: Flame,      bg: 'bg-orange-500/15 border-orange-500/40',    text: 'text-orange-300' },
  unknown:   { label: 'Unknown',   icon: HelpCircle, bg: 'bg-slate-500/15 border-slate-500/40',      text: 'text-slate-300' },
};

export function TradeStyleBadge({ style, confidence, showConfidence = true }: TradeStyleBadgeProps) {
  const m = META[style];
  const Icon = m.icon;
  const pct = Math.round(confidence * 100);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${m.bg} ${m.text}`}
      title={`Trade style: ${m.label} (${pct}% confidence)`}
    >
      <Icon className="w-3 h-3" />
      {m.label}
      {showConfidence ? <span className="opacity-70 font-normal">{pct}%</span> : null}
    </span>
  );
}
