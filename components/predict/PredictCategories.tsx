'use client';

import { Bitcoin, LineChart, Newspaper, Trophy } from 'lucide-react';

export type PredictCategory = 'crypto' | 'stocks' | 'sports' | 'news';

export const CATEGORIES: { id: PredictCategory; label: string; Icon: typeof Bitcoin }[] = [
  { id: 'crypto', label: 'Crypto', Icon: Bitcoin },
  { id: 'stocks', label: 'Stocks', Icon: LineChart },
  { id: 'sports', label: 'Sports', Icon: Trophy },
  { id: 'news', label: 'News', Icon: Newspaper },
];

// Segmented category selector. Brand glass, horizontally scrollable so all four
// options fit at 390px without wrapping or shifting the interface. Only Crypto
// has live markets today; the others open an honest "coming soon" state.
export function CategoryTabs({
  category,
  onChange,
}: {
  category: PredictCategory;
  onChange: (c: PredictCategory) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-full gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
        {CATEGORIES.map((c) => {
          const active = category === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              aria-pressed={active}
              className={`inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-all ${
                active
                  ? 'bg-[#0066FF] text-white shadow-[0_0_16px_rgba(0,102,255,0.4)]'
                  : 'text-gray-400 hover:text-white'
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
// truthful line.
export function CategoryComingSoon({ category }: { category: Exclude<PredictCategory, 'crypto'> }) {
  const meta = CATEGORIES.find((c) => c.id === category)!;
  const Icon = meta.Icon;
  return (
    <div className="nl-glass rounded-3xl px-5 py-14 text-center">
      <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#0066FF]/10">
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
