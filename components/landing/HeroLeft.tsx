'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useEffect, useState } from 'react';
import SteinzLogo from '@/components/ui/SteinzLogo';

function easeOutExpo(t: number) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

function useCountUp(target: number, duration = 1800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setVal(Math.floor(target * easeOutExpo(t)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function StatBar() {
  const chains = useCountUp(12);
  const txns   = useCountUp(1000000);
  const tokens = useCountUp(50000);

  const stats = [
    { num: `${chains}+`,                         label: 'Chains Supported'       },
    { num: `${Math.floor(txns / 1e6)}M+`,         label: 'Transactions Analyzed'  },
    { num: `${Math.floor(tokens / 1000)}K+`,       label: 'Tokens Scanned'         },
  ];

  return (
    <div className="flex items-center mt-8">
      {stats.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex flex-col items-center px-5 first:pl-0">
            <span className="text-2xl font-black text-white leading-none tabular-nums">{s.num}</span>
            <span className="text-[11px] mt-0.5" style={{ color: '#2a3a60' }}>{s.label}</span>
          </div>
          {i < stats.length - 1 && <div className="w-px h-8 bg-white/10" />}
        </div>
      ))}
    </div>
  );
}

export function HeroLeft() {
  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Animated logo — sized up for brand impact on hero */}
      <SteinzLogo size={160} animated={true} />

      {/* Wordmark */}
      <p className="mt-3 text-[11px] font-bold uppercase"
        style={{ letterSpacing: 8, color: '#1a2855' }}>
        NAKA LABS
      </p>

      {/* Headline */}
      <h1 className="mt-6 font-black text-[52px] leading-[1.08] tracking-tight text-white max-md:text-[34px]">
        On-Chain Intelligence
        <br />
        <span style={{ color: '#eef2ff' }}>For Every Trade.</span>
      </h1>

      {/* Sub */}
      <p className="mt-5 max-w-[500px] text-[17px] leading-relaxed"
        style={{ color: '#2e3f70' }}>
        Protect every transaction. Track every whale. Trade with institutional intelligence.
      </p>

      {/* CTA buttons */}
      <div className="flex items-center gap-3.5 mt-8 flex-wrap justify-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{
            padding: '14px 32px',
            borderRadius: 12,
            background: 'linear-gradient(135deg,#1a3acc,#0d1f88)',
            border: '1px solid rgba(77,128,255,.35)',
            boxShadow: '0 0 22px rgba(26,58,204,.3)',
            letterSpacing: '0.5px',
          }}
        >
          Launch App <ArrowRight className="w-[15px] h-[15px]" />
        </Link>

        <Link
          href="/docs"
          className="inline-flex items-center gap-2 font-bold text-sm text-white/80 transition-all hover:text-white hover:border-[rgba(77,128,255,.45)] hover:bg-[rgba(26,58,204,.07)]"
          style={{
            padding: '14px 32px',
            borderRadius: 12,
            background: 'transparent',
            border: '1px solid rgba(26,58,204,.28)',
          }}
        >
          <BookOpen className="w-[15px] h-[15px]" /> Read Docs
        </Link>
      </div>

      {/* Stats bar */}
      <StatBar />
    </motion.div>
  );
}
