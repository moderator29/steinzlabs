'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function CTASection() {
  const reduced = useReducedMotion();

  return (
    <section className="relative py-20 sm:py-24 px-5 overflow-hidden">
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
          Create your account, connect a wallet, and start reading the chain in seconds.
        </p>

        <Link
          href="/dashboard"
          className="group relative inline-flex items-center gap-2 font-bold text-[15px] text-white rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            padding: '17px 48px',
            background: 'linear-gradient(135deg,#3AA0FF 0%,#0066FF 52%,#0038B8 100%)',
            boxShadow: '0 0 0 1px rgba(130,190,255,.5), 0 12px 36px rgba(0,102,255,.6), inset 0 1px 0 rgba(255,255,255,.4)',
          }}
        >
          <span aria-hidden className="absolute inset-x-0 top-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,.28), transparent)' }} />
          <span className="relative inline-flex items-center gap-2">Launch App <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></span>
        </Link>

        <p className="text-[11px]" style={{ color: '#6d85ff' }}>
          Non-custodial&nbsp;&nbsp;•&nbsp;&nbsp;8 chains&nbsp;&nbsp;•&nbsp;&nbsp;Security scan on every swap
        </p>
      </motion.div>
    </section>
  );
}
