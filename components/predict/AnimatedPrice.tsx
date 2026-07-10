'use client';

import { useEffect, useRef, useState } from 'react';
import { formatPrice } from './utils';

// Smoothly counts the displayed price toward the latest tick and flashes
// emerald/rose on up/down moves. Respects the visible target value — it never
// invents digits, it just eases between real ticks.
export function AnimatedPrice({
  value,
  className = '',
  prefix = '$',
}: {
  value: number | null | undefined;
  className?: string;
  prefix?: string;
}) {
  const [display, setDisplay] = useState<number | null>(value ?? null);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  const fromRef = useRef<number | null>(value ?? null);
  const rafRef = useRef<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    const from = fromRef.current;
    if (from == null) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    if (from === value) return;

    setDir(value > from ? 'up' : 'down');
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setDir(null), 650);

    const start = performance.now();
    const duration = 600;
    const animate = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = from + (value - from) * eased;
      setDisplay(cur);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        fromRef.current = value;
      }
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  const color = dir === 'up' ? 'text-emerald-400' : dir === 'down' ? 'text-rose-400' : '';
  return (
    <span className={`tabular-nums transition-colors duration-500 ${color} ${className}`}>
      {prefix}
      {display == null ? '—' : formatPrice(display)}
    </span>
  );
}
