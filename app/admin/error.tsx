'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    import('@sentry/nextjs').then(s => s.captureException(error, { tags: { surface: 'admin' } })).catch(() => undefined);
  }, [error]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10">
          <AlertCircle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Admin page errored</h2>
          <p className="text-sm text-slate-400 mt-1">Logged to Sentry. Retry or return to the admin dashboard.</p>
          {error.digest ? <p className="text-[10px] text-slate-500 mt-2 font-mono">ref: {error.digest}</p> : null}
        </div>
        <div className="flex items-center justify-center gap-2">
          <button onClick={reset} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--nl-blue,#0A1EFF)] text-white text-sm font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />Retry
          </button>
          <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-sm font-semibold border border-white/10">
            Admin Home
          </Link>
        </div>
      </div>
    </div>
  );
}
