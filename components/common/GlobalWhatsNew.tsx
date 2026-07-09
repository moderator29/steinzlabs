'use client';

/**
 * GlobalWhatsNew: the platform-wide changelog button that lives in the side
 * navigation footer. Opens a branded glass panel on the aurora canvas that
 * lists recent platform updates grouped by period, in the same visual language
 * as the per-feature How it works panels.
 */

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Rocket, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';
import type { WhatsNewTag } from '@/lib/howItWorks/types';
import { GLOBAL_WHATS_NEW } from '@/lib/howItWorks/whatsNewGlobal';

const TAG_STYLES: Record<WhatsNewTag, string> = {
  NEW: 'bg-[#0066FF]/15 text-[#6F8BFF] border-[#0066FF]/30',
  IMPROVED: 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30',
  FIXED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export function GlobalWhatsNewButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-2 rounded-xl border border-[#0066FF]/40 bg-[#0066FF]/12 px-3 py-2 text-[12px] font-semibold text-[#cfe0ff] transition-colors hover:border-[#0066FF] hover:bg-[#0066FF]/20 hover:text-white"
      >
        <Rocket className="h-3.5 w-3.5 text-[#6F8BFF]" />
        What&apos;s new
      </button>
      {open && <GlobalWhatsNewPanel onClose={() => setOpen(false)} />}
    </>
  );
}

function GlobalWhatsNewPanel({ onClose }: { onClose: () => void }) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Group entries by period label, preserving order.
  const groups = useMemo(() => {
    const out: { date: string; items: typeof GLOBAL_WHATS_NEW }[] = [];
    for (const entry of GLOBAL_WHATS_NEW) {
      const last = out[out.length - 1];
      if (last && last.date === entry.date) last.items.push(entry);
      else out.push({ date: entry.date, items: [entry] });
    }
    return out;
  }, []);

  const panel = (
    <div
      data-overlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      className="fixed inset-0 z-[calc(var(--z-modal)+2)] flex items-end justify-center p-0 sm:items-center sm:p-4"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        ref={trapRef}
        className="nl-aurora-bg relative flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.6)] sm:rounded-3xl"
        style={{ maxHeight: 'min(86vh, 720px)' }}
      >
        <div className="relative flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#0066FF]/30 bg-[#0066FF]/10 text-[#6F8BFF]">
            <Rocket className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="whatsnew-title" className="text-base font-bold leading-tight text-white">
              What&apos;s new
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">Recent updates across Naka Labs.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex-shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.date}>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{group.date}</div>
                <div className="space-y-3">
                  {group.items.map((entry, i) => (
                    <div key={i} className="flex gap-2.5">
                      <span
                        className={`mt-0.5 h-fit flex-shrink-0 rounded border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${TAG_STYLES[entry.tag]}`}
                      >
                        {entry.tag}
                      </span>
                      <p className="text-[13px] leading-relaxed text-slate-200">{entry.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}
