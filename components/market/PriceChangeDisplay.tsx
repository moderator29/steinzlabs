'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface PriceChangeDisplayProps {
  value?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showArrow?: boolean;
  className?: string;
}

export function PriceChangeDisplay({ value, size = 'md', showArrow = true, className = '' }: PriceChangeDisplayProps) {
  const pct = value ?? 0;
  const isPositive = pct >= 0;
  const abs = Math.abs(pct).toFixed(2);

  const sizes = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2.5 py-1',
  };

  const iconSizes = { sm: 10, md: 12, lg: 14 };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-medium ${sizes[size]} ${
        isPositive ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500'
      } ${className}`}
    >
      {showArrow && (
        isPositive
          ? <TrendingUp size={iconSizes[size]} />
          : <TrendingDown size={iconSizes[size]} />
      )}
      {isPositive ? '+' : '-'}{abs}%
    </span>
  );
}
