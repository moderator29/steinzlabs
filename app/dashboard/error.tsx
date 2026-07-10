'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

/**
 * Dashboard segment error boundary. Audit Agent 14 found dashboard +
 * admin segments had ZERO error boundaries — uncaught errors bubbled
 * all the way to the root and the user lost their nav context. This
 * boundary keeps the BottomNav available even when a tab throws.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Best-effort Sentry capture — module dynamically imported so the
    // boundary doesn't crash if Sentry config is broken.
    import('@sentry/nextjs').then(s => s.captureException(error)).catch(() => undefined);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Something went wrong</h2>
          <p className="text-sm text-slate-400 mt-1">
            This tab hit an error. Your data is safe. Try again or return home.
          </p>
          {error.digest ? (
            <p className="text-[10px] text-slate-500 mt-2 font-mono">ref: {error.digest}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--nl-blue,#0066FF)] hover:bg-[var(--nl-blue-strong,#0052CC)] text-white text-sm font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />Retry
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-sm font-semibold border border-white/10"
          >
            <Home className="w-3.5 h-3.5" />Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
