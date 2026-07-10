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
      className={`nl-glass nl-glass--interactive text-left rounded-2xl p-3.5 flex flex-col gap-2.5 ${
        active ? '!border-[#0066FF]/50 shadow-[0_0_22px_rgba(0,102,255,0.25)]' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <SymbolBadge symbol={market.symbol} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-white">{market.symbol}</div>
          <div className="text-[11px] text-gray-400 truncate">
            {directionWord(market.direction)} {formatUsd(market.target)}
          </div>
        </div>
        <Countdown closesAt={market.closesAt} now={now} size="sm" />
      </div>

      {/* YES/NO split bar */}
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full bg-emerald-400" style={{ width: `${yes}%` }} />
        <div className="h-full bg-rose-400" style={{ width: `${no}%` }} />
      </div>
      <div className="flex items-center justify-between text-[11px] font-semibold tabular-nums">
        <span className="text-emerald-400">YES {yes}%</span>
        <span className="text-rose-400">{no}% NO</span>
      </div>
    </button>
  );
}
