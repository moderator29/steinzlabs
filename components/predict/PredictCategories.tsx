'use client';

import { Bitcoin, LineChart, Newspaper, Trophy } from 'lucide-react';

export type PredictCategory = 'crypto' | 'stocks' | 'sports' | 'news';

interface CategoryMeta {
  id: PredictCategory;
  label: string;
  Icon: typeof Bitcoin;
  // Only categories backed by real markets are surfaced. Crypto is the single
  // live category for now; the rest stay defined for future use but are gated
  // out of the UI so the board is CRYPTO ONLY.
  live: boolean;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'crypto', label: 'Crypto', Icon: Bitcoin, live: true },
  { id: 'stocks', label: 'Stocks', Icon: LineChart, live: false },
  { id: 'sports', label: 'Sports', Icon: Trophy, live: false },
  { id: 'news', label: 'News', Icon: Newspaper, live: false },
];

// CRYPTO-ONLY gate: only categories flagged live are ever rendered. Today that
// is just Crypto, so non-crypto markets can never surface at the UI layer.
export const LIVE_CATEGORIES = CATEGORIES.filter((c) => c.live);

// Category filter strip. Rectangle brand-glass chips (rounded-xl, not pills),
// shrink-0 in a contained overflow-x-auto row so nothing wraps or overlaps at
// 390px. Only live categories render, keeping the board crypto only.
export function CategoryTabs({
  category,
  onChange,
}: {
  category: PredictCategory;
  onChange: (c: PredictCategory) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-full gap-1.5">
        {LIVE_CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              aria-pressed={active}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.97] ${
                active
                  ? 'border-[#0066FF]/60 bg-[#0066FF]/[0.16] text-white shadow-[0_0_18px_rgba(0,102,255,0.35)]'
                  : 'border-white/[0.08] bg-white/[0.03] text-gray-400 hover:border-white/20 hover:text-white'
              }`}
            >
              <c.Icon className="h-4 w-4" />
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Honest empty state for the categories that do not have real markets yet. No
// fabricated markets, no fake odds. One clean glass card, one flat icon, one
// truthful line. Retained for future non-crypto categories; not reachable while
// the board is gated to crypto only.
export function CategoryComingSoon({ category }: { category: Exclude<PredictCategory, 'crypto'> }) {
  const meta = CATEGORIES.find((c) => c.id === category)!;
  const Icon = meta.Icon;
  return (
    <div className="nl-glass rounded-3xl px-5 py-14 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0066FF]/10">
        <Icon className="h-6 w-6 text-[#9FD0FF]" />
      </div>
      <h3 className="text-base font-semibold text-white">{meta.label} markets opening soon</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-400">
        We only list markets backed by real data. {meta.label} predictions are on the way. For now,
        Crypto is live.
      </p>
    </div>
  );
}
