'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Wallet, Bell, Fish, X, ArrowRight } from 'lucide-react';

/**
 * First-run dashboard tour. A 3-step modal-style overlay shown once per
 * device (gated on localStorage.naka_tour_done). No external dependency
 * — Joyride is heavyweight for what is functionally a stepped CTA card.
 * Each step links to the relevant surface so the user clicks into the
 * platform instead of reading a passive walkthrough.
 */
const STEPS: Array<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}> = [
  {
    icon: Wallet,
    title: 'Connect a wallet',
    body: 'Naka Labs is non-custodial. Connect MetaMask, Phantom, or any AppKit wallet to start tracking holdings and trading from one place.',
    ctaHref: '/dashboard/settings',
    ctaLabel: 'Open settings',
  },
  {
    icon: Bell,
    title: 'Set your first alert',
    body: 'Price targets, whale moves, new launches, and wallet activity — all delivered to email or Telegram with quiet-hours support.',
    ctaHref: '/dashboard/alerts',
    ctaLabel: 'Create alert',
  },
  {
    icon: Fish,
    title: 'Follow a whale',
    body: 'The whale tracker has 15k+ verified wallets across 8 chains. Follow the ones that matter and copy their moves when you want to.',
    ctaHref: '/dashboard/whales',
    ctaLabel: 'Browse whales',
  },
];

const DONE_KEY = 'naka_tour_done';

export function FirstRunTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY) !== '1') {
        setOpen(true);
      }
    } catch {
      /* localStorage disabled — skip tour entirely */
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch {
      /* non-fatal */
    }
  };

  if (!open) return null;
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="naka-tour-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#0F1320] border border-white/10 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
            Quick start {step + 1} / {STEPS.length}
          </span>
          <button
            onClick={close}
            className="p-1.5 rounded hover:bg-white/5 text-slate-400"
            aria-label="Close tour"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">
          <div className="w-10 h-10 rounded-xl bg-[#0A1EFF]/15 border border-[#0A1EFF]/30 flex items-center justify-center mb-4">
            <Icon className="w-5 h-5 text-[#8FA3FF]" />
          </div>
          <h2 id="naka-tour-title" className="text-base font-semibold text-white mb-1">
            {current.title}
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-5">{current.body}</p>
          <div className="flex items-center gap-2 mb-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i === step ? 'bg-[#0A1EFF]' : 'bg-white/10'}`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={close}
              className="text-xs text-slate-400 hover:text-white px-3 py-2"
            >
              Skip tour
            </button>
            <div className="flex items-center gap-2">
              <Link
                href={current.ctaHref}
                onClick={close}
                className="text-xs font-semibold px-3 py-2 rounded-lg border border-white/15 text-slate-200 hover:bg-white/[0.04]"
              >
                {current.ctaLabel}
              </Link>
              <button
                onClick={() => (isLast ? close() : setStep((s) => s + 1))}
                className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-white"
              >
                {isLast ? 'Done' : 'Next'}
                {!isLast && <ArrowRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
