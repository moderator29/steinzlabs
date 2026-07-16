'use client';

/**
 * CoinMomentsStrip - a horizontal "Moments" strip of real auto-detected
 * highlight events (market-cap milestones, circle buying bursts). Fetches
 * /api/coins/moments and renders each as an nl-glass card with a kind icon, the
 * headline, the coin's real logo and a time-ago, linking to the coin page. Real
 * data only: renders nothing when there are no moments. Export-only and
 * self-contained so an integrator can drop it onto the coins home or the Wire.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, Users2 } from 'lucide-react';
import { CoinLogo } from '@/components/coins/atoms';
import { shortAgo } from '@/lib/coins/format';

interface Moment {
  id: string;
  kind: string;
  chain: string;
  token_address: string;
  symbol: string | null;
  logo_url: string | null;
  headline: string;
  detail: string | null;
  created_at: string;
}

function kindIcon(kind: string) {
  if (kind === 'circle_buying') return <Users2 className="w-4 h-4 text-[#10B981]" />;
  if (kind === 'volume_spike') return <TrendingUp className="w-4 h-4 text-[#7FB2FF]" />;
  return <Sparkles className="w-4 h-4 text-[#7FB2FF]" />;
}

export function CoinMomentsStrip() {
  const [moments, setMoments] = useState<Moment[] | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/coins/moments', { cache: 'no-store' });
        const j = await r.json();
        setMoments(Array.isArray(j.moments) ? j.moments : []);
      } catch {
        setMoments([]);
      }
    })();
  }, []);

  if (moments !== null && moments.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <Sparkles className="w-4 h-4 text-[#7FB2FF]" />
        <h2 className="text-[15px] font-bold text-white">Moments</h2>
      </div>
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {moments === null
          ? [0, 1, 2].map((i) => (
              <div key={i} className="w-[240px] h-[96px] shrink-0 rounded-2xl bg-white/[0.03] animate-pulse" />
            ))
          : moments.map((m, i) => {
              const sym = (m.symbol || '').trim();
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Link
                    href={`/dashboard/coins/${m.chain}/${encodeURIComponent(m.token_address)}`}
                    className="group relative block w-[240px] shrink-0 rounded-2xl p-3 nl-glass overflow-hidden transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_12px_32px_-12px_rgba(0,102,255,.6)]"
                  >
                    <span className="absolute -top-8 -right-8 w-20 h-20 rounded-full bg-[#00C8FF]/10 blur-2xl group-hover:bg-[#00C8FF]/25 transition-colors" />
                    <div className="relative flex items-center gap-2 mb-2">
                      {kindIcon(m.kind)}
                      <span className="text-[11px] font-semibold text-white/50 tabular-nums ml-auto">
                        {shortAgo(new Date(m.created_at).getTime())}
                      </span>
                    </div>
                    <div className="relative flex items-center gap-2.5">
                      <CoinLogo logoUrl={m.logo_url} symbol={sym || '?'} chain={m.chain} size={34} />
                      <span className="text-[13px] font-semibold text-white leading-snug line-clamp-2">
                        {m.headline}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
      </div>
    </div>
  );
}
