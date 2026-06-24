'use client';

/**
 * Behavior-shift timeline. Renders a horizontal axis of dated
 * markers showing when a wallet pivoted between trade styles, took
 * a big risk swing, or banked / lost a notable PnL chunk. Pairs
 * with lib/walletIntel/behaviorShift.ts — the lib emits the
 * BehaviorShift array; this component renders it.
 *
 * Markers are bucketed by kind (style / risk / pnl) and color-coded.
 * Each marker shows the date + summary in a tooltip. The axis spans
 * from earliest to latest shift; if there are zero shifts the
 * component renders an empty-state caption.
 */

export interface TimelineShift {
  at: number; // unix seconds
  kind: 'style' | 'risk' | 'pnl';
  summary: string;
  magnitude: number;
}

export interface BehaviorTimelineProps {
  shifts: TimelineShift[];
  /** Optional caption rendered above the axis. */
  caption?: string;
}

const KIND_COLOR: Record<TimelineShift['kind'], string> = {
  style: '#0066FF',
  risk: '#F59E0B',
  pnl: '#10B981',
};

const KIND_LABEL: Record<TimelineShift['kind'], string> = {
  style: 'Style shift',
  risk: 'Risk shift',
  pnl: 'PnL shift',
};

function dateLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function BehaviorTimeline({ shifts, caption }: BehaviorTimelineProps) {
  if (shifts.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-400 text-center">
        No meaningful behavior shifts detected in this wallet's history.
      </div>
    );
  }

  const sorted = [...shifts].sort((a, b) => a.at - b.at);
  const first = sorted[0].at;
  const last = sorted[sorted.length - 1].at;
  const span = Math.max(1, last - first);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
      {caption ? <p className="text-xs text-slate-300">{caption}</p> : null}
      <div className="relative h-12">
        <div className="absolute top-1/2 left-0 right-0 h-px bg-white/[0.08]" aria-hidden />
        {sorted.map((s, i) => {
          const left = ((s.at - first) / span) * 100;
          const color = KIND_COLOR[s.kind];
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${left}%` }}
            >
              <div
                role="img"
                aria-label={`${KIND_LABEL[s.kind]} on ${dateLabel(s.at)}: ${s.summary}`}
                title={`${dateLabel(s.at)} — ${s.summary}`}
                className="w-3 h-3 rounded-full border-2 cursor-help"
                style={{ backgroundColor: color + '40', borderColor: color }}
              />
            </div>
          );
        })}
        <span className="absolute left-0 bottom-0 text-[10px] text-slate-500 tabular-nums">{dateLabel(first)}</span>
        <span className="absolute right-0 bottom-0 text-[10px] text-slate-500 tabular-nums">{dateLabel(last)}</span>
      </div>
      <ul className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
        {(Object.keys(KIND_LABEL) as TimelineShift['kind'][]).map((k) => (
          <li key={k} className="inline-flex items-center gap-1">
            <span aria-hidden className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: KIND_COLOR[k] }} />
            {KIND_LABEL[k]}
          </li>
        ))}
      </ul>
    </div>
  );
}
