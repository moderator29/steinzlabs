'use client';

/**
 * ShippedBanner — a subtle dashboard strip that summarizes what shipped this
 * week and points users to the full What's new log. On-brand glass (.nl-glass),
 * flat lucide icons, blue #0066FF / emerald #10B981 accents, one CTA.
 *
 * The CTA opens the same panel as the sidebar "What's new" button by firing the
 * shared OPEN_WHATS_NEW_EVENT (see components/common/GlobalWhatsNew.tsx), so it
 * works wherever that button is mounted in the app shell.
 *
 * Dismiss persists for the session (sessionStorage), so it stays out of the way
 * once seen and returns on the next visit.
 */

import { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { openGlobalWhatsNew } from '@/components/common/GlobalWhatsNew';

const HIDE_KEY = 'hide_shipped_banner';

/** Short, honest highlights of what landed this week. */
const HIGHLIGHTS = ['The Wire', 'Naka News', 'Stocks tab', 'Prediction board', 'Robinhood Chain'];

export function ShippedBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(typeof window !== 'undefined' && sessionStorage.getItem(HIDE_KEY) === '1');
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(HIDE_KEY, '1');
    } catch {
      /* storage blocked, hide for this render only */
    }
  };

  return (
    <div className="nl-glass flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-[#0066FF]/30 bg-[#0066FF]/10 text-[#6F8BFF]">
        <Sparkles className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">New this week</span>
          <span className="rounded-full border border-[#10B981]/30 bg-[#10B981]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#34D399]">
            Shipped
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-400">{HIGHLIGHTS.join(' · ')} and more.</p>
      </div>

      <button
        type="button"
        onClick={openGlobalWhatsNew}
        className="group inline-flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-[#0066FF]/40 bg-[#0066FF]/12 px-3 py-2 text-xs font-semibold text-[#cfe0ff] transition-colors hover:border-[#0066FF] hover:bg-[#0066FF]/20 hover:text-white"
      >
        See what&apos;s new
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </button>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="-mr-1 flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
