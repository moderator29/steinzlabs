'use client';

/**
 * §3 P2-A.4 — Replay controls. Pairs with AdvancedChart's replayIndex
 * prop: this component owns the index state, the play/pause loop, and
 * the speed selector. Pass `onChange` to bubble the index up so the
 * chart can render the truncated candle series.
 */

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, SkipBack } from 'lucide-react';

interface ReplayControlsProps {
  total: number;
  value: number;
  onChange: (next: number) => void;
  className?: string;
}

const SPEEDS = [1, 2, 4, 8] as const;
type Speed = (typeof SPEEDS)[number];

export default function ReplayControls({ total, value, onChange, className = '' }: ReplayControlsProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    // 250ms per tick at 1×, scaled down by speed.
    const periodMs = 250 / speed;
    intervalRef.current = setInterval(() => {
      onChange(Math.min(total - 1, value + 1));
    }, periodMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, speed, value, total, onChange]);

  // Auto-pause when we hit the end.
  useEffect(() => {
    if (value >= total - 1 && playing) setPlaying(false);
  }, [value, total, playing]);

  if (total <= 1) return null;

  return (
    <div className={`flex items-center gap-2 rounded-xl bg-black/30 border border-white/10 px-3 py-2 ${className}`}>
      <button
        type="button"
        onClick={() => onChange(0)}
        aria-label="Restart replay"
        className="p-1 rounded hover:bg-white/[0.06] text-slate-300"
      >
        <SkipBack className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setPlaying((v) => !v)}
        aria-label={playing ? 'Pause replay' : 'Play replay'}
        className="p-1 rounded hover:bg-white/[0.06] text-slate-200"
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>
      <input
        type="range"
        min={0}
        max={total - 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[#4d80ff]"
        aria-label="Replay position"
      />
      <span className="text-[10px] font-mono text-slate-400 tabular-nums whitespace-nowrap">
        {value + 1}/{total}
      </span>
      <div className="flex items-center gap-1">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              speed === s ? 'bg-[#4d80ff]/30 text-[#4d80ff] font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-label={`Replay speed ${s}x`}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
