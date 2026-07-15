'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Honest, defensible stat chips only. 8 supported chains, 1,000+ tracked
// smart-money wallets, the real 0.5% swap fee, and the 8 automatic security
// layers documented in SecurityShowcase. No fabricated live market numbers.
const CHIPS: Array<{ value: string; label: string }> = [
  { value: '8', label: 'Chains' },
  { value: '1,000+', label: 'Wallets tracked' },
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
          Read the chain.
          <br />
          <span style={{ color: '#1E90FF' }}>Own every trade.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: '#B4C0E0' }}>
          Whale flows, fresh launches, and a live security scan on every swap, across 8 chains. Fully non-custodial. Your keys, your calls.
        </p>

        {/* CTAs: side by side even on mobile, shiny dark-neon-blue in our
            button shape (rounded rectangle, not a pill). Primary launches the
            app; secondary opens the docs. */}
        <div className="mt-9 flex flex-row items-stretch gap-3 w-full max-w-md">
          <Link
            href="/dashboard"
            className="group relative flex-1 inline-flex items-center justify-center gap-2 font-bold text-sm text-white rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              padding: '16px 20px',
              background: 'linear-gradient(135deg,#3AA0FF 0%,#0066FF 52%,#0038B8 100%)',
              boxShadow: '0 0 0 1px rgba(130,190,255,.5), 0 10px 34px rgba(0,102,255,.6), inset 0 1px 0 rgba(255,255,255,.4)',
            }}
          >
            <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,.28), transparent)' }} />
            <span className="relative inline-flex items-center gap-2">Launch App <ArrowRight className="w-[15px] h-[15px] group-hover:translate-x-0.5 transition-transform" /></span>
          </Link>

          <Link
            href="/docs"
            className="flex-1 inline-flex items-center justify-center gap-2 font-bold text-sm rounded-2xl transition-all hover:text-white"
            style={{
              padding: '16px 20px',
              color: '#CBD8FF',
              background: 'linear-gradient(160deg, rgba(0,102,255,.16), rgba(8,12,28,.62))',
              boxShadow: '0 0 0 1px rgba(0,150,255,.42), 0 8px 22px rgba(0,0,0,.42), inset 0 1px 0 rgba(255,255,255,.1)',
            }}
          >
            <BookOpen className="w-[15px] h-[15px]" /> Docs
          </Link>
        </div>

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
