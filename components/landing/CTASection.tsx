'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function CTASection() {
  const reduced = useReducedMotion();

  return (
    <section className="relative py-24 sm:py-28 px-5 overflow-hidden">
      {/* Soft pulsing blue glow */}
      <motion.div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[640px] max-w-[130vw] h-[420px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, rgba(0,102,255,0.2) 0%, transparent 68%)', filter: 'blur(55px)' }}
        animate={reduced ? undefined : { opacity: [0.6, 1, 0.6], scale: [1, 1.05, 1] }}
        transition={reduced ? undefined : { duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        className="relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center gap-6"
        initial={reduced ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.6 }}
      >
        <SteinzLogo size={64} animated={!reduced} />

        <h2 className="text-3xl sm:text-[46px] font-black text-white leading-tight tracking-tight">
          Start with{' '}
          <span style={{ color: '#1E90FF' }}>intelligence.</span>
        </h2>

        <p className="text-base max-w-md" style={{ color: '#B4C0E0' }}>
          No fees to join. Connect your wallet and start analyzing in seconds.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-bold text-[15px] text-white rounded-full transition-all hover:scale-[1.03] active:scale-[0.98]"
          style={{
            padding: '16px 46px',
            background: 'linear-gradient(135deg,#0066FF,#1E90FF)',
            boxShadow: '0 0 30px rgba(0,102,255,.45)',
          }}
        >
          Launch App <ArrowRight className="w-4 h-4" />
        </Link>

        <p className="text-[11px]" style={{ color: '#6d85ff' }}>
          No signup required&nbsp;&nbsp;•&nbsp;&nbsp;Non-custodial&nbsp;&nbsp;•&nbsp;&nbsp;Free to analyze
        </p>
      </motion.div>
    </section>
  );
}
