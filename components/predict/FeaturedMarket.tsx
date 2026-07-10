'use client';

import { Flame, TrendingUp, Users } from 'lucide-react';
import type { Entry, Market, MeResponse, Side } from './types';
import { SymbolBadge } from './SymbolBadge';
import { LivePulse } from './LivePulse';
import { AnimatedPrice } from './AnimatedPrice';
import { Countdown } from './Countdown';
import { PriceChart } from './PriceChart';
import { StakeControl } from './StakeControl';
import { formatPoints, marketQuestion, remainingFrom } from './utils';

interface Props {
  market: Market;
  now: number;
  livePrice: number | null;
  me: MeResponse | null;
  signedIn: boolean;
  submitting: boolean;
  onEnter: (side: Side, stake: number) => void;
  onSignIn: () => void;
}

export function FeaturedMarket({ market, now, livePrice, me, signedIn, submitting, onEnter, onSignIn }: Props) {
  const price = livePrice ?? market.price;
  // "favorable" = does the live price currently satisfy a YES outcome?
  const favorable = market.direction === 'above' ? price >= market.target : price <= market.target;
  const r = remainingFrom(market.closesAt, now);

  const existing: Entry | undefined = me?.open?.find((e) => e.marketId === market.id);

  return (
    <section className="nl-glass rounded-3xl p-4 sm:p-5 overflow-hidden">
      {/* header row */}
      <div className="flex items-start gap-3">
        <SymbolBadge symbol={market.symbol} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{market.symbol}</span>
            <LivePulse />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9FD0FF] bg-[#0066FF]/[0.14] border border-[#0066FF]/25 rounded-full px-2 py-0.5">
              Breaking · {market.horizonSeconds >= 60 ? `${Math.round(market.horizonSeconds / 60)}m` : `${market.horizonSeconds}s`}
            </span>
          </div>
          <h3 className="mt-1 text-[15px] sm:text-base font-semibold text-white leading-snug">
            {marketQuestion(market, now)}
          </h3>
        </div>
      </div>

      {/* price + countdown band */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Live price</div>
          <AnimatedPrice value={price} className="text-3xl sm:text-4xl font-extrabold text-white" />
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-gray-500">Closes in</div>
          <Countdown closesAt={market.closesAt} now={now} size="lg" />
        </div>
      </div>

      {/* chart */}
      <div className="mt-3">
        <PriceChart series={market.series} target={market.target} livePrice={price} favorable={favorable} height={172} />
      </div>

      {/* meta row */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-gray-400">
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" /> {formatPoints(market.volume)} pts staked
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="w-3.5 h-3.5" /> {formatPoints(market.entriesCount)} predictions
        </span>
        <span className="inline-flex items-center gap-1 ms-auto">
          <Flame className={`w-3.5 h-3.5 ${favorable ? 'text-emerald-400' : 'text-rose-400'}`} />
          {favorable ? 'YES leading' : 'NO leading'}
        </span>
      </div>

      {/* model-estimate disclaimer */}
      <p className="mt-3 text-[10px] text-gray-500">
        Odds are an honest model estimate from live price action, not a guarantee.
      </p>

      {/* stake OR existing position */}
      <div className="mt-3">
        {existing ? (
          <ExistingPosition entry={existing} closed={r.closed} />
        ) : (
          <StakeControl
            market={market}
            points={me?.points ?? null}
            signedIn={signedIn}
            submitting={submitting}
            onEnter={onEnter}
            onSignIn={onSignIn}
          />
        )}
      </div>
    </section>
  );
}

function ExistingPosition({ entry, closed }: { entry: Entry; closed: boolean }) {
  const yes = entry.side === 'yes';
  const potential = Math.round(entry.stake * entry.multiplier);
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 ${
        yes ? 'border-emerald-400/40 bg-emerald-500/[0.08]' : 'border-rose-400/40 bg-rose-500/[0.08]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-gray-400">Your position</span>
        <span className={`text-xs font-bold ${yes ? 'text-emerald-400' : 'text-rose-400'}`}>
          {entry.side.toUpperCase()} · {entry.multiplier.toFixed(2)}x
        </span>
      </div>
      <div className="mt-1.5 flex items-end justify-between">
        <div>
          <div className="text-lg font-extrabold text-white tabular-nums">{formatPoints(entry.stake)} pts</div>
          <div className="text-[11px] text-gray-500">staked</div>
        </div>
        <div className="text-right">
          <div className={`text-lg font-extrabold tabular-nums ${yes ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatPoints(potential)} pts
          </div>
          <div className="text-[11px] text-gray-500">potential payout</div>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        {closed ? 'Resolving this round…' : 'You’re in. One prediction per market. Good luck.'}
      </p>
    </div>
  );
}
