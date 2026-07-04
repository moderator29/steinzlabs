'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, PanInfo } from 'framer-motion';
import { ArrowRight, X, Rocket, Wallet, Sparkles, Activity, Crosshair, Users, Shield, Palette, PartyPopper, LayoutDashboard } from 'lucide-react';
import { ONBOARDING_CARDS, TOTAL_CARDS, OnboardingCard } from '@/lib/onboarding/cards';

/**
 * 10-card onboarding. Drives the OnboardingCard list defined in
 * lib/onboarding/cards. Renders one card at a time; swipe-left or
 * Next advances, swipe-right or Back retreats. Last card's Next is
 * relabeled "Get Started" and fires the completion event.
 *
 * Variant assignment is fetched once on mount from
 * /api/onboarding/variant; each interaction event (viewed,
 * clicked_next, clicked_skip, skip_confirmed, completed) posts to
 * /api/onboarding/event for the funnel.
 *
 * Respects prefers-reduced-motion (no slide animation; instant cuts).
 */

interface Props {
  onComplete: () => void;
  onSkip?: () => void;
}

const ILLUSTRATIONS: Record<OnboardingCard['illustration'], React.ComponentType<{ className?: string }>> = {
  logo:       Rocket,
  dashboard:  LayoutDashboard,
  wallet:     Wallet,
  vtx:        Sparkles,
  whale:      Activity,
  sniper:     Crosshair,
  social:     Users,
  shield:     Shield,
  palette:    Palette,
  celebrate:  PartyPopper,
};

