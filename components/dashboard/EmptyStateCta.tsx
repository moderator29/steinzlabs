'use client';

import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';

interface EmptyStateCtaProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  body: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  onPrimaryClick?: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
}

export function EmptyStateCta({
  icon: Icon,
  title,
  body,
  primaryHref,
  primaryLabel,
  onPrimaryClick,
  secondaryHref,
  secondaryLabel,
}: EmptyStateCtaProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center max-w-md mx-auto">
      {Icon ? <Icon className="w-10 h-10 mx-auto mb-3 text-white/40" /> : null}
      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-slate-400 mb-5 leading-relaxed">{body}</p>
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {primaryLabel && primaryHref ? (
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#0066FF] to-[#7C3AED] px-4 py-2 rounded-xl text-xs font-bold text-white"
          >
            {primaryLabel}
          </Link>
        ) : null}
        {primaryLabel && !primaryHref && onPrimaryClick ? (
          <button
            type="button"
            onClick={onPrimaryClick}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#0066FF] to-[#7C3AED] px-4 py-2 rounded-xl text-xs font-bold text-white"
          >
            {primaryLabel}
          </button>
        ) : null}
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/[0.04]"
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
