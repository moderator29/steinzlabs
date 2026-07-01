'use client';

/**
 * HowItWorks — the small in-feature help button plus its branded panel.
 *
 * Drop <HowItWorksButton content={...} /> into any feature header. It renders a
 * compact pill that, when clicked, opens a glass panel on the Naka aurora
 * canvas. The panel has four tabs: How it works, How to use it, Why it matters,
 * and What's new. Content is supplied per feature via the HowItWorksContent
 * shape so each surface owns its own copy with zero shared state.
 *
 * The panel is portaled to <body> so it escapes any sticky or overflow context
 * on the host page, traps focus, and closes on Escape, backdrop click, or the
 * close button.
 */

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle, X, BookOpen, MousePointerClick, Sparkles, Rocket } from 'lucide-react';
import { useFocusTrap } from '@/lib/a11y/useFocusTrap';
import type { HowItWorksContent, WhatsNewTag } from '@/lib/howItWorks/types';

type TabKey = 'how' | 'use' | 'why' | 'new';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'how', label: 'How it works', icon: BookOpen },
  { key: 'use', label: 'How to use it', icon: MousePointerClick },
  { key: 'why', label: 'Why it matters', icon: Sparkles },
  { key: 'new', label: "What's new", icon: Rocket },
];

const TAG_STYLES: Record<WhatsNewTag, string> = {
  NEW: 'bg-[#0066FF]/15 text-[#6F8BFF] border-[#0066FF]/30',
  IMPROVED: 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30',
  FIXED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

/**
 * The compact trigger. Sizing is deliberately small so it tucks into a header
 * row without competing with the feature's own controls. Pass `iconOnly` for
 * the tightest surfaces and `className` to position it (e.g. `ms-auto`).
 */
export function HowItWorksButton({
  content,
  className = '',
  // Default to the compact icon so the control is the SAME small size in every
  // feature header and never competes for width with a page's own buttons.
  iconOnly = true,
}: {
  content: HowItWorksContent;
  className?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`How ${content.title} works`}
        title="How it works"
        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#0066FF]/50 bg-[#0066FF]/15 text-[#cfe0ff] shadow-[0_0_7px_rgba(0,102,255,0.25)] transition-colors hover:border-[#0066FF] hover:bg-[#0066FF]/25 hover:text-white ${
          iconOnly ? 'h-5 w-5' : 'px-2.5 py-1'
        } ${className}`}
      >
        <HelpCircle className="h-3 w-3 flex-shrink-0 text-[#4DA2FF]" />
        {!iconOnly && <span className="text-[11px] font-semibold leading-none">How it works</span>}
      </button>
      {open && <HowItWorksPanel content={content} onClose={() => setOpen(false)} />}
    </>
  );
}

function HowItWorksPanel({ content, onClose }: { content: HowItWorksContent; onClose: () => void }) {
  const [tab, setTab] = useState<TabKey>('how');
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  // Lock the page scroll while the panel is open so the backdrop feels solid.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const visibleTabs = useMemo(
    () => TABS.filter((t) => (t.key === 'new' ? content.whatsNew.length > 0 : true)),
    [content.whatsNew.length],
  );

  const panel = (
    <div
      data-overlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="hiw-title"
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-0 sm:items-center sm:p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        ref={trapRef}
        className="nl-aurora-bg relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 shadow-[0_20px_70px_rgba(0,0,0,0.6)] sm:rounded-3xl"
        style={{ maxHeight: 'min(86vh, 720px)' }}
      >
        {/* Header */}
        <div className="relative flex items-start gap-3 border-b border-white/[0.06] px-5 pb-4 pt-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[#0066FF]/30 bg-[#0066FF]/10 text-[#6F8BFF]">
            <HelpCircle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="hiw-title" className="text-base font-bold leading-tight text-white">
              {content.title}
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-snug text-slate-400">{content.tagline}</p>
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

        {/* Tabs */}
        <div className="relative flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2 scrollbar-hide">
          {visibleTabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                  active
                    ? 'bg-[#0066FF]/15 text-white'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="relative flex-1 overflow-y-auto px-5 py-4 scrollbar-hide">
          {tab === 'how' && <Bullets items={content.howItWorks} />}
          {tab === 'use' && <Steps items={content.howToUse} />}
          {tab === 'why' && <Bullets items={content.why} accent />}
          {tab === 'new' && <WhatsNew entries={content.whatsNew} />}
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(panel, document.body);
}

function Bullets({ items, accent = false }: { items: string[]; accent?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((line, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-200">
          <span
            className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
              accent ? 'bg-[#10B981]' : 'bg-[#0066FF]'
            }`}
          />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((line, i) => (
        <li key={i} className="flex gap-3 text-[13px] leading-relaxed text-slate-200">
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#0066FF]/30 bg-[#0066FF]/10 text-[10.5px] font-bold text-[#6F8BFF]">
            {i + 1}
          </span>
          <span className="pt-px">{line}</span>
        </li>
      ))}
    </ol>
  );
}

function WhatsNew({ entries }: { entries: HowItWorksContent['whatsNew'] }) {
  return (
    <div className="space-y-4">
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={`rounded border px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${TAG_STYLES[entry.tag]}`}
            >
              {entry.tag}
            </span>
            {i < entries.length - 1 && <span className="mt-1 w-px flex-1 bg-white/[0.08]" />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
              {entry.date}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-200">{entry.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
