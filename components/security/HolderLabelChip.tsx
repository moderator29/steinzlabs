'use client';

import { Building2, Droplets, Hammer, Crown, Sparkles, FileCode2, HelpCircle } from 'lucide-react';

/**
 * Holder-label chip. Pairs with lib/security/holderLabels.ts. Renders
 * a categorized address with the appropriate icon + color so the
 * SecurityPanel surfaces 'Binance hot wallet — 12.3%' as a single
 * compact unit. Pure stateless component.
 */

export type HolderLabelKind = 'cex' | 'lp' | 'dev' | 'whale' | 'fresh' | 'contract' | 'unknown';

export interface HolderLabelChipProps {
  label: HolderLabelKind;
  display: string;
  share?: number; // 0..1
}

const META: Record<HolderLabelKind, { icon: typeof Building2; bg: string; text: string }> = {
  cex:      { icon: Building2,  bg: 'bg-amber-500/15 border-amber-500/40',     text: 'text-amber-200' },
  lp:       { icon: Droplets,    bg: 'bg-cyan-500/15 border-cyan-500/40',       text: 'text-cyan-200' },
  dev:      { icon: Hammer,      bg: 'bg-red-500/15 border-red-500/40',         text: 'text-red-200' },
  whale:    { icon: Crown,       bg: 'bg-violet-500/15 border-violet-500/40',   text: 'text-violet-200' },
  fresh:    { icon: Sparkles,    bg: 'bg-yellow-500/15 border-yellow-500/40',   text: 'text-yellow-200' },
  contract: { icon: FileCode2,   bg: 'bg-slate-500/15 border-slate-500/40',     text: 'text-slate-200' },
  unknown:  { icon: HelpCircle,  bg: 'bg-slate-500/10 border-slate-500/30',     text: 'text-slate-300' },
};

export function HolderLabelChip({ label, display, share }: HolderLabelChipProps) {
  const m = META[label];
  const Icon = m.icon;
  const pct = typeof share === 'number' ? `${(share * 100).toFixed(1)}%` : null;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${m.bg} ${m.text}`}
      title={pct ? `${display} (${pct})` : display}
    >
      <Icon className="w-3 h-3" />
      <span className="truncate max-w-[120px]">{display}</span>
      {pct ? <span className="opacity-70 font-normal tabular-nums">{pct}</span> : null}
    </span>
  );
}
