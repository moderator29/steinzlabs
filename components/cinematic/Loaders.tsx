'use client';
import clsx from 'clsx';

export function PulseLoader({ className }: { className?: string }) {
  return (
    <div className={clsx('pulse-loader', className)} role="status" aria-label="Loading">
      <span className="pulse-loader__ring" />
      <span className="pulse-loader__ring pulse-loader__ring--d1" />
      <span className="pulse-loader__ring pulse-loader__ring--d2" />
    </div>
  );
}

export function EnergyLoader({ className }: { className?: string }) {
  return (
    <div className={clsx('energy-loader', className)} role="status" aria-label="Loading">
      <span className="energy-loader__line" />
    </div>
  );
}

/** Empty-state with a floating icon and optional CTA. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <div className="cinematic-float mb-5 text-5xl opacity-40">{icon}</div>
      <h3 className="cinematic-heading text-xl mb-2">{title}</h3>
      {description && <p className="naka-text-secondary max-w-md">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
