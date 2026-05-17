'use client';

/**
 * LiveTape — left-rail real-time sniper fill ticker (B.2 P2). One
 * row per fill, color-coded by P&L outcome:
 *
 *   • emerald   filled green (post-fill price > entry)
 *   • red       filled red (post-fill price < entry)
 *   • slate     just filled, no P&L data yet
 *   • amber     kill-switch fired
 *
 * Newest row scales in from 0.92 → 1.0 over 220ms so the user's eye
 * snaps to the new fill without a jarring layout shift. Caps at 50
 * rows (older rows quietly drop).
 */

import { ArrowDown, ArrowUp, AlertOctagon } from 'lucide-react';

export interface TapeRow {
  id: string;
  symbol: string;
  /** UNIX seconds. */
  at: number;
  /** USD size of the fill. */
  sizeUsd: number;
  /** Post-fill P&L percentage. Null when not yet measured. */
  pnlPct: number | null;
  killSwitch?: boolean;
}

export interface LiveTapeProps {
  rows: TapeRow[];
  /** Optional click handler for opening the fill detail panel. */
  onRowClick?: (id: string) => void;
}

function fmtUsd(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function timeShort(sec: number): string {
  const d = new Date(sec * 1000);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function tone(row: TapeRow): { color: string; bg: string; icon: typeof ArrowUp | null; label: string } {
  if (row.killSwitch) return { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', icon: AlertOctagon, label: 'KILL' };
  if (row.pnlPct === null) return { color: '#94A3B8', bg: 'rgba(148,163,184,0.06)', icon: null, label: '—' };
  if (row.pnlPct > 0) return { color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: ArrowUp, label: `+${row.pnlPct.toFixed(1)}%` };
  return { color: '#EF4444', bg: 'rgba(239,68,68,0.10)', icon: ArrowDown, label: `${row.pnlPct.toFixed(1)}%` };
}

export function LiveTape({ rows, onRowClick }: LiveTapeProps) {
  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="Live sniper fills"
      className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto pr-1"
    >
      {rows.length === 0 ? (
        <div className="text-[11px] text-slate-500 px-2 py-3 text-center">
          Waiting for the first fill…
        </div>
      ) : (
        rows.slice(0, 50).map((row, idx) => {
          const t = tone(row);
          const Icon = t.icon;
          return (
            <button
              key={row.id}
              onClick={() => onRowClick?.(row.id)}
              className="grid grid-cols-[1fr_auto] gap-2 items-center px-2 py-1.5 rounded-md border border-white/[0.05] hover:border-white/15 text-left transition-all"
              style={{
                background: t.bg,
                animation: idx === 0 ? 'naka-tape-pop 220ms cubic-bezier(0.22,1,0.36,1)' : undefined,
              }}
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-white truncate">{row.symbol}</div>
                <div className="text-[10px] text-slate-500 tabular-nums">{timeShort(row.at)} · {fmtUsd(row.sizeUsd)}</div>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-0.5 font-mono font-bold text-[11px] tabular-nums" style={{ color: t.color }}>
                  {Icon ? <Icon className="w-2.5 h-2.5" /> : null}
                  {t.label}
                </div>
              </div>
            </button>
          );
        })
      )}
      <style jsx>{`
        @keyframes naka-tape-pop {
          0% { transform: scale(0.92); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
