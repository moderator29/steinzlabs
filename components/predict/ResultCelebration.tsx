'use client';

import { useEffect, useState } from 'react';
import { PartyPopper, X } from 'lucide-react';
import type { Entry } from './types';
import { ShareToWire } from './ShareToWire';
import { formatPoints } from './utils';

export interface Celebration {
  id: string;
  entry: Entry;
  won: boolean;
  streak: number;
}

// A tasteful, one-at-a-time flash when an open prediction resolves. Win = an
// emerald burst with the payout, streak and a Share button. Loss = a subtle rose
// nudge. Auto-dismisses; wins linger a little longer so the share is reachable.
export function ResultCelebration({ celebration, onClose }: { celebration: Celebration | null; onClose: () => void }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!celebration) {
      setShown(false);
      return;
    }
    const raf = requestAnimationFrame(() => setShown(true));
    const life = celebration.won ? 8000 : 4000;
    const t = setTimeout(onClose, life);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [celebration, onClose]);

  if (!celebration) return null;
  const { entry, won, streak } = celebration;
  const payout = Math.round(entry.payout);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
      <div
        className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 ${
          shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        } ${
          won
            ? 'border-emerald-400/50 bg-emerald-500/[0.16] shadow-[0_0_36px_rgba(16,185,129,0.35)]'
            : 'border-rose-400/40 bg-rose-500/[0.12]'
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              won ? 'bg-emerald-400/20' : 'bg-rose-400/15'
            }`}
          >
            {won ? (
              <PartyPopper className="w-5 h-5 text-emerald-300" />
            ) : (
              <span className="text-lg" aria-hidden>
                🎯
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {won ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-extrabold tabular-nums text-emerald-300">+{formatPoints(payout)} pts</span>
                  {streak > 1 && <span className="text-xs font-bold text-orange-300">{streak} streak 🔥</span>}
                </div>
                <div className="text-[12px] text-emerald-200/90 truncate">
                  {entry.symbol} · you called it. Nice one.
                </div>
                <div className="mt-2">
                  <ShareToWire entry={entry} />
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-rose-200">Missed it. Next one’s yours.</div>
                <div className="text-[12px] text-rose-200/80 truncate">
                  {entry.symbol} · {formatPoints(entry.stake)} pts
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:text-white"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
