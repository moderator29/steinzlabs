'use client';

// A pulsing LIVE badge. The dot uses a CSS ping ring for the "alive" feel.
export function LivePulse({ label = 'LIVE', className = '' }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-rose-500/12 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300 ${className}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-400" />
      </span>
      {label}
    </span>
  );
}