export function OnboardingFlow({ onComplete, onSkip }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [variant, setVariant] = useState<'a' | 'b'>('a');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const reduceMotion = usePrefersReducedMotion();
  const sentEventsRef = useRef<Set<string>>(new Set());

  // Fetch A/B variant once
  useEffect(() => {
    let cancelled = false;
    fetch('/api/onboarding/variant').then(async (r) => {
      if (!r.ok || cancelled) return;
      const j = await r.json();
      if (j.variant === 'a' || j.variant === 'b') setVariant(j.variant);
    }).catch(() => { /* default to 'a' */ });
    return () => { cancelled = true; };
  }, []);

  const fireEvent = useCallback(
    (event: 'viewed' | 'clicked_next' | 'clicked_skip' | 'skip_confirmed' | 'completed', card_index?: number) => {
      // Dedupe 'viewed' per card to avoid event spam from re-renders
      const key = `${event}:${card_index ?? ''}`;
      if (event === 'viewed' && sentEventsRef.current.has(key)) return;
      sentEventsRef.current.add(key);
      void fetch('/api/onboarding/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, card_index, variant }),
      }).catch(() => { /* analytics best-effort */ });
    },
    [variant],
  );

  useEffect(() => { fireEvent('viewed', index + 1); }, [index, fireEvent]);

  const advance = useCallback(() => {
    if (index === TOTAL_CARDS - 1) {
      fireEvent('completed', index + 1);
      onComplete();
      return;
    }
    fireEvent('clicked_next', index + 1);
    setDirection(1);
    setIndex((i) => Math.min(i + 1, TOTAL_CARDS - 1));
  }, [index, fireEvent, onComplete]);

  const retreat = useCallback(() => {
    setDirection(-1);
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const requestSkip = useCallback(() => {
    fireEvent('clicked_skip', index + 1);
    setConfirmingSkip(true);
  }, [fireEvent, index]);

  const confirmSkip = useCallback(() => {
    fireEvent('skip_confirmed', index + 1);
    // Mark complete so we don't re-show the flow next session
    void fetch('/api/onboarding/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'completed', card_index: index + 1, variant, metadata: { skipped: true } }),
    });
    onSkip?.();
    onComplete();
  }, [fireEvent, index, variant, onComplete, onSkip]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') advance();
      else if (e.key === 'ArrowLeft') retreat();
      else if (e.key === 'Escape') requestSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance, retreat, requestSkip]);

  const card = ONBOARDING_CARDS[index];
  const title = card.title[variant] ?? card.title.a;
  const body = card.body[variant] ?? card.body.a;
  const Illustration = ILLUSTRATIONS[card.illustration];
  const isLast = index === TOTAL_CARDS - 1;

  const onDragEnd = useCallback((_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -60) advance();
    else if (info.offset.x > 60) retreat();
  }, [advance, retreat]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-gradient-to-br from-[#070B1A] via-[#0A0F2C] to-[#070B1A]">
      {/* Aurora-style backdrop */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[var(--nl-blue,#0066FF)]/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#7C3AED]/15 blur-3xl animate-pulse" />
      </div>

      {/* Progress dots */}
      <div className="relative z-10 flex items-center justify-center gap-1.5 pt-6 px-4">
        {ONBOARDING_CARDS.map((c) => (
          <button
            key={c.index}
            onClick={() => { setDirection(c.index - 1 > index ? 1 : -1); setIndex(c.index - 1); }}
            aria-label={`Go to card ${c.index}`}
            className={`h-1.5 rounded-[2px] transition-all ${
              c.index === index + 1
                ? 'w-6 bg-[var(--nl-blue,#0066FF)] shadow-[0_0_12px_rgba(0,102,255,0.6)]'
                : c.index < index + 1
                ? 'w-1.5 bg-white/40 hover:bg-white/60'
                : 'w-1.5 bg-white/15 hover:bg-white/30'
            }`}
          />
        ))}
      </div>

      {/* Card content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            drag={reduceMotion ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={reduceMotion ? undefined : onDragEnd}
            custom={direction}
            initial={reduceMotion ? false : { opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -60 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md w-full text-center select-none touch-pan-y"
          >
            <div className="mx-auto mb-8 w-28 h-28 rounded-3xl bg-gradient-to-br from-[var(--nl-blue,#0066FF)]/30 to-[#7C3AED]/30 border border-white/10 flex items-center justify-center shadow-[0_10px_60px_rgba(0,102,255,0.4)]">
              <Illustration className="w-14 h-14 text-white drop-shadow-[0_0_12px_rgba(0,102,255,0.7)]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-3">{title}</h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line">{body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer controls */}
      <div className="relative z-10 flex items-center justify-between px-6 pb-8 sm:pb-10">
        <button
          onClick={requestSkip}
          className="text-[12px] text-slate-400 hover:text-white px-3 py-2"
          aria-label="Skip onboarding"
        >
          Skip tour
        </button>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              onClick={retreat}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-sm font-medium"
              aria-label="Previous card"
            >
              Back
            </button>
          )}
          <button
            onClick={advance}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--nl-blue,#0066FF)] to-[#7C3AED] hover:brightness-110 text-white text-sm font-bold shadow-[0_0_28px_rgba(0,102,255,0.5)]"
          >
            {isLast ? 'Get Started' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Skip confirmation modal */}
      {confirmingSkip && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="max-w-sm w-full mx-4 rounded-2xl bg-[#0F1627] border border-white/10 p-5">
            <h2 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
              <X className="w-4 h-4 text-amber-400" />
              Skip the tour?
            </h2>
            <p className="text-sm text-slate-300 mb-4">You can replay it anytime from Settings.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmingSkip(false)}
                className="px-4 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-sm"
              >
                Keep watching
              </button>
              <button
                onClick={confirmSkip}
                className="px-4 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-sm font-semibold"
              >
                Skip anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden router reference so the import stays correct even when unused */}
      <span aria-hidden style={{ display: 'none' }}>{router && ''}</span>
    </div>
  );
}

function usePrefersReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduce;
}

/**
 * Convenience wrapper that mounts the flow only when the user has not
 * yet completed it, and persists completion via the API. Mount near
 * the dashboard root.
 */
export function OnboardingGate({ profileOnboardedAt }: { profileOnboardedAt: string | null }) {
  const [show, setShow] = useState<boolean>(profileOnboardedAt === null);
  useEffect(() => { setShow(profileOnboardedAt === null); }, [profileOnboardedAt]);
  const dismiss = useMemo(() => () => setShow(false), []);
  if (!show) return null;
  return <OnboardingFlow onComplete={dismiss} />;
}
