'use client';

/**
 * FeatureCarousel: the landing centerpiece. Consolidates the old
 * FeatureCardsSection + FeatureShowcase into one horizontally swipeable,
 * scroll-snap card carousel. Two-color system only: near-black glass cards
 * with a single neon-blue accent. The focused card lights up with a soft
 * blue glow; prev/next controls and a "Swipe to explore" hint make it feel
 * premium and interactive. Real features only, each linking to its live route.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Waves, Target, Repeat, Crosshair, Radar, ShieldCheck, MessageSquare,
  ArrowRight, ChevronLeft, ChevronRight, MoveHorizontal, type LucideIcon,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface FeatureItem {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
}

const FEATURES: FeatureItem[] = [
  {
    icon: Brain,
    eyebrow: 'VTX AI',
    title: 'An analyst that thinks before you trade',
    body: 'Ask in plain English. VTX pulls live on-chain data, security, and sentiment into one structured answer, and can execute the swap right inside the chat.',
    href: '/dashboard/vtx-ai',
  },
  {
    icon: Waves,
    eyebrow: 'Whale Tracking',
    title: 'Watch the smart money move',
    body: 'A real-time feed of large-wallet activity across every supported chain, with a signal the moment several proven wallets converge on the same token.',
    href: '/dashboard/whale-tracker',
  },
  {
    icon: Target,
    eyebrow: 'Predictions',
    title: 'Call the market, on the record',
    body: 'Make and track predictions with a public, verifiable record. You climb the leaderboard on results, not opinions.',
    href: '/dashboard?subtab=prediction',
  },
  {
    icon: Repeat,
    eyebrow: 'Copy Trading',
    title: 'Mirror the traders who win',
    body: 'Follow verified on-chain performers and copy their entries with limits you set and sign for yourself. Non-custodial, always.',
    href: '/dashboard/copy-trading',
  },
  {
    icon: Crosshair,
    eyebrow: 'Sniper',
    title: 'First to the trade, never to the honeypot',
    body: 'Automated new-launch detection with a mandatory safety gate. Every candidate is scanned before a single dollar can move.',
    href: '/dashboard/sniper',
  },
  {
    icon: Radar,
    eyebrow: 'Context Feed',
    title: 'The whole chain, in one stream',
    body: 'Prices, whale alerts, launches, and social momentum unified into a single live feed, so you catch the move before the timeline does.',
    href: '/dashboard',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Security',
    title: 'A scan you cannot skip',
    body: 'GoPlus audits and honeypot simulation run automatically before every swap, snipe, and signature. You cannot accidentally sign something dangerous.',
    href: '/dashboard/security',
  },
  {
    icon: MessageSquare,
    eyebrow: 'The Wire',
    title: 'Reputation built on real trades',
    body: 'A social layer where every rank is calculated from verifiable on-chain activity, with end-to-end encrypted DMs between people who follow each other.',
    href: '/discover',
  },
];

export function FeatureCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();

  const updateActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const c = el.offsetLeft + el.offsetWidth / 2;
      const d = Math.abs(c - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setActive(best);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { updateActive(); raf = 0; });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    updateActive();
    return () => {
      track.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [updateActive]);

  const goTo = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(FEATURES.length - 1, index));
    const el = track.children[clamped] as HTMLElement | undefined;
    if (!el) return;
    const left = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2;
    track.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
  }, [reduced]);

  return (
    <section id="features" className="relative py-20 sm:py-28 overflow-hidden">
      {/* Header */}
      <motion.div
        className="max-w-2xl mx-auto text-center px-5 mb-12 sm:mb-16"
        initial={reduced ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.35em] mb-4" style={{ color: '#1E90FF' }}>
          The Platform
        </p>
        <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.08]">
          Everything on-chain,{' '}
          <span style={{ color: '#1E90FF' }}>one surface.</span>
        </h2>
        <p className="mt-5 text-base sm:text-lg leading-relaxed" style={{ color: '#B4C0E0' }}>
          Intelligence, security, and execution built around a single live data pipeline. Swipe through the stack.
        </p>
      </motion.div>

      {/* Carousel track */}
      <div
        ref={trackRef}
        className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth px-[9vw] sm:px-[calc(50%-190px)] pb-4"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        role="group"
        aria-label="Platform features"
      >
        {FEATURES.map((f, i) => {
          const isActive = i === active;
          return (
            <article
              key={f.eyebrow}
              className="snap-center shrink-0 w-[82vw] sm:w-[380px] rounded-3xl p-6 sm:p-8 flex flex-col transition-all duration-500"
              style={{
                background:
                  'radial-gradient(120% 90% at 0% 0%, rgba(0,102,255,0.14) 0%, transparent 46%), linear-gradient(160deg, rgba(12,18,44,0.72) 0%, rgba(5,8,22,0.88) 100%)',
                border: isActive ? '1px solid rgba(0,150,255,0.55)' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isActive
                  ? '0 0 0 1px rgba(0,102,255,0.25), 0 24px 60px -20px rgba(0,102,255,0.5), inset 0 1px 0 rgba(255,255,255,0.06)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.04)',
                opacity: isActive ? 1 : 0.62,
                transform: isActive ? 'scale(1)' : 'scale(0.965)',
              }}
            >
              {/* Icon square */}
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{
                  background: 'linear-gradient(145deg, rgba(0,102,255,0.28), rgba(0,102,255,0.08))',
                  border: '1px solid rgba(0,150,255,0.45)',
                }}
                animate={
                  reduced
                    ? { boxShadow: isActive ? '0 8px 24px -6px rgba(0,102,255,0.6)' : '0 0 0 rgba(0,0,0,0)' }
                    : isActive
                      ? { boxShadow: [
                          '0 8px 20px -8px rgba(0,102,255,0.45)',
                          '0 10px 30px -6px rgba(0,150,255,0.75)',
                          '0 8px 20px -8px rgba(0,102,255,0.45)',
                        ] }
                      : { boxShadow: '0 0 0 rgba(0,0,0,0)' }
                }
                transition={
                  reduced
                    ? { duration: 0 }
                    : isActive
                      ? { duration: 2.6, ease: 'easeInOut', repeat: Infinity }
                      : { duration: 0.5 }
                }
              >
                <f.icon className="w-6 h-6" style={{ color: '#3d9bff' }} strokeWidth={1.6} />
              </motion.div>

              <span className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: '#6d85ff' }}>
                {f.eyebrow}
              </span>
              <h3 className="mt-2.5 text-xl sm:text-[22px] font-bold text-white leading-tight">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed flex-1" style={{ color: '#95a3c9' }}>{f.body}</p>

              <Link
                href={f.href}
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold transition-colors w-fit"
                style={{ color: isActive ? '#3d9bff' : '#5a6b93' }}
              >
                Explore <ArrowRight className="w-4 h-4" />
              </Link>
            </article>
          );
        })}
      </div>

      {/* Controls: glass arrows + segmented neon progress indicator */}
      <div className="mt-9 px-5">
        <div className="flex items-center gap-3 sm:gap-4 max-w-[460px] mx-auto">
          <button
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous feature"
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:scale-[1.04] active:scale-95"
            style={{
              background: 'linear-gradient(160deg, rgba(12,18,44,0.8), rgba(5,8,22,0.9))',
              border: '1px solid rgba(0,150,255,0.35)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px -12px rgba(0,102,255,0.6)',
            }}
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>

          {/* Segmented progress track */}
          <div className="flex-1 flex items-center gap-1.5" role="tablist" aria-label="Feature progress">
            {FEATURES.map((f, i) => {
              const isActive = i === active;
              const isPast = i < active;
              return (
                <button
                  key={f.eyebrow}
                  onClick={() => goTo(i)}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Go to ${f.eyebrow}`}
                  className="group relative flex-1 py-2.5 outline-none"
                >
                  <span
                    className="relative block h-[3px] rounded-full overflow-hidden transition-colors duration-300"
                    style={{
                      background: isPast ? 'rgba(0,150,255,0.4)' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId={reduced ? undefined : 'carousel-progress'}
                        className="absolute inset-0 rounded-full"
                        style={{
                          background: 'linear-gradient(90deg, #0066FF, #1E90FF)',
                          boxShadow: '0 0 12px rgba(0,150,255,0.85), 0 0 3px rgba(0,150,255,0.9)',
                        }}
                        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => goTo(active + 1)}
            disabled={active === FEATURES.length - 1}
            aria-label="Next feature"
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-25 disabled:cursor-not-allowed hover:scale-[1.04] active:scale-95"
            style={{
              background: 'linear-gradient(160deg, rgba(12,18,44,0.8), rgba(5,8,22,0.9))',
              border: '1px solid rgba(0,150,255,0.35)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 8px 20px -12px rgba(0,102,255,0.6)',
            }}
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Live active label + index counter */}
        <div className="flex items-center justify-center gap-3 mt-4 max-w-[460px] mx-auto">
          <div className="relative h-4 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={active}
                className="block text-[11px] font-bold uppercase tracking-[0.22em] whitespace-nowrap"
                style={{ color: '#3d9bff' }}
                initial={reduced ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                {FEATURES[active].eyebrow}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="text-[11px] font-bold tabular-nums tracking-wider" style={{ color: '#5a6b93' }}>
            {String(active + 1).padStart(2, '0')}
            <span style={{ color: 'rgba(255,255,255,0.18)' }}> / </span>
            {String(FEATURES.length).padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Swipe hint */}
      <div className="flex sm:hidden items-center justify-center gap-2 mt-5 text-[11px] font-medium" style={{ color: '#6d85ff' }}>
        <MoveHorizontal className={`w-3.5 h-3.5 ${reduced ? '' : 'animate-pulse'}`} />
        Swipe to explore
      </div>
    </section>
  );
}
