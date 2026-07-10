'use client';

import type { Market } from './types';
import { SymbolBadge } from './SymbolBadge';
import { Countdown } from './Countdown';
import { formatUsd, yesPct, directionWord } from './utils';

// Compact market tile for the "other live markets" grid. Tap to feature + enter.
export function MarketCard({
  market,
  now,
  active,
  onSelect,
}: {
  market: Market;
  now: number;
  active: boolean;
  onSelect: () => void;
}) {
  const yes = yesPct(market.probYes);
  const no = 100 - yes;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`nl-glass nl-glass--interactive flex flex-col gap-3 rounded-2xl p-3.5 text-left transition-transform active:scale-[0.98] ${
        active ? '!border-[#0066FF]/60 shadow-[0_0_26px_rgba(0,102,255,0.3)]' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <SymbolBadge symbol={market.symbol} size={32} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">{market.symbol}</div>
          <div className="truncate text-[11px] text-gray-400">
            {directionWord(market.direction)} {formatUsd(market.target)}
          </div>
        </div>
        <Countdown closesAt={market.closesAt} now={now} size="sm" />
      </div>

      {/* YES/NO split bar */}
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-lg bg-white/[0.05]">
        <div
          className="h-full rounded-l bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
          style={{ width: `${yes}%` }}
        />
        <div
          className="h-full rounded-r bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)]"
          style={{ width: `${no}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
        <span className="text-emerald-400">YES {yes}%</span>
        <span className="text-rose-400">{no}% NO</span>
      </div>
    </button>
  );
}
