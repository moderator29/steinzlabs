'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

/**
 * Per-detail-page error boundary. Mounts on dynamic [id] segments so a
 * specific record's render error doesn't unmount the surrounding dashboard
 * shell. Use via a tiny `error.tsx` at each segment that re-exports this.
 */
export function DetailErrorBoundary({
  error,
  reset,
  backHref,
  backLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  backHref: string;
  backLabel: string;
}) {
  useEffect(() => {
    import('@sentry/nextjs').then((s) => s.captureException(error)).catch(() => undefined);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center px-6 py-10">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10">
          <AlertCircle className="w-6 h-6 text-red-400" aria-hidden />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Couldn’t load this page</h2>
          <p className="text-sm text-slate-300 mt-1">Try again, or head back to the list.</p>
          {error.digest ? (
            <p className="text-[10px] text-slate-400 mt-2 font-mono">ref: {error.digest}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--nl-blue,#0066FF)] hover:bg-[var(--nl-blue-strong,#0052CC)] text-white text-sm font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden />Retry
          </button>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-sm font-semibold border border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden />{backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
