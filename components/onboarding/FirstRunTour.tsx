'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';

/**
 * FirstRunTour — three-step product walkthrough on the first dashboard
 * visit. Self-contained (no react-joyride dep) so it stays in the
 * client bundle as ~3KB instead of ~30KB. Each step targets a DOM
 * selector and renders a glass popover anchored to it. Once the
 * user finishes OR dismisses, localStorage flag prevents re-runs.
 *
 * Selector contract: each step targets a `data-tour='<id>'` attribute
 * (more stable than CSS class selectors that change with refactors).
 * If the target isn't in the DOM (e.g. user landed somewhere unusual)
 * the tour gracefully skips that step.
 *
 * Audit §5.4 onboarding P0 first-run tour.
 */

export interface TourStep {
  /** Matches data-tour="<selector>" on the target element. */
  selector: string;
  title: string;
  body: string;
  /** Optional preferred placement; falls back to 'auto'. */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

export interface FirstRunTourProps {
  steps: TourStep[];
  storageKey?: string;
}

const DEFAULT_KEY = 'naka_tour_done';

interface AnchorRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function readRect(selector: string): AnchorRect | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`[data-tour="${selector}"]`);
  if (!el) return null;
  const r = (el as HTMLElement).getBoundingClientRect();
  return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
}

function popoverPosition(rect: AnchorRect, placement: TourStep['placement']) {
  // Decide where to place the popover. 'auto' picks bottom if there's
  // room, else top. Left/right reserved for future fine-tuning.
  const popoverWidth = 280;
  const popoverHeight = 140;
  const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight;
  const wantBottom =
    placement === 'bottom' ||
    (placement !== 'top' && rect.top - window.scrollY + rect.height + popoverHeight < viewportH);
  if (wantBottom) {
    return { top: rect.top + rect.height + 14, left: rect.left + rect.width / 2 - popoverWidth / 2 };
  }
  return { top: rect.top - popoverHeight - 14, left: rect.left + rect.width / 2 - popoverWidth / 2 };
}

export function FirstRunTour({ steps, storageKey = DEFAULT_KEY }: FirstRunTourProps) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(storageKey) === '1') return;
    } catch {
      /* localStorage blocked — still show */
    }
    // Defer a frame so the dashboard has time to mount its targets.
    const t = setTimeout(() => setActive(true), 600);
    return () => clearTimeout(t);
  }, [storageKey]);

  useLayoutEffect(() => {
    if (!active) return;
    const step = steps[stepIndex];
    if (!step) return;
    const r = readRect(step.selector);
    if (r) {
      setRect(r);
    } else {
      // Target missing — skip step.
      setStepIndex((i) => (i + 1 < steps.length ? i + 1 : -1));
    }
  }, [active, stepIndex, steps]);

  useEffect(() => {
    if (!active) return;
    const onResize = () => {
      const step = steps[stepIndex];
      if (step) setRect(readRect(step.selector));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, stepIndex, steps]);

  const finish = () => {
    setActive(false);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      /* swallow */
    }
  };

  if (!active || stepIndex < 0 || stepIndex >= steps.length || !rect) return null;
  const step = steps[stepIndex];
  const pos = popoverPosition(rect, step.placement);

  return (
    <>
      <div className="fixed inset-0 bg-black/55 z-[195] pointer-events-auto" onClick={finish} />
      {/* Highlight ring around the target */}
      <div
        aria-hidden
        className="absolute z-[196] rounded-xl pointer-events-none"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.55), 0 0 22px rgba(0,102,255,0.6)',
          borderRadius: 14,
        }}
      />
      {/* Popover */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="absolute z-[197] w-[280px] rounded-2xl border border-[#0066FF]/40 bg-[#0F1320] shadow-2xl p-4"
        style={{ top: pos.top, left: Math.max(12, pos.left) }}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-sm font-bold text-white">{step.title}</h3>
          <button onClick={finish} aria-label="Skip tour" className="p-1 rounded hover:bg-white/[0.06] text-slate-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{step.body}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-[10px] text-slate-500 tabular-nums">{stepIndex + 1} / {steps.length}</span>
          <button
            onClick={() => {
              if (stepIndex + 1 >= steps.length) finish();
              else setStepIndex((i) => i + 1);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0066FF] to-[#7C3AED] text-xs font-bold text-white"
          >
            {stepIndex + 1 >= steps.length ? 'Done' : 'Next'}
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </>
  );
}

export const DEFAULT_TOUR_STEPS: TourStep[] = [
  {
    selector: 'connect-wallet',
    title: 'Connect your wallet',
    body: 'Naka reads on-chain. Start by linking a wallet so the dashboard knows what to show.',
    placement: 'bottom',
  },
  {
    selector: 'set-first-alert',
    title: 'Set your first alert',
    body: 'Get pinged when a token moves, a whale acts, or a pool drains. Set one to feel the loop.',
    placement: 'auto',
  },
  {
    selector: 'open-whale-tracker',
    title: 'Explore the whale tracker',
    body: 'See what the smartest wallets are buying right now and follow ones that match your style.',
    placement: 'auto',
  },
];
