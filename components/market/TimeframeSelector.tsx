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
    <div className={`flex gap-1 ${className}`}>
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf}
          onClick={() => onChange(tf)}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            value === tf
              ? 'bg-[#0A1EFF] text-white'
              : 'text-gray-400 hover:text-white hover:bg-[#1E2433]'
          }`}
        >
          {tf}
        </button>
      ))}
    </div>
  );
}
