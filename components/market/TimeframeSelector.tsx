'use client';

import { TIMEFRAMES } from '@/lib/market/constants';
import { Timeframe } from '@/lib/market/types';

interface TimeframeSelectorProps {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
  className?: string;
}

export function TimeframeSelector({ value, onChange, className = '' }: TimeframeSelectorProps) {
  return (
    <div className={`flex gap-1 ${className}`} role="group" aria-label="Chart timeframe">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          aria-pressed={value === tf}
          aria-label={`Timeframe ${tf}`}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            value === tf
              ? 'bg-[#0066FF] text-white'
              : 'text-gray-300 hover:text-white hover:bg-[#1E2433]'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
