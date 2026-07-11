'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { AskChainHero } from '@/components/landing/AskChainHero';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Honest, defensible stat chips only. 8 supported chains, 400+ tracked
// smart-money wallets, the real 0.5% swap fee, and the 8 automatic security
// layers documented in SecurityShowcase. No fabricated live market numbers.
const CHIPS: Array<{ value: string; label: string }> = [
  { value: '8', label: 'Chains' },
  { value: '400+', label: 'Wallets tracked' },
  { value: '0.5%', label: 'Swap fee' },
  { value: '8', label: 'Security layers' },
];

export function HeroSection() {
  const reduced = useReducedMotion();

  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-28 pb-20 overflow-hidden"
    >
      {/* Soft pulsing blue glow: the "breathing" light behind the headline. */}
      <motion.div
        aria-hidden
        className="absolute top-[36%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] max-w-[130vw] h-[520px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(0,102,255,0.22) 0%, transparent 68%)',
          filter: 'blur(50px)',
        }}
        animate={reduced ? undefined : { opacity: [0.65, 1, 0.65], scale: [1, 1.06, 1] }}
        transition={reduced ? undefined : { duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Faint grid, fades toward the edges. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,102,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,102,255,.05) 1px,transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 80%)',
        }}
      />

      <motion.div
        className="relative z-10 w-full max-w-3xl flex flex-col items-center text-center"
        initial={reduced ? false : { opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <SteinzLogo size={96} animated={!reduced} />

        <p className="mt-4 text-[11px] font-bold uppercase" style={{ letterSpacing: 8, color: '#8FA3FF' }}>
          Naka Labs
        </p>

        <h1 className="mt-6 font-black tracking-tight text-white text-[40px] leading-[1.05] sm:text-[64px] sm:leading-[1.04]">
          On-chain{' '}
          <span style={{ color: '#1E90FF' }}>intelligence</span>
          <br className="hidden sm:block" /> for every trade.
        </h1>

        <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: '#B4C0E0' }}>
          Track whales, snipe launches, and trade across every major chain, with a security scan on every move. Non-custodial by design.
        </p>

        {/* CTAs: filled neon primary + outlined secondary. Equal-width and
            stacked on mobile, inline on desktop, so they always line up. */}
        <div className="mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 font-bold text-sm text-white rounded-full transition-all hover:scale-[1.03] active:scale-[0.98] w-full sm:w-auto"
            style={{
              padding: '15px 34px',
              background: 'linear-gradient(135deg,#0066FF,#1E90FF)',
              boxShadow: '0 0 28px rgba(0,102,255,.45)',
            }}
          >
            Launch App <ArrowRight className="w-[15px] h-[15px]" />
          </Link>

          <Link
            href="/docs"
            className="inline-flex items-center justify-center gap-2 font-bold text-sm rounded-full transition-all hover:text-white w-full sm:w-auto"
            style={{
              padding: '15px 34px',
              color: '#B4C0E0',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(0,150,255,0.4)',
            }}
          >
            <BookOpen className="w-[15px] h-[15px]" /> Read Docs
          </Link>
        </div>

        {/* Live "Ask the chain" prompt: the signature AI surface up front. */}
        <AskChainHero />

        {/* Honest stat chips: a tidy 2x2 grid on mobile, a single spec row on
            desktop with thin dividers. No 3+1 wrap. */}
        <div className="mt-12 w-full max-w-xs sm:max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-y-7">
          {CHIPS.map((c, i) => (
            <div
              key={c.label}
              className={`flex flex-col items-center px-2 ${i > 0 ? 'sm:border-s sm:border-white/10' : ''}`}
            >
              <span className="text-2xl font-black text-white leading-none tabular-nums">{c.value}</span>
              <span className="mt-1.5 text-[11px] uppercase tracking-wider text-center" style={{ color: '#6d85ff' }}>{c.label}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
