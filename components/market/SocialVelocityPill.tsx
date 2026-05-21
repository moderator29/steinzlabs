'use client';

import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';

interface VelocityResponse {
  symbol?: string;
  tweets_6h?: number;
  tweets_24h?: number;
  velocity_pct?: number;
  sentiment_shift?: number;
  unavailable?: boolean;
}

// Anything below this is just noise — we want the pill to call attention
// only when the 6h rate is meaningfully ahead of the 24h baseline.
const SHOW_THRESHOLD_PCT = 50;

export default function SocialVelocityPill({ symbol }: { symbol: string }) {
  const [data, setData] = useState<VelocityResponse | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    fetch(`/api/social/velocity?token=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (!data || data.unavailable || typeof data.velocity_pct !== 'number') return null;
  if (data.velocity_pct < SHOW_THRESHOLD_PCT) return null;

  const shift = data.sentiment_shift ?? 0;
  const shiftLabel =
    shift > 5 ? ' · sentiment ↑' : shift < -5 ? ' · sentiment ↓' : '';

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#EF4444]/15 text-[#EF4444] text-[10px] font-bold leading-none"
      title={`${data.tweets_6h ?? 0} posts in last 6h vs ${data.tweets_24h ?? 0} in 24h${shiftLabel}`}
    >
      <Flame className="w-3 h-3" aria-hidden />
      +{data.velocity_pct}% Twitter (6h){shiftLabel}
    </span>
  );
}
