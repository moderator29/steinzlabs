'use client';

/**
 * §5.6 Context Feed Dune cards. Renders bridge_flow, smart_money_rotation,
 * mev_sandwich, etc. cards alongside the existing feed. Quiet (returns
 * null) when none are available yet.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Repeat, ArrowRightLeft, AlertOctagon, Sparkles } from 'lucide-react';

interface Card {
  type: string;
  title: string;
  body: string;
  metric?: number;
  href?: string;
  fetched_at: string;
}

const ICON_BY_TYPE: Record<string, React.ReactNode> = {
  bridge_flow:           <ArrowRightLeft className="w-4 h-4 text-[#4d80ff]" />,
  smart_money_rotation:  <Sparkles className="w-4 h-4 text-amber-300" />,
  mev_sandwich:          <AlertOctagon className="w-4 h-4 text-red-400" />,
  stablecoin_pulse:      <Repeat className="w-4 h-4 text-emerald-300" />,
};

export default function DuneFeedCards({ limit = 12 }: { limit?: number }) {
  const [cards, setCards] = useState<Card[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/context-feed/dune-cards?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : { cards: [] }))
      .then((j: { cards: Card[] }) => { if (!cancelled) setCards(j.cards ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [limit]);

  if (cards.length === 0) return null;

  return (
    <div className="space-y-2">
      {cards.map((c, i) => {
        const body = (
          <div className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3 hover:bg-black/40 transition-colors">
            <div className="mt-0.5">{ICON_BY_TYPE[c.type] ?? <Sparkles className="w-4 h-4 text-slate-400" />}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{c.title}</div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{c.body}</div>
            </div>
          </div>
        );
        return c.href
          ? <Link key={i} href={c.href}>{body}</Link>
          : <div key={i}>{body}</div>;
      })}
    </div>
  );
}
