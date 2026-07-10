'use client';

import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import type { Entry, MeResponse } from './types';
import { Countdown } from './Countdown';
import { formatPoints } from './utils';

export function MyPredictionsView({
  me,
  loading,
  error,
  signedIn,
  now,
  onSignIn,
}: {
  me: MeResponse | null;
  loading: boolean;
  error: boolean;
  signedIn: boolean;
  now: number;
  onSignIn: () => void;
}) {
  if (!signedIn) {
    return (
      <div className="nl-glass rounded-2xl px-5 py-10 text-center">
        <h3 className="text-base font-semibold text-white">Sign in to track your predictions</h3>
        <p className="text-sm text-gray-400 mt-1 mb-4">Your open positions and history live here.</p>
        <button onClick={onSignIn} className="nl-btn-neon !rounded-xl mx-auto">Sign in</button>
      </div>
    );
  }
  if (loading && !me) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nl-glass rounded-2xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }
  if (error && !me) {
    return (
      <div className="nl-glass rounded-2xl px-5 py-10 text-center">
        <h3 className="text-base font-semibold text-white">Couldn’t load your predictions</h3>
        <p className="text-sm text-gray-400 mt-1">Please try again in a moment.</p>
      </div>
    );
  }

  const open = me?.open ?? [];
  const history = me?.history ?? [];

  return (
    <div className="space-y-5">
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Open · {open.length}</h4>
        {open.length === 0 ? (
          <div className="nl-glass rounded-2xl px-4 py-6 text-center text-sm text-gray-500">
            No open predictions. Jump into a live market.
          </div>
        ) : (
          <div className="space-y-2">
            {open.map((e) => (
              <OpenEntryRow key={e.id} entry={e} now={now} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">History · {history.length}</h4>
        {history.length === 0 ? (
          <div className="nl-glass rounded-2xl px-4 py-6 text-center text-sm text-gray-500">
            No resolved predictions yet.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((e) => (
              <HistoryRow key={e.id} entry={e} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function OpenEntryRow({ entry, now }: { entry: Entry; now: number }) {
  const yes = entry.side === 'yes';
  const potential = Math.round(entry.stake * entry.multiplier);
  return (
    <div className="nl-glass rounded-2xl px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white truncate">{entry.market.question || entry.symbol}</span>
        <Countdown closesAt={entry.market.closesAt} now={now} size="sm" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[12px]">
        <span className={`font-bold ${yes ? 'text-emerald-400' : 'text-rose-400'}`}>
          {entry.side.toUpperCase()} · {formatPoints(entry.stake)} pts · {entry.multiplier.toFixed(2)}x
        </span>
        <span className="text-gray-400">
          Potential <span className={`font-bold tabular-nums ${yes ? 'text-emerald-400' : 'text-rose-400'}`}>{formatPoints(potential)}</span> pts
        </span>
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: Entry }) {
  const status = entry.status?.toLowerCase();
  const won = status === 'won';
  const lost = status === 'lost';
  const void_ = status === 'void';

  const Icon = won ? CheckCircle2 : lost ? XCircle : MinusCircle;
  const tone = won ? 'text-emerald-400' : lost ? 'text-rose-400' : 'text-gray-400';
  const label = won ? 'Won' : lost ? 'Lost' : void_ ? 'Void' : entry.status;
  const delta = won ? `+${formatPoints(entry.payout)}` : lost ? `-${formatPoints(entry.stake)}` : '±0';

  return (
    <div className="nl-glass rounded-2xl px-3.5 py-3 flex items-center gap-3">
      <Icon className={`w-5 h-5 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">{entry.market.question || entry.symbol}</div>
        <div className="text-[11px] text-gray-500">
          {entry.side.toUpperCase()} · {formatPoints(entry.stake)} pts · {entry.multiplier.toFixed(2)}x
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold tabular-nums ${tone}`}>{delta}</div>
        <div className={`text-[10px] font-semibold uppercase ${tone}`}>{label}</div>
      </div>
    </div>
  );
}
