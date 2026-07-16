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

export function ChainFilter({ value, onChange }: { value: ChainFilterValue; onChange: (v: ChainFilterValue) => void }) {
  const opts: { id: ChainFilterValue; label: string }[] = [
    { id: 'all', label: 'All' },
    ...COIN_CHAINS.map((c) => ({ id: c as ChainFilterValue, label: CHAIN_META[c]?.short ?? c })),
  ];
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
      {opts.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition-all duration-200 ${
              active
                ? 'bg-[#0066FF]/18 border-[#0066FF]/60 text-white shadow-[0_0_18px_-4px_rgba(0,102,255,.8)]'
                : 'bg-white/[0.03] border-white/10 text-white/55 hover:text-white hover:border-white/20'
            }`}
          >
            {o.id !== 'all' ? <ChainBadge chain={o.id} size={15} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
