'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, Gift, Loader2, Sparkles } from 'lucide-react';
import type { DailyClaimResult } from './types';
import { useDaily } from './hooks';
import { formatPoints } from './utils';

// Long-form countdown to the next claim window: "5h 12m", "12m 04s", "48s".
function untilLabel(nextAt: string | null, now: number): string {
  if (!nextAt) return 'soon';
  const ms = Date.parse(nextAt) - now;
  if (Number.isNaN(ms) || ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function DailyBonus({ now, onClaimed }: { now: number; onClaimed?: (points: number) => void }) {
  const daily = useDaily(true);
  const [claiming, setClaiming] = useState(false);
  const [burst, setBurst] = useState<{ awarded: number; streak: number } | null>(null);
  const [countUp, setCountUp] = useState(0);
  const raf = useRef<number | null>(null);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = daily.data;

  const runCountUp = useCallback((to: number) => {
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setCountUp(Math.round(to * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
  }, []);

  const claim = useCallback(async () => {
    if (claiming || !status?.canClaim) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/predict/daily', { method: 'POST' });
      const json = (await res.json()) as DailyClaimResult;
      if (res.ok && json.ok) {
        const awarded = json.awarded ?? 0;
        setBurst({ awarded, streak: json.dailyStreak ?? status.dailyStreak });
        runCountUp(awarded);
        if (typeof json.points === 'number') onClaimed?.(json.points);
        if (burstTimer.current) clearTimeout(burstTimer.current);
        burstTimer.current = setTimeout(() => setBurst(null), 2600);
      }
      daily.refresh();
    } catch {
      // leave the button in its claimable state so the user can retry
    } finally {
      setClaiming(false);
    }
  }, [claiming, status, daily, onClaimed, runCountUp]);

  useEffect(
    () => () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      if (burstTimer.current) clearTimeout(burstTimer.current);
    },
    [],
  );

  // Loading placeholder keeps the header height stable.
  if (!status) {
    return <div className="h-8 w-28 rounded-full bg-white/[0.04] animate-pulse" aria-hidden />;
  }

  const streak = status.dailyStreak ?? 0;

  // Just claimed → celebratory count-up pill with a tiny particle burst.
  if (burst) {
    return (
      <div className="relative inline-flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-500/[0.14] px-3 py-1.5 shadow-[0_0_22px_rgba(16,185,129,0.35)]">
        <Gift className="w-4 h-4 text-emerald-300" />
        <span className="text-sm font-bold tabular-nums text-emerald-200">+{formatPoints(countUp)}</span>
        <span className="inline-flex items-center gap-0.5 text-[11px] text-emerald-300/90">
          day {burst.streak} <Flame className="w-3 h-3 text-orange-400" />
        </span>
        <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
          {['-8px', '4px', '16px'].map((left, i) => (
            <Sparkles
              key={left}
              className="absolute -top-1 h-3 w-3 animate-ping text-emerald-300"
              style={{ left, animationDelay: `${i * 90}ms`, animationDuration: '1.4s' }}
            />
          ))}
        </span>
      </div>
    );
  }

  // Claimable → glowing call to action.
  if (status.canClaim) {
    return (
      <button
        type="button"
        onClick={claim}
        disabled={claiming}
        className="group relative inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/[0.16] px-3 py-1.5 font-semibold text-emerald-200 shadow-[0_0_18px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-500/[0.24] hover:shadow-[0_0_26px_rgba(16,185,129,0.45)] disabled:opacity-70 animate-pulse hover:animate-none"
      >
        {claiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
        <span className="text-xs sm:text-sm">{claiming ? 'Claiming…' : 'Claim daily bonus'}</span>
        {streak > 0 && (
          <span className="ms-0.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-100">
            <Flame className="w-3 h-3" /> {streak}
          </span>
        )}
      </button>
    );
  }

  // Not claimable → live countdown to the next window.
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
      <Gift className="w-4 h-4 text-gray-400" />
      <span className="text-[11px] text-gray-400">Daily in</span>
      <span className="text-xs font-bold tabular-nums text-white">{untilLabel(status.nextAt, now)}</span>
      {streak > 0 && (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-orange-300">
          <Flame className="w-3 h-3" /> {streak}
        </span>
      )}
    </div>
  );
}
