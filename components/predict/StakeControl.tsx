'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Zap } from 'lucide-react';
import type { Market, Side } from './types';
import { formatPoints, yesPct } from './utils';

const CHIPS = [10, 50, 100];

interface Props {
  market: Market;
  points: number | null;
  signedIn: boolean;
  submitting: boolean;
  onEnter: (side: Side, stake: number) => void;
  onSignIn: () => void;
}

// The stake surface for the featured market: choose a side (emerald YES / rose
// NO), pick a stake from chips or Max, see the potential payout, and confirm
// into a deep neon-blue action button.
export function StakeControl({ market, points, signedIn, submitting, onEnter, onSignIn }: Props) {
  const [side, setSide] = useState<Side>('yes');
  const [stake, setStake] = useState<number>(10);

  const yes = yesPct(market.probYes);
  const no = 100 - yes;
  const mult = side === 'yes' ? market.yesMultiplier : market.noMultiplier;
  const maxStake = points != null ? Math.max(0, Math.floor(points)) : 0;
  const affordable = points == null || stake <= maxStake;
  const potential = Math.round(stake * mult);

  // Clamp the stake to available points whenever the balance updates.
  useEffect(() => {
    if (points != null && stake > maxStake) setStake(Math.min(stake, maxStake) || Math.min(10, maxStake));
  }, [points, maxStake]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit = signedIn && stake > 0 && affordable && !submitting;

  return (
    <div className="space-y-3">
      {/* YES / NO selector cards */}
      <div className="grid grid-cols-2 gap-3">
        <SideCard
          label="YES"
          pct={yes}
          multiplier={market.yesMultiplier}
          tone="emerald"
          selected={side === 'yes'}
          onSelect={() => setSide('yes')}
        />
        <SideCard
          label="NO"
          pct={no}
          multiplier={market.noMultiplier}
          tone="rose"
          selected={side === 'no'}
          onSelect={() => setSide('no')}
        />
      </div>

      {/* stake chips + max */}
      <div className="flex items-center gap-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setStake(c)}
            className={`flex-1 h-9 rounded-xl text-sm font-semibold tabular-nums border transition-all active:scale-[0.96] ${
              stake === c
                ? 'bg-[#0066FF]/20 border-[#0066FF]/55 text-white shadow-[0_0_16px_rgba(0,102,255,0.25)]'
                : 'bg-white/[0.03] border-white/[0.08] text-gray-300 hover:border-white/20'
            }`}
          >
            {c}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setStake(maxStake || 0)}
          disabled={!signedIn || maxStake <= 0}
          className="flex-1 h-9 rounded-xl text-sm font-semibold border border-white/[0.08] bg-white/[0.03] text-gray-300 hover:border-white/20 active:scale-[0.96] disabled:opacity-40 transition-all"
        >
          Max
        </button>
      </div>

      {/* payout preview */}
      <div className="flex items-center justify-between rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-2 text-sm">
        <span className="text-gray-400">
          Stake <span className="text-white font-semibold tabular-nums">{formatPoints(stake)}</span> pts
        </span>
        <span className="text-gray-400">
          Potential{' '}
          <span className={`font-bold tabular-nums ${side === 'yes' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatPoints(potential)}
          </span>{' '}
          pts
        </span>
      </div>

      {/* action */}
      {signedIn ? (
        <button
          type="button"
          onClick={() => onEnter(side, stake)}
          disabled={!canSubmit}
          className="nl-btn-neon w-full !h-11 !text-sm !py-0 !rounded-xl disabled:!opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Placing…
            </>
          ) : !affordable ? (
            <>Not enough points</>
          ) : (
            <>
              <Zap className="w-4 h-4" /> Predict {side.toUpperCase()} · {formatPoints(stake)} pts
            </>
          )}
        </button>
      ) : (
        <button type="button" onClick={onSignIn} className="nl-btn-neon w-full !h-11 !text-sm !py-0 !rounded-xl">
          Sign in to predict
        </button>
      )}

      <p className="flex items-center justify-center gap-1 text-[10px] text-gray-500">
        <Check className="w-3 h-3 text-emerald-500" /> Free Naka Points · for fun, no real money
      </p>
    </div>
  );
}

function SideCard({
  label,
  pct,
  multiplier,
  tone,
  selected,
  onSelect,
}: {
  label: string;
  pct: number;
  multiplier: number;
  tone: 'emerald' | 'rose';
  selected: boolean;
  onSelect: () => void;
}) {
  const base =
    tone === 'emerald'
      ? {
          on: 'border-emerald-400/70 bg-emerald-500/[0.14] shadow-[0_0_22px_rgba(16,185,129,0.28)]',
          off: 'border-emerald-500/20 bg-emerald-500/[0.05] hover:border-emerald-400/40',
          text: 'text-emerald-400',
        }
      : {
          on: 'border-rose-400/70 bg-rose-500/[0.14] shadow-[0_0_22px_rgba(244,63,94,0.28)]',
          off: 'border-rose-500/20 bg-rose-500/[0.05] hover:border-rose-400/40',
          text: 'text-rose-400',
        };
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.97] ${selected ? base.on : base.off}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-extrabold tracking-wide ${base.text}`}>{label}</span>
        <span className={`text-lg font-extrabold tabular-nums ${base.text}`}>{pct}%</span>
      </div>
      <div className="mt-1 text-[11px] text-gray-400">
        {label === 'YES' ? 'Win up to ' : ''}
        <span className="text-gray-200 font-semibold tabular-nums">{multiplier.toFixed(2)}x</span>
      </div>
    </button>
  );
}
