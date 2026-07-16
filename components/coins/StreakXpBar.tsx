'use client';

/**
 * Compact nl-glass card showing the caller's real activity streak and derived
 * activity XP. Everything is sourced from /api/coins/streak, which computes days
 * from real coin_trades + wire_posts rows only. XP is a plainly labelled derived
 * score off real counts, not a spendable currency. When the user has no activity
 * we show a gentle "Start a streak" zero state (an honest zero, not a fake stat).
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Sparkles, Zap } from 'lucide-react';
import type { StreakXpResponse } from '@/app/api/coins/streak/route';

const AMBER = '#F0B90B';

export default function StreakXpBar({ className = '' }: { className?: string }) {
  const [data, setData] = useState<StreakXpResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/coins/streak')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: StreakXpResponse | null) => {
        if (alive) setData(json);
      })
      .catch(() => {
        if (alive) setData(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className={`nl-glass rounded-2xl p-4 ${className}`}>
        <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
        <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  if (!data) return null;

  const streakActive = data.currentStreak > 0;
  const hasActivity = data.activeDays > 0 || data.xp > 0;

  // Honest zero state. Showing "no streak yet" is not a fabricated stat.
  if (!hasActivity) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={`nl-glass rounded-2xl p-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04]">
            <Flame size={20} className="text-white/35" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white/90">Start a streak</div>
            <div className="text-xs leading-relaxed text-white/45">
              Trade or post on the Wire to begin. XP builds from your real trades and posts.
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  const pct = Math.round(data.progress * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={`nl-glass rounded-2xl p-4 ${className}`}
    >
      {/* Streak row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background: streakActive ? `${AMBER}1f` : 'rgba(255,255,255,0.04)',
            }}
          >
            <Flame
              size={20}
              strokeWidth={2}
              style={{
                color: streakActive ? AMBER : 'rgba(255,255,255,0.35)',
                filter: streakActive ? `drop-shadow(0 0 6px ${AMBER}66)` : undefined,
              }}
            />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span
                className="text-lg font-bold leading-none tabular-nums"
                style={{ color: streakActive ? AMBER : 'rgba(255,255,255,0.9)' }}
              >
                {data.currentStreak}
              </span>
              <span className="text-sm font-medium text-white/80">day streak</span>
            </div>
            <div className="mt-0.5 text-[11px] text-white/45">
              Best {data.bestStreak}
              {data.bestStreak === 1 ? ' day' : ' days'} {'·'} {data.activeDays} active
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0066FF]/12 px-2.5 py-1">
          <Zap size={13} strokeWidth={2.25} style={{ color: '#00C8FF' }} />
          <span className="text-xs font-semibold tabular-nums text-white/90">Lv {data.level}</span>
        </div>
      </div>

      {/* XP bar toward next level */}
      <div className="mt-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[11px] font-medium text-white/60">
            <Sparkles size={12} strokeWidth={2} className="text-white/45" />
            {data.xp} XP from your real trades and posts
          </span>
          <span className="text-[11px] tabular-nums text-white/45">
            {data.xpToNext} to Lv {data.level + 1}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #0066FF, #00C8FF)',
              boxShadow: '0 0 8px rgba(0,200,255,0.45)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.div>
  );
}
