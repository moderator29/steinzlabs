'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import type { Entry, Market, MeResponse, Side } from './types';
import { usePrices } from './hooks';
import { AnimatedPrice } from './AnimatedPrice';
import { SymbolBadge } from './SymbolBadge';
import { LivePulse } from './LivePulse';
import { formatPoints, remainingFrom } from './utils';

const TOKENS = ['SOL', 'BTC', 'ETH', 'BNB'] as const;
const CHIPS = [10, 50, 100];

interface Props {
  markets: Market[];
  now: number;
  me: MeResponse | null;
  signedIn: boolean;
  submitting: boolean;
  onEnter: (marketId: string, side: Side, stake: number) => Promise<boolean>;
  onSignIn: () => void;
}

// Quick Play — the hook. One-tap UP/DOWN on the soonest-closing `direction`
// market for the selected token. Optimistic, addictive, dead simple. It rolls
// into the next 60s round automatically as markets poll in.
export function QuickPlay({ markets, now, me, signedIn, submitting, onEnter, onSignIn }: Props) {
  const [token, setToken] = useState<(typeof TOKENS)[number]>('SOL');
  const [stake, setStake] = useState<number>(10);
  const [pending, setPending] = useState<Side | null>(null);

  // Soonest-closing OPEN direction market for the selected token.
  const market = useMemo(() => {
    const open = markets.filter(
      (m) => m.kind === 'direction' && m.symbol === token && Date.parse(m.closesAt) - now > 0,
    );
    return open.sort((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt))[0] ?? null;
  }, [markets, token, now]);

  // Which tokens currently have a live direction round (for the switcher dots).
  const liveTokens = useMemo(() => {
    const s = new Set<string>();
    for (const m of markets) {
      if (m.kind === 'direction' && Date.parse(m.closesAt) - now > 0) s.add(m.symbol);
    }
    return s;
  }, [markets, now]);

  const priceMap = usePrices([token], 2000);
  const price = priceMap[token]?.price ?? market?.price ?? null;

  const existing: Entry | undefined = market ? me?.open?.find((e) => e.marketId === market.id) : undefined;

  const points = me?.points ?? null;
  const affordable = points == null || stake <= points;

  // Clamp the stake selector to the balance.
  useEffect(() => {
    if (points != null && stake > points) setStake(Math.min(stake, Math.max(0, Math.floor(points))) || 10);
  }, [points, stake]);

  const tap = async (side: Side) => {
    if (!market || pending || submitting) return;
    if (!signedIn) return onSignIn();
    if (!affordable) return;
    setPending(side);
    try {
      await onEnter(market.id, side, stake);
    } finally {
      setPending(null);
    }
  };

  const r = market ? remainingFrom(market.closesAt, now) : null;
  const urgent = !!r && !r.closed && r.ms <= 10_000;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#0066FF]/25 bg-gradient-to-b from-[#0066FF]/[0.12] to-[#0066FF]/[0.02] p-4 sm:p-5">
      {/* header: label + token switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0066FF]/20 border border-[#0066FF]/40 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#9FD0FF]">
            <Zap className="w-3.5 h-3.5" /> Quick Play
          </span>
          <LivePulse label="60s" />
        </div>
        <div className="inline-flex gap-1 rounded-xl border border-white/[0.08] bg-black/20 p-1">
          {TOKENS.map((t) => {
            const active = t === token;
            const live = liveTokens.has(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setToken(t)}
                className={`relative inline-flex items-center gap-1 rounded-lg pl-1 pr-2.5 py-1 text-[11px] font-bold transition-all active:scale-[0.96] ${
                  active ? 'bg-[#0066FF] text-white shadow-[0_0_14px_rgba(0,102,255,0.5)]' : 'text-gray-400 hover:text-white'
                }`}
              >
                <SymbolBadge symbol={t} size={16} />
                {t}
                {live && !active && (
                  <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {!market ? (
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center">
          <p className="text-sm font-semibold text-white">Next {token} round starting…</p>
          <p className="mt-1 text-xs text-gray-400">A fresh 60-second UP/DOWN round opens every minute.</p>
        </div>
      ) : (
        <>
          {/* question */}
          <h3 className="mt-4 text-center text-base sm:text-lg font-semibold text-white">
            Will <span className="text-[#9FD0FF]">{market.symbol}</span> go{' '}
            <span className="text-emerald-400">UP</span> or <span className="text-rose-400">DOWN</span>?
          </h3>

          {/* price + big countdown */}
          <div className="mt-3 flex items-center justify-center gap-4">
            <SymbolBadge symbol={market.symbol} size={40} />
            <AnimatedPrice value={price} className="text-3xl sm:text-4xl font-extrabold text-white" />
          </div>
          <div className="mt-2 flex items-center justify-center">
            <span
              className={`text-4xl sm:text-5xl font-extrabold tabular-nums ${
                r?.closed ? 'text-gray-500' : urgent ? 'text-rose-300 animate-pulse' : 'text-white'
              }`}
            >
              {r?.closed ? 'Resolving' : r?.label}
            </span>
          </div>

          {existing ? (
            <LockedPosition entry={existing} closed={!!r?.closed} />
          ) : (
            <>
              {/* one-tap UP / DOWN */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <TapButton
                  side="yes"
                  label="UP"
                  Icon={TrendingUp}
                  pending={pending === 'yes'}
                  disabled={!!pending || submitting || (signedIn && !affordable)}
                  onTap={() => tap('yes')}
                />
                <TapButton
                  side="no"
                  label="DOWN"
                  Icon={TrendingDown}
                  pending={pending === 'no'}
                  disabled={!!pending || submitting || (signedIn && !affordable)}
                  onTap={() => tap('no')}
                />
              </div>

              {/* compact stake selector */}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Stake</span>
                {CHIPS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setStake(c)}
                    disabled={points != null && c > points}
                    className={`flex-1 h-8 rounded-xl text-xs font-bold tabular-nums border transition-all active:scale-[0.96] disabled:opacity-30 ${
                      stake === c
                        ? 'bg-[#0066FF]/25 border-[#0066FF]/60 text-white shadow-[0_0_12px_rgba(0,102,255,0.3)]'
                        : 'bg-white/[0.03] border-white/[0.08] text-gray-300 hover:border-white/25'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                <span className="text-[11px] text-gray-500 tabular-nums">
                  {signedIn ? `${formatPoints(points)} pts` : ''}
                </span>
              </div>

              {!signedIn ? (
                <button
                  type="button"
                  onClick={onSignIn}
                  className="mt-3 w-full rounded-xl border border-[#0066FF]/40 bg-[#0066FF]/[0.14] py-2 text-sm font-semibold text-[#9FD0FF] transition-all hover:bg-[#0066FF]/[0.22]"
                >
                  Sign in to play
                </button>
              ) : !affordable ? (
                <p className="mt-2 text-center text-[11px] text-rose-300">Not enough Naka Points for that stake.</p>
              ) : (
                <p className="mt-2 text-center text-[10px] text-gray-500">
                  One tap = one prediction · free Naka Points, no real money
                </p>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function TapButton({
  side,
  label,
  Icon,
  pending,
  disabled,
  onTap,
}: {
  side: Side;
  label: string;
  Icon: typeof TrendingUp;
  pending: boolean;
  disabled: boolean;
  onTap: () => void;
}) {
  const emerald = side === 'yes';
  const tone = emerald
    ? 'border-emerald-400/60 bg-emerald-500/[0.16] text-emerald-300 hover:bg-emerald-500/[0.26] hover:shadow-[0_0_28px_rgba(16,185,129,0.4)] active:scale-[0.96] active:bg-emerald-500/[0.32]'
    : 'border-rose-400/60 bg-rose-500/[0.16] text-rose-300 hover:bg-rose-500/[0.26] hover:shadow-[0_0_28px_rgba(244,63,94,0.4)] active:scale-[0.96] active:bg-rose-500/[0.32]';
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={`flex h-16 sm:h-20 items-center justify-center gap-2 rounded-xl border text-lg font-extrabold tracking-wide transition-all disabled:cursor-not-allowed disabled:opacity-50 ${tone}`}
    >
      {pending ? (
        <Loader2 className="w-6 h-6 animate-spin" />
      ) : (
        <>
          <Icon className="w-6 h-6" />
          {label}
        </>
      )}
    </button>
  );
}

function LockedPosition({ entry, closed }: { entry: Entry; closed: boolean }) {
  const up = entry.side === 'yes';
  const potential = Math.round(entry.stake * entry.multiplier);
  return (
    <div
      className={`mt-4 rounded-2xl border px-4 py-3.5 ${
        up ? 'border-emerald-400/45 bg-emerald-500/[0.1]' : 'border-rose-400/45 bg-rose-500/[0.1]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-300">
          <Lock className="w-3.5 h-3.5" /> You’re in
        </span>
        <span className={`inline-flex items-center gap-1 text-sm font-extrabold ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
          {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {up ? 'UP' : 'DOWN'} · {entry.multiplier.toFixed(2)}x
        </span>
      </div>
      <div className="mt-1.5 flex items-end justify-between">
        <div className="text-lg font-extrabold tabular-nums text-white">{formatPoints(entry.stake)} pts</div>
        <div className="text-right">
          <div className={`text-lg font-extrabold tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatPoints(potential)} pts
          </div>
          <div className="text-[11px] text-gray-500">potential</div>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400">
        {closed ? 'Resolving this round. Next one loads automatically.' : 'Locked in. Good luck!'}
      </p>
    </div>
  );
}
