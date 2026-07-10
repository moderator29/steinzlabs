'use client';

import { Crown, Flame, Trophy } from 'lucide-react';
import type { Leader } from './types';
import { formatPoints, symbolColor } from './utils';

export function LeaderboardView({
  leaders,
  loading,
  error,
  currentUserId,
}: {
  leaders: Leader[] | null;
  loading: boolean;
  error: boolean;
  currentUserId: string | null;
}) {
  if (loading && !leaders) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="nl-glass rounded-2xl h-14 animate-pulse" />
        ))}
      </div>
    );
  }
  if (error && !leaders) {
    return <EmptyState title="Leaderboard unavailable" body="We couldn’t reach the leaderboard right now." />;
  }
  if (!leaders || leaders.length === 0) {
    return <EmptyState title="No predictors yet" body="Be the first to climb the board. Place a prediction." />;
  }

  return (
    <div className="space-y-2">
      {leaders.map((l, i) => {
        const isMe = currentUserId != null && l.userId === currentUserId;
        return (
          <div
            key={l.userId}
            className={`nl-glass rounded-2xl px-3.5 py-3 flex items-center gap-3 ${
              isMe ? '!border-[#0066FF]/50 shadow-[0_0_20px_rgba(0,102,255,0.22)]' : ''
            }`}
          >
            <RankBadge rank={i + 1} />
            <Avatar leader={l} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-white truncate">{l.displayName || l.username}</span>
                {isMe && (
                  <span className="text-[9px] font-bold uppercase text-[#9FD0FF] bg-[#0066FF]/20 rounded px-1.5 py-0.5">You</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {formatPoints(l.wins)} wins
                </span>
                <span className="inline-flex items-center gap-1">
                  <Flame className="w-3 h-3 text-orange-400" /> {l.bestStreak} best
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-extrabold text-white tabular-nums">{formatPoints(l.points)}</div>
              <div className="text-[10px] text-gray-500">points</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const top = rank <= 3;
  const tone =
    rank === 1 ? 'text-amber-300 bg-amber-400/15 border-amber-400/30'
    : rank === 2 ? 'text-slate-200 bg-slate-300/10 border-slate-300/25'
    : rank === 3 ? 'text-orange-300 bg-orange-400/12 border-orange-400/25'
    : 'text-gray-400 bg-white/[0.04] border-white/[0.08]';
  return (
    <div className={`w-7 h-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-bold tabular-nums ${tone}`}>
      {top ? <Crown className="w-3.5 h-3.5" /> : rank}
    </div>
  );
}

function Avatar({ leader }: { leader: Leader }) {
  const color = symbolColor(leader.username || leader.userId);
  if (leader.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={leader.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />;
  }
  const letter = (leader.displayName || leader.username || '?').slice(0, 1).toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
      style={{ backgroundColor: color }}
    >
      {letter}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="nl-glass rounded-2xl px-5 py-10 text-center">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="text-sm text-gray-400 mt-1">{body}</p>
    </div>
  );
}
