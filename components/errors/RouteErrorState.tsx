'use client';

import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  context?: string;
};

/**
 * Shared error boundary body for dynamic-route segments. Keeps the
 * surface consistent with the root error.tsx — same blue+amber palette,
 * same recovery CTAs — without duplicating layout chrome in each
 * [param]/error.tsx file.
 */
export function RouteErrorState({ error, reset, context = 'page' }: Props) {
  const router = useRouter();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#141824] border border-[#1E2433] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#EF4444]/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Couldn&apos;t load this {context}</h2>
            <p className="text-xs text-gray-400">Something went wrong while fetching the data.</p>
          </div>
        </div>
        {error.digest && (
          <p className="text-[10px] text-gray-500 font-mono break-all bg-[#0A0E1A] rounded px-2 py-1">
            ref: {error.digest}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2 bg-[#0066FF] hover:bg-[#0918D0] rounded-lg text-sm font-semibold text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white transition-colors"
          >
            <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg nl-glass border border-white/10 group-hover:border-[#0066FF]/40 transition-colors">
              <ArrowLeft size={16} className="text-slate-400 group-hover:text-[#0066FF] transition-colors" />
            </span>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
