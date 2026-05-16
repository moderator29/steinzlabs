'use client';

import { Shield, ShieldAlert, ShieldX, Skull } from 'lucide-react';

/**
 * Deployer rug-history chip. Pairs with
 * lib/security/deployerRugHistory.ts. Renders the deployer's track
 * record (clean / caution / risky / serial-rugger) with a count of
 * past tokens deployed + dead rate.
 */

export type RugChipTier = 'clean' | 'caution' | 'risky' | 'serial-rugger';

export interface DeployerRugChipProps {
  tier: RugChipTier;
  score: number;
  totalDeployed: number;
  totalDead: number;
}

const META: Record<RugChipTier, { icon: typeof Shield; bg: string; text: string; label: string }> = {
  clean:           { icon: Shield,      bg: 'bg-emerald-500/15 border-emerald-500/40', text: 'text-emerald-200', label: 'Clean deployer' },
  caution:         { icon: ShieldAlert, bg: 'bg-amber-500/15 border-amber-500/40',     text: 'text-amber-200',   label: 'Caution' },
  risky:           { icon: ShieldX,     bg: 'bg-orange-500/15 border-orange-500/40',   text: 'text-orange-200',  label: 'Risky deployer' },
  'serial-rugger': { icon: Skull,       bg: 'bg-red-500/15 border-red-500/40',         text: 'text-red-200',     label: 'Serial rugger' },
};

export function DeployerRugChip({ tier, score, totalDeployed, totalDead }: DeployerRugChipProps) {
  const m = META[tier];
  const Icon = m.icon;
  const tooltip = `${m.label} · ${score}/100 · ${totalDead}/${totalDeployed} prior tokens dead`;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${m.bg} ${m.text}`}
      title={tooltip}
      aria-label={tooltip}
    >
      <Icon className="w-3 h-3" />
      {m.label}
      {totalDeployed > 1 ? (
        <span className="opacity-70 font-normal">{totalDead}/{totalDeployed}</span>
      ) : null}
    </span>
  );
}
