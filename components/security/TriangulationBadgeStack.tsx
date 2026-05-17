'use client';

import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react';

/**
 * TriangulationBadgeStack — pairs with the honeypotTriangulator lib.
 * Renders 1 badge per source that voted, color-coded by verdict.
 * Hover tooltip explains the consensus.
 *
 * Audit §B.4 P1 source-triangulation badge stack.
 */

export interface TriangulationBadgeStackProps {
  honeypot: boolean;
  confidence: 'high' | 'medium' | 'low';
  honeypotSources: string[];
  safeSources: string[];
}

export function TriangulationBadgeStack(props: TriangulationBadgeStackProps) {
  const totalVoted = props.honeypotSources.length + props.safeSources.length;
  if (totalVoted === 0) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-white/[0.04] border border-white/10 text-slate-300"
        title="No security source has indexed this token yet"
      >
        <ShieldQuestion className="w-3 h-3" />
        Unverified
      </span>
    );
  }
  const tooltip = props.honeypot
    ? `Honeypot voted by: ${props.honeypotSources.join(', ')} (${props.confidence} confidence)`
    : `Marked safe by: ${props.safeSources.join(', ')} (${props.confidence} confidence)`;
  const color = props.honeypot
    ? props.confidence === 'high'
      ? { c: '#EF4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.45)' }
      : { c: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.45)' }
    : { c: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.45)' };
  const Icon = props.honeypot
    ? props.confidence === 'high' ? ShieldX : ShieldAlert
    : ShieldCheck;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border"
      style={{ color: color.c, background: color.bg, borderColor: color.border }}
      title={tooltip}
    >
      <Icon className="w-3 h-3" />
      <span>{props.honeypot ? 'Honeypot' : 'Safe'}</span>
      <span className="opacity-70 tabular-nums">{totalVoted}/4</span>
    </span>
  );
}
