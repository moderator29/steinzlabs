'use client';

import { Lock } from 'lucide-react';

/**
 * LpLockPanel — visual companion to lib/security/lpLockWindow.ts.
 * Renders the locked-supply %, the soonest unlock date, and a list
 * of contributing lockers ('Team Finance 65% · Unicrypt 20%').
 *
 * Audit §B.4 P1 LP-lock surface.
 */

export interface LpLockPanelProps {
  totalLockedPct: number;
  soonestUnlockAt: number | null;
  daysUntilUnlock: number | null;
  severity: 'green' | 'amber' | 'red' | 'unknown';
  byLocker: Array<{ locker: string; lpShare: number; nextUnlockAt: number | null }>;
}

const SEVERITY = {
  green:   { color: '#10B981', label: 'Locked' },
  amber:   { color: '#F59E0B', label: 'Partial' },
  red:     { color: '#EF4444', label: 'Unlock soon' },
  unknown: { color: '#94A3B8', label: 'Unknown' },
} as const;

function fmtUnlock(at: number | null): string {
  if (!at) return '—';
  return new Date(at * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const LOCKER_DISPLAY: Record<string, string> = {
  'team-finance': 'Team Finance',
  unicrypt: 'Unicrypt',
  pinklock: 'PinkLock',
  other: 'Other',
};

export function LpLockPanel(props: LpLockPanelProps) {
  const s = SEVERITY[props.severity];
  return (
    <div
      className="rounded-xl border bg-white/[0.02] p-3"
      style={{ borderColor: `${s.color}55` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-3.5 h-3.5" style={{ color: s.color }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: s.color }}>
          LP {s.label}
        </span>
        <span className="ml-auto text-[11px] font-mono text-slate-300 tabular-nums">
          {props.totalLockedPct}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <div className="text-slate-500 uppercase text-[10px] font-semibold mb-0.5">Next unlock</div>
          <div className="text-slate-200 font-medium">{fmtUnlock(props.soonestUnlockAt)}</div>
          {props.daysUntilUnlock !== null ? (
            <div className="text-slate-500 text-[10px] mt-0.5">
              in {props.daysUntilUnlock}d
            </div>
          ) : null}
        </div>
        <div>
          <div className="text-slate-500 uppercase text-[10px] font-semibold mb-0.5">Lockers</div>
          {props.byLocker.length === 0 ? (
            <div className="text-slate-500 text-[10px]">—</div>
          ) : (
            <ul className="text-slate-200 text-[10px] space-y-0.5">
              {props.byLocker.map((l) => (
                <li key={l.locker} className="flex justify-between">
                  <span>{LOCKER_DISPLAY[l.locker] ?? l.locker}</span>
                  <span className="tabular-nums">{Math.round(l.lpShare * 100)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
