'use client';

/**
 * Chain selector for the Coins area. Default is All (every supported chain
 * pulled at once); the user can narrow to one chain. Brand chips, real chain
 * logos, auto-applies on tap.
 */

import { CHAIN_META } from '@/lib/chains/chainMeta';
import { COIN_CHAINS } from '@/lib/coins/types';
import { ChainBadge } from './atoms';

export type ChainFilterValue = 'all' | 'solana' | 'ethereum' | 'bsc';

export function ChainFilter({ value, onChange, counts }: { value: ChainFilterValue; onChange: (v: ChainFilterValue) => void; counts?: Partial<Record<ChainFilterValue, number>> }) {
  const opts: { id: ChainFilterValue; label: string }[] = [
    { id: 'all', label: 'All' },
    ...COIN_CHAINS.map((c) => ({ id: c as ChainFilterValue, label: CHAIN_META[c]?.short ?? c })),
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`group relative inline-flex items-center gap-1.5 shrink-0 overflow-hidden rounded-xl pl-3.5 pr-3.5 py-2 text-[13px] font-semibold transition-all duration-200 nl-glass ${
              active
                ? 'text-white shadow-[0_8px_24px_-10px_rgba(0,102,255,.7)] -translate-y-[1px]'
                : 'text-white/55 hover:text-white hover:-translate-y-[1px]'
            }`}
          >
            {/* blue accent stride — brighter when active */}
            <span className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-gradient-to-b from-[#1E90FF] to-[#0066FF] transition-opacity ${active ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'}`} />
            {o.id !== 'all' ? <ChainBadge chain={o.id} size={16} className="ml-0.5" /> : <span className="ml-0.5" />}
            {o.label}
            {counts && (counts[o.id] ?? 0) > 0 ? (
              <span className={`ml-0.5 text-[11px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${active ? 'bg-[#0066FF]/25 text-white' : 'bg-white/[0.06] text-white/50'}`}>{counts[o.id]}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
