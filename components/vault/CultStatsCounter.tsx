'use client';
import { useEffect, useRef, useState } from 'react';

interface Stat {
  label: string;
  value: number | null;
  format?: (n: number) => string;
}

interface Props {
  stats: Stat[];
}

/**
 * "THE CULT IS ALIVE" stats row. Counts numeric values up from zero
 * when the strip enters the viewport. Null values render an em-dash so
 * we never invent numbers (no-mock-data invariant).
 *
 *   <CultStatsCounter stats={[
 *     { label: 'Active Cultists', value: 247 },
 *     { label: '$NAKA Held',      value: 184_000_000, format: compact },
 *     { label: 'Decrees Passed',  value: 47 },
 *   ]} />
 */
export function CultStatsCounter({ stats }: Props) {
  return (
    <div className="vault-stats">
      {stats.map((s) => (
        <StatCell key={s.label} stat={s} />
      ))}
    </div>
  );
}

function StatCell({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const [seen, setSeen] = useState(false);

  // Trigger count-up only once when in view.
  useEffect(() => {
    const node = ref.current;
    if (!node || seen || stat.value == null) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setSeen(true);
        const target = stat.value!;
        const duration = 1100;
        const start = performance.now();
        let raf = 0;
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / duration);
          // Ease-out cubic
          const eased = 1 - Math.pow(1 - p, 3);
          setShown(Math.round(target * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      }
    }, { threshold: 0.5 });
    io.observe(node);
    return () => io.disconnect();
  }, [stat.value, seen]);

  const display = stat.value == null
    ? '—'
    : stat.format
    ? stat.format(shown)
    : shown.toLocaleString();

  return (
    <div ref={ref} className="vault-stats__cell">
      <div className="vault-stats__value">{display}</div>
      <div className="vault-stats__label">{stat.label}</div>
    </div>
  );
}
