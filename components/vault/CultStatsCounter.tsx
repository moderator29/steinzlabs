'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * §vault-server-client-function-prop · was `format?: (n: number) => string`.
 * /vault page is an async Server Component, and passing a function reference
 * across the server↔client boundary triggers the App Router error
 * "Functions cannot be passed directly to Client Components unless you
 * explicitly expose it by marking it with 'use server'." (Sentry caught
 * it as the actual cause of the /vault retry loop owners reported.) Switched
 * to a serialisable string enum and embedded the formatters in the client
 * module so the count-up animation can still format each frame.
 */
type FormatKind = 'plain' | 'compact';

interface Stat {
  label: string;
  value: number | null;
  formatKind?: FormatKind;
}

interface Props {
  stats: Stat[];
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/**
 * "THE CULT IS ALIVE" stats row. Counts numeric values up from zero
 * when the strip enters the viewport. Null values render an em-dash so
 * we never invent numbers (no-mock-data invariant).
 *
 *   <CultStatsCounter stats={[
 *     { label: 'Active Cultists', value: 247 },
 *     { label: '$NAKA Held',      value: 184_000_000, formatKind: 'compact' },
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
    ? '·'
    : stat.formatKind === 'compact'
    ? formatCompact(shown)
    : shown.toLocaleString();

  return (
    <div ref={ref} className="vault-stats__cell">
      <div className="vault-stats__value">{display}</div>
      <div className="vault-stats__label">{stat.label}</div>
    </div>
  );
}
