'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly animates a numeric value when it changes. Used on KPI tiles
 * (portfolio total, market cap, trust score) so the number doesn't
 * just snap to a new state — the visual cue helps the user notice
 * the change without being jarring.
 *
 * Pure framerate-based easing (cubic-out). Honors
 * prefers-reduced-motion at render time so users with vestibular
 * conditions see the value land instantly.
 */

export interface AnimatedCounterProps {
  value: number;
  durationMs?: number;
  /** Decimal places for the rendered value. */
  decimals?: number;
  /** Optional formatter — e.g. usd, percent, compact. */
  format?: (n: number) => string;
  className?: string;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function AnimatedCounter({
  value,
  durationMs = 600,
  decimals = 0,
  format,
  className,
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    fromRef.current = display;
    startRef.current = null;
    const target = value;
    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setDisplay(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs]);

  const out = format ? format(display) : display.toFixed(decimals);
  return <span className={className}>{out}</span>;
}
