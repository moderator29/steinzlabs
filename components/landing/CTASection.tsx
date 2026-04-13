'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import SteinzLogo from '@/components/ui/SteinzLogo';
import { FloatingCoins } from './FloatingCoins';

export function CTASection() {
  return (
    <section className="relative py-24 px-5 overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#020208 0%,#04040f 50%,#020208 100%)', borderTop: '1px solid #0a0a1a' }}>
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(26,58,204,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(26,58,204,.03) 1px,transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Floating coins */}
      <FloatingCoins section="cta" />

      <motion.div
        className="relative z-10 max-w-2xl mx-auto text-center flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
      >
        <SteinzLogo size={72} animated={true} />

        <h2 className="text-[46px] font-black text-white leading-tight max-md:text-[30px]">
          Start with intelligence.
        </h2>

        <p className="text-[16px] max-w-md" style={{ color: '#1e2e50' }}>
          No fees to join. Connect your wallet and start analyzing in seconds.
        </p>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-bold text-[15px] text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
          style={{
            padding: '16px 48px',
            borderRadius: 14,
            background: 'linear-gradient(135deg,#1a3acc,#0d1f88)',
            border: '1px solid rgba(77,128,255,.3)',
            boxShadow: '0 0 30px rgba(26,58,204,.35)',
          }}
        >
          Launch App <ArrowRight className="w-4 h-4" />
        </Link>

        <p className="text-[10px]" style={{ color: '#0a1430' }}>
          No signup required&nbsp;&nbsp;•&nbsp;&nbsp;Non-custodial&nbsp;&nbsp;•&nbsp;&nbsp;Free to analyze
        </p>
      </motion.div>
    </section>
  );
}
