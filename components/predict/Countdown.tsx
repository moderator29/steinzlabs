'use client';

import { Clock } from 'lucide-react';
import { remainingFrom } from './utils';

// Renders a live mm:ss countdown from an ISO closesAt. `now` is passed in from a
// shared 1s heartbeat (useNow) so many countdowns tick in lockstep without each
// spinning its own interval.
export function Countdown({
  closesAt,
  now,
  size = 'md',
  showIcon = true,
}: {
  closesAt: string;
  now: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}) {
  const r = remainingFrom(closesAt, now);
  const urgent = !r.closed && r.ms <= 15_000;

  const sizeCls =
    size === 'lg' ? 'text-2xl sm:text-3xl' : size === 'sm' ? 'text-xs' : 'text-sm';
  const color = r.closed
    ? 'text-gray-500'
    : urgent
      ? 'text-rose-300'
      : 'text-white';

  return (
    <span
      className={`inline-flex items-center gap-1 font-bold tabular-nums ${sizeCls} ${color} ${urgent ? 'animate-pulse' : ''}`}
    >
      {showIcon && <Clock className={size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'} />}
      {r.closed ? 'Resolving' : r.label}
    </span>
  );
}
