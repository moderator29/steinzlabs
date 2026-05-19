'use client';

import { Search, Home, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

type Props = {
  subject?: string;
  home?: string;
};

export function RouteNotFound({ subject = 'page', home = '/dashboard' }: Props) {
  const router = useRouter();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#141824] border border-[#1E2433] rounded-xl p-6 space-y-4 text-center">
        <div className="w-12 h-12 rounded-full bg-[#0A1EFF]/10 flex items-center justify-center mx-auto">
          <Search className="w-6 h-6 text-[#0A1EFF]" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">We couldn&apos;t find that {subject}</h2>
          <p className="text-xs text-gray-400 mt-1">
            It may have been removed or the link is incorrect.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <button
            onClick={() => router.push(home)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-lg text-sm font-semibold text-white transition-colors"
          >
            <Home className="w-3.5 h-3.5" /> Home
          </button>
        </div>
      </div>
    </div>
  );
}
