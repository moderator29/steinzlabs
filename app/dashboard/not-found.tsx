import Link from 'next/link';
import { Compass, Home } from 'lucide-react';

export default function DashboardNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--nl-blue,#0066FF)]/15">
          <Compass className="w-6 h-6 text-[var(--nl-blue,#0066FF)]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-white">Page not found</h2>
          <p className="text-sm text-slate-400 mt-1">That dashboard route doesn&apos;t exist.</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--nl-blue,#0066FF)] text-white text-sm font-semibold"
          >
            <Home className="w-3.5 h-3.5" />Dashboard
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-sm font-semibold border border-white/10"
          >
            Discover
          </Link>
        </div>
      </div>
    </div>
  );
}
