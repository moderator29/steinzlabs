'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';

export interface MarketFilters {
  sortBy: string;
  minMarketCap: number;
  maxMarketCap: number;
  minVolume: number;
}

interface FiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: MarketFilters;
  onChange: (f: MarketFilters) => void;
}

const SORT_OPTIONS = [
  { label: 'Market Cap', value: 'market_cap' },
  { label: 'Volume', value: 'volume' },
  { label: 'Price Change', value: 'price_change' },
];

const MARKET_CAP_PRESETS = [
  { label: 'Any', min: 0, max: 0 },
  { label: '>$1B', min: 1_000_000_000, max: 0 },
  { label: '$100M–$1B', min: 100_000_000, max: 1_000_000_000 },
  { label: '$10M–$100M', min: 10_000_000, max: 100_000_000 },
  { label: '<$10M', min: 0, max: 10_000_000 },
];

const VOLUME_PRESETS = [
  { label: 'Any', value: 0 },
  { label: '>$100M', value: 100_000_000 },
  { label: '>$10M', value: 10_000_000 },
  { label: '>$1M', value: 1_000_000 },
  { label: '>$100K', value: 100_000 },
];

function formatCapLabel(n: number): string {
  if (n === 0) return 'Any';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(0)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

export function FiltersModal({ isOpen, onClose, filters, onChange }: FiltersModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // A11Y4: focus trap + Escape + restore prior focus on close.
  const trapRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const set = (patch: Partial<MarketFilters>) => onChange({ ...filters, ...patch });

  const handleReset = () =>
    onChange({ sortBy: 'market_cap', minMarketCap: 0, maxMarketCap: 0, minVolume: 0 });

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Market filters"
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:justify-end bg-black/60 backdrop-blur-sm"
    >
      {/* Panel */}
      <div
        ref={trapRef}
        className="
          nl-glass
          w-full sm:w-80 sm:h-full sm:max-h-none max-h-[90vh]
          rounded-t-2xl sm:rounded-none overflow-y-auto
          flex flex-col
          animate-in slide-in-from-bottom sm:slide-in-from-right duration-200
        "
        style={{ boxShadow: '0 0 0 1px rgba(0,102,255,.4), 0 0 16px rgba(0,102,255,.18)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-[#0A0E1A]/95 backdrop-blur z-10">
          <span className="text-white font-semibold text-base">Filters</span>
          <button
            onClick={onClose}
            aria-label="Close filters"
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="flex-1 px-5 py-5 space-y-6">
          {/* Sort By */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sort By</h3>
            <div className="grid grid-cols-2 gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => set({ sortBy: opt.value })}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                    filters.sortBy === opt.value
                      ? 'bg-[#0066FF] border-[#0066FF] text-white'
                      : 'bg-transparent border-[#1E2433] text-gray-400 hover:border-[#0066FF]/50 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          {/* Market Cap Range */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Market Cap</h3>
            <p className="text-xs text-gray-300 mb-3">
              {filters.minMarketCap === 0 && filters.maxMarketCap === 0
                ? 'Any range'
                : `${formatCapLabel(filters.minMarketCap)} – ${filters.maxMarketCap === 0 ? 'Unlimited' : formatCapLabel(filters.maxMarketCap)}`}
            </p>
            <div className="flex flex-col gap-2">
              {MARKET_CAP_PRESETS.map((p) => {
                const active = filters.minMarketCap === p.min && filters.maxMarketCap === p.max;
                return (
                  <button
                    key={p.label}
                    onClick={() => set({ minMarketCap: p.min, maxMarketCap: p.max })}
                    className={`w-full text-start px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                      active
                        ? 'bg-[#0066FF]/20 border-[#0066FF] text-white'
                        : 'bg-transparent border-[#1E2433] text-gray-400 hover:border-[#1E2433] hover:text-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Minimum Volume */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Min Volume (24h)</h3>
            <div className="flex flex-col gap-2">
              {VOLUME_PRESETS.map((p) => {
                const active = filters.minVolume === p.value;
                return (
                  <button
                    key={p.label}
                    onClick={() => set({ minVolume: p.value })}
                    className={`w-full text-start px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                      active
                        ? 'bg-[#0066FF]/20 border-[#0066FF] text-white'
                        : 'bg-transparent border-[#1E2433] text-gray-400 hover:border-[#1E2433] hover:text-gray-300'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer Buttons */}
        <div className="sticky bottom-0 bg-[#0A0E1A]/95 backdrop-blur border-t border-white/10 px-5 py-4 flex gap-3">
          <button
            onClick={handleReset}
            className="nl-button--ghost flex-1 py-2.5 rounded-lg text-sm"
          >
            Reset
          </button>
          <button
            onClick={onClose}
            className="nl-button flex-1 py-2.5 rounded-lg text-sm"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
