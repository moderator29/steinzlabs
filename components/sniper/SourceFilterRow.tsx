'use client';

import { LAUNCHPADS } from '@/lib/sniper/launchpads';
import { LaunchpadIcon } from '@/app/dashboard/sniper/sniperShared';

/**
 * Source / launchpad filter row for the sniper feed. Renders one chip per
 * launchpad that operates on the selected chain (real DexScreener logo via
 * <LaunchpadIcon>, monogram fallback on error) plus a "Select All" toggle.
 * Multi-select drives the `source` query param. Horizontally scrollable on
 * mobile so a long launchpad list never wraps awkwardly.
 */
export function SourceFilterRow({
  chain,
  selected,
  onChange,
}: {
  /** active chain slug or 'all' */
  chain: string;
  /** selected launchpad ids */
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  // Only launchpads for the selected chain (all of them when chain === 'all').
  // 'dex' is the generic catch-all bucket — keep it out of the chip row.
  const pads = LAUNCHPADS.filter(
    (l) => l.id !== 'dex' && (chain === 'all' || l.chains.includes(chain)),
  );
  if (pads.length === 0) return null;

  const ids = pads.map((p) => p.id);
  const allSelected = selected.length > 0 && ids.every((id) => selected.includes(id));

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const toggleAll = () => onChange(allSelected ? [] : ids);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold shrink-0 hidden sm:inline">
        Source
      </span>
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
        <button
          onClick={toggleAll}
          className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
            allSelected
              ? 'bg-[#0066FF]/20 border-[#0066FF]/50 text-blue-200'
              : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
          }`}
        >
          {allSelected ? 'Clear All' : 'Select All'}
        </button>
        {pads.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => toggle(p.id)}
              title={p.label}
              className={`shrink-0 nl-glass inline-flex items-center gap-1.5 ps-1.5 pe-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition ${
                active ? 'text-blue-100' : 'text-white/70 hover:text-white'
              }`}
              style={active ? { boxShadow: '0 0 0 1px rgba(0,102,255,.55), 0 0 12px rgba(0,102,255,.25)' } : undefined}
            >
              <LaunchpadIcon id={p.id} size={16} />
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
