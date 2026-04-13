'use client';

type StatusType = 'active' | 'inactive' | 'error' | 'warning' | 'loading';

interface StatusDotProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const STATUS_STYLES: Record<StatusType, { dot: string; text: string; pulse: string }> = {
  active:   { dot: 'bg-green-500',  text: 'text-green-400',  pulse: 'bg-green-500' },
  inactive: { dot: 'bg-gray-500',   text: 'text-gray-400',   pulse: '' },
  error:    { dot: 'bg-red-500',    text: 'text-red-400',    pulse: 'bg-red-500' },
  warning:  { dot: 'bg-yellow-500', text: 'text-yellow-400', pulse: 'bg-yellow-500' },
  loading:  { dot: 'bg-blue-500',   text: 'text-blue-400',   pulse: 'bg-blue-500' },
};

const SIZE_STYLES: Record<NonNullable<StatusDotProps['size']>, string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export function StatusDot({ status, label, size = 'md', pulse = false, className = '' }: StatusDotProps) {
  const styles = STATUS_STYLES[status];
  const dotSize = SIZE_STYLES[size];
  const shouldPulse = pulse && styles.pulse;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative flex flex-shrink-0">
        {shouldPulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${styles.pulse}`}
          />
        )}
        <span className={`relative inline-flex rounded-full ${dotSize} ${styles.dot}`} />
      </span>
      {label && (
        <span className={`text-xs font-medium ${styles.text}`}>{label}</span>
      )}
    </span>
  );
}
