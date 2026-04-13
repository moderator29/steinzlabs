'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Shield, Globe, Brain } from 'lucide-react';

const TRUST = [
  { icon: <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />, label: 'Live Data' },
  { icon: <Shield className="w-3.5 h-3.5 text-white/40" />, label: 'Non-Custodial' },
  { icon: <Globe className="w-3.5 h-3.5 text-white/40" />, label: '12+ Chains' },
  { icon: <Brain className="w-3.5 h-3.5 text-white/40" />, label: 'AI Powered' },
];

export function HeroLeft() {
  return (
    <motion.div className="flex flex-col gap-7 text-center md:text-left max-w-xl mx-auto md:mx-0"
      initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      {/* Eyebrow */}
      <div className="flex justify-center md:justify-start">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-[11px] font-semibold tracking-widest"
          style={{ color: '#3B82F6', background: 'rgba(59,130,246,.12)', borderColor: 'rgba(59,130,246,.3)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          CRYPTO INTELLIGENCE PLATFORM
        </div>
      </div>

      {/* Headline */}
      <div>
        <h1 className="text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
          <span className="text-white">The Intelligence Layer</span>
          <br />
          <span style={{
            background: 'linear-gradient(135deg,#3B82F6,#93C5FD)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            For Crypto Traders
          </span>
        </h1>
        <p className="mt-4 text-lg text-white/60 leading-relaxed max-w-lg">
          Real-time whale tracking, AI-powered security, smart money flows,
          and multi-chain trading — all in one platform.
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
        <Link href="/dashboard"
          className="flex items-center justify-center gap-2 px-8 rounded-xl font-semibold text-base text-white transition-all hover:scale-[1.02]"
          style={{ height: 52, background: 'linear-gradient(135deg,#0A1EFF,#3d57ff)', boxShadow: '0 0 30px rgba(10,30,255,.4)' }}>
          Launch App <ArrowRight className="w-4 h-4" />
        </Link>
        <Link href="/docs"
          className="flex items-center justify-center gap-2 px-8 rounded-xl font-semibold text-base transition-all hover:brightness-125"
          style={{ height: 52, color: '#3B82F6', border: '1.5px solid #3B82F6', background: 'transparent' }}>
          View Docs
        </Link>
      </div>

      {/* Trust strip */}
      <div className="flex flex-wrap gap-5 justify-center md:justify-start">
        {TRUST.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs text-white/40">
            {t.icon} {t.label}
            {i < TRUST.length - 1 && <span className="ml-3 text-white/15">·</span>}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
