'use client';

/**
 * Naka Score ring: a compact SVG radial gauge (0-100) coloured by band, with the
 * number in the centre and a "Naka Score" label. Tapping it expands an nl-glass
 * popover listing the real breakdown rows (label, points/max, note). When the
 * score is null it renders an honest "Not enough data yet" state and never a
 * fabricated number. Real data only, sourced from the /score read.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Coin } from '@/lib/coins/types';
import type { NakaScoreResult, NakaGrade } from '@/lib/coins/nakaScore';

type Props =
  | { chain: string; address: string; coin?: Coin }
  | { coin: Coin; chain?: string; address?: string };

const SIZE = 80;
const STROKE = 7;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Brand band colours: emerald good, amber mid, rose bad, slate for no-data. */
function bandColor(grade: NakaGrade | null): string {
  if (grade === 'strong') return '#10B981';
  if (grade === 'fair') return '#F0B90B';
  if (grade === 'weak') return '#F43F5E';
  return '#64748B';
}

function gradeLabel(grade: NakaGrade | null): string {
  if (grade === 'strong') return 'Strong';
  if (grade === 'fair') return 'Fair';
  if (grade === 'weak') return 'Weak';
  return 'No data';
}

export default function NakaScoreRing(props: Props) {
  const chain = props.chain ?? props.coin?.chain;
  const address = props.address ?? props.coin?.tokenAddress;

  const [data, setData] = useState<NakaScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chain || !address) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/coins/${chain}/${encodeURIComponent(address)}/score`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: NakaScoreResult | null) => {
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
  }, [chain, address]);

  // Dismiss the popover on an outside tap.
  useEffect(() => {
    if (!open) return;
    function onDown(e: PointerEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const score = data?.score ?? null;
  const grade = data?.grade ?? null;
  const color = bandColor(grade);
  const hasScore = typeof score === 'number';
  const dash = hasScore ? CIRC * (1 - Math.max(0, Math.min(100, score)) / 100) : CIRC;

  return (
    <div ref={boxRef} className="relative inline-block">
      <motion.button
        type="button"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-center gap-1 rounded-2xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-[#00C8FF]/60"
        aria-label="Naka Score details"
      >
        <div className="relative" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              className="text-white/10"
            />
            {hasScore && (
              <motion.circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                initial={{ strokeDashoffset: CIRC }}
                animate={{ strokeDashoffset: dash }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {loading ? (
              <span className="h-5 w-8 animate-pulse rounded bg-white/10" />
            ) : (
              <span className="text-xl font-bold leading-none tabular-nums" style={{ color: hasScore ? color : '#94A3B8' }}>
                {hasScore ? score : '—'}
              </span>
            )}
            <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-white/45">Naka Score</span>
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="nl-glass absolute left-1/2 z-30 mt-2 w-[260px] max-w-[86vw] -translate-x-1/2 rounded-2xl p-3.5 shadow-[0_20px_50px_-20px_rgba(0,102,255,.6)]"
          >
            <div className="mb-2.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-white/90">Naka Score</span>
              {hasScore && (
                <span className="text-xs font-medium" style={{ color }}>
                  {score} / 100 {gradeLabel(grade)}
                </span>
              )}
            </div>

            {!hasScore || !data?.breakdown?.length ? (
              <p className="text-xs leading-relaxed text-white/55">
                Not enough data yet. We only score signals we can measure for real, and this coin has too few to rate.
              </p>
            ) : (
              <ul className="space-y-2">
                {data.breakdown.map((row) => (
                  <li key={row.key} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white/85">{row.label}</div>
                      <div className="truncate text-[11px] text-white/45">{row.note}</div>
                    </div>
                    <div className="shrink-0 text-[11px] font-semibold tabular-nums text-white/70">
                      {row.points}/{row.max}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
