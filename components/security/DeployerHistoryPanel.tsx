'use client';

import { ShieldX, ShieldCheck, ShieldAlert, History } from 'lucide-react';

/**
 * DeployerHistoryPanel — surfaces the deployer's rug-history trust
 * score INSIDE the SecurityPanel so a green-on-current-contract
 * token still gets a warning when its deployer has 3 prior rugs.
 *
 * Audit §B.4 P1 deployer rug history.
 */

export interface DeployerHistoryPanelProps {
  trustScore: number;
  totalDeployed: number;
  rugged: number;
  abandoned: number;
  active: number;
  band: 'pristine' | 'clean' | 'caution' | 'dangerous' | 'serial-rugger';
}

const BAND_STYLE = {
  pristine:       { color: '#10B981', label: 'Pristine record',   icon: ShieldCheck },
  clean:           { color: '#10B981', label: 'Clean history',     icon: ShieldCheck },
  caution:         { color: '#F59E0B', label: 'Caution',           icon: ShieldAlert },
  dangerous:       { color: '#EF4444', label: 'Dangerous',         icon: ShieldX },
  'serial-rugger': { color: '#DC143C', label: 'Serial rugger',     icon: ShieldX },
} as const;

export function DeployerHistoryPanel(props: DeployerHistoryPanelProps) {
  const b = BAND_STYLE[props.band];
  const Icon = b.icon;
  return (
    <div
      className="rounded-xl border bg-white/[0.02] p-3"
      style={{ borderColor: `${b.color}55` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <History className="w-3.5 h-3.5 text-slate-500" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
          Deployer history
        </span>
        <span className="ml-auto text-[11px] font-mono tabular-nums" style={{ color: b.color }}>
          {props.trustScore}/100
        </span>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5" style={{ color: b.color }} />
        <span className="text-[11px] font-semibold" style={{ color: b.color }}>{b.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
        <Stat label="Total" value={props.totalDeployed} color="#94A3B8" />
        <Stat label="Rugged" value={props.rugged} color="#EF4444" />
        <Stat label="Active" value={props.active} color="#10B981" />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="font-mono font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-slate-500 text-[10px] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
