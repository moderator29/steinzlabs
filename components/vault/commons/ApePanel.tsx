'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Flame, Trophy, Rocket, Skull, Coins, Hourglass } from 'lucide-react';

interface Round {
  id: string;
  symbol: string;
  name: string | null;
  image_url: string | null;
  entry_price_usd: number | null;
  resolves_at: string;
  votingOpen: boolean;
}
interface ApeState {
  round: Round | null;
  sentiment: { ape: number; nope: number; total: number };
  myVote: 'ape' | 'nope' | null;
  me: { points: number; streak: number; bestStreak: number };
  last: { symbol: string; outcome: 'ape' | 'nope' | 'flat' | null; move_pct: number | null } | null;
  leaderboard: { name: string; points: number; streak: number; mine: boolean }[];
}

function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'resolving…';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
}

export function ApePanel() {
  const [state, setState] = useState<ApeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cult/ape', { cache: 'no-store' });
      if (!res.ok) throw new Error('load');
      setState((await res.json()) as ApeState);
      setError(null);
    } catch {
      setError('Could not reach the round.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const vote = useCallback(async (choice: 'ape' | 'nope') => {
    if (voting) return;
    setVoting(true);
    try {
      const res = await fetch('/api/cult/ape', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      if (!res.ok && res.status !== 201) {
        const j = await res.json().catch(() => ({}));
        setError(j.error === 'already_voted' ? 'You already called this one.' : 'Vote did not land.');
      }
      await load();
    } catch {
      setError('Vote did not land.');
    } finally {
      setVoting(false);
    }
  }, [voting, load]);

  if (loading) return <p className="py-10 text-center text-sm text-[#8C9AC0]">Reading the omens…</p>;
  if (!state) return <p className="py-10 text-center text-sm text-[#FF9DB0]">{error ?? 'Unavailable.'}</p>;

  const { round, sentiment, myVote, me, last, leaderboard } = state;
  const apePct = sentiment.total ? Math.round((sentiment.ape / sentiment.total) * 100) : 50;
  const locked = !!myVote || !round?.votingOpen;

  return (
    <div className="space-y-5">
      {/* Your run */}
      <div className="flex items-center justify-center gap-5 text-center">
        <div>
          <div className="text-2xl font-extrabold text-white">{me.points}</div>
          <div className="text-[10px] uppercase tracking-wider text-[#8C9AC0]">cult points</div>
        </div>
        <div className="h-8 w-px bg-white/10" />
        <div>
          <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-[#FF8A3D]">
            {me.streak}<Flame size={18} className={me.streak > 0 ? 'text-[#FF8A3D]' : 'text-[#5A647F]'} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-[#8C9AC0]">streak · best {me.bestStreak}</div>
        </div>
      </div>

      {/* The card */}
      {!round ? (
        <div className="rounded-2xl border border-white/10 bg-[#070A16]/80 p-10 text-center">
          <div className="mb-2 flex justify-center text-[#5A647F]"><Hourglass size={28} /></div>
          <p className="text-sm text-[#8C9AC0]">No round live right now. The next coin drops soon · check back.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#0B1024] to-[#070A16]">
          <div className="flex items-center gap-3 p-5">
            {round.image_url ? (
              <Image src={round.image_url} alt="" width={48} height={48} className="rounded-full" unoptimized />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-full bg-white/5 text-[#8C9AC0]"><Coins size={22} /></div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xl font-extrabold text-white">${round.symbol}</h3>
              <p className="truncate text-xs text-[#8C9AC0]">{round.name || 'Trending now'} · {countdown(round.resolves_at)}</p>
            </div>
          </div>

          <p className="px-5 pb-3 text-center text-[15px] font-semibold text-[#C8D6FF]">
            Pump or dump in 24h? Make the call.
          </p>

          {/* APE / NOPE */}
          <div className="grid grid-cols-2 gap-3 px-5 pb-4">
            <button
              type="button"
              disabled={locked || voting}
              onClick={() => vote('ape')}
              aria-pressed={myVote === 'ape'}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-4 text-lg font-extrabold transition ${
                myVote === 'ape'
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-40'
              }`}
            >
              <Rocket size={22} /> APE
            </button>
            <button
              type="button"
              disabled={locked || voting}
              onClick={() => vote('nope')}
              aria-pressed={myVote === 'nope'}
              className={`flex flex-col items-center gap-1 rounded-2xl border-2 py-4 text-lg font-extrabold transition ${
                myVote === 'nope'
                  ? 'border-rose-400 bg-rose-500/20 text-rose-200'
                  : 'border-rose-500/30 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15 disabled:opacity-40'
              }`}
            >
              <Skull size={22} /> NOPE
            </button>
          </div>

          {/* Sentiment */}
          <div className="px-5 pb-5">
            <div className="mb-1 flex justify-between text-[11px] font-bold">
              <span className="text-emerald-300">{apePct}% APE</span>
              <span className="text-rose-300">{100 - apePct}% NOPE</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-rose-500/20">
              <span className="bg-emerald-400/80" style={{ width: `${apePct}%` }} />
            </div>
            <p className="mt-1.5 text-center text-[11px] text-[#6B779C]">
              {sentiment.total} {sentiment.total === 1 ? 'cultist has' : 'cultists have'} called it
              {myVote && ' · your call is locked'}
              {!myVote && !round.votingOpen && ' · voting closed'}
            </p>
          </div>
        </div>
      )}

      {error && <p className="text-center text-[12px] text-[#FF9DB0]">{error}</p>}

      {/* Last result */}
      {last && last.outcome && (
        <div className="rounded-xl border border-white/10 bg-[#070A16]/70 px-4 py-3 text-center text-[13px]">
          <span className="text-[#8C9AC0]">Last call: </span>
          <span className="font-bold text-white">${last.symbol}</span>{' '}
          <span className={`inline-flex items-center gap-1 ${last.outcome === 'ape' ? 'text-emerald-300' : last.outcome === 'nope' ? 'text-rose-300' : 'text-[#8C9AC0]'}`}>
            {last.outcome === 'ape' ? <><Rocket size={13} /> pumped</> : last.outcome === 'nope' ? <><Skull size={13} /> dumped</> : 'flat'}
            {last.move_pct != null && ` ${last.move_pct >= 0 ? '+' : ''}${last.move_pct}%`}
          </span>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#070A16]/80 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-[#FFD86B]">
            <Trophy size={14} /> Sharpest instincts
          </h3>
          <ol className="space-y-1.5">
            {leaderboard.map((p, i) => (
              <li key={`${p.name}-${i}`} className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ${p.mine ? 'bg-[#3D5AFE]/12' : ''}`}>
                <span className="w-5 text-[12px] font-bold text-[#6B779C]">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">
                  {p.name}
                </span>
                {p.streak > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] text-[#FF8A3D]">{p.streak}<Flame size={11} /></span>}
                <span className="text-[13px] font-bold text-[#FFD86B]">{p.points}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
