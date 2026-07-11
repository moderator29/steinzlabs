'use client';

import { motion } from 'framer-motion';
import {
  Globe,
  Wallet,
  ShieldCheck,
  Percent,
  ScanLine,
  Radar,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * LiveOverviewCard: a premium "Naka Labs overview" dashboard card for the
 * landing page. Sits directly under the hero. Every value here is a real,
 * defensible platform capability (mirrors the copy used across HeroSection,
 * CTASection, and FAQ). NO fabricated live volume / PNL / user counts. The
 * green "Live" dot signals the product is live, not a fake real-time feed.
 */

interface Tile {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}

// 2x2 grid. Honest, defensible values only.
const TILES: Tile[] = [
  {
    icon: Globe,
    label: 'Networks',
    value: '8 Chains',
    sub: 'Ethereum, Solana, Base + more',
  },
  {
    icon: Wallet,
    label: 'Smart money',
    value: '400+ Wallets',
    sub: 'Whale + smart-money addresses tracked',
  },
  {
    icon: ShieldCheck,
    label: 'Protection',
    value: '8 Security layers',
    sub: 'Honeypot, tax + LP-lock checks on every swap',
  },
  {
    icon: Percent,
    label: 'Trading',
    value: '0.5% Swap fee',
    sub: 'Flat and non-custodial. Your keys, your trades.',
  },
];

// Bottom capability strip. Real features, not fake transactions.
const CAPABILITIES: { icon: React.ElementType; label: string }[] = [
  { icon: ScanLine, label: 'Security scan on every swap' },
  { icon: Radar, label: 'Whale alerts' },
  { icon: TrendingUp, label: 'Smart-money signals' },
  { icon: Sparkles, label: 'Naka Predict' },
];

export function LiveOverviewCard() {
  const reduced = useReducedMotion();

  return (
    <section className="max-w-5xl mx-auto px-5 py-10 sm:py-14">
      <motion.div
        className="nl-glass relative overflow-hidden rounded-[26px] p-5 sm:p-8"
        initial={reduced ? false : { opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Faint dashboard grid inside the panel. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.4]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(0,102,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(0,102,255,.06) 1px,transparent 1px)',
            backgroundSize: '46px 46px',
            maskImage: 'radial-gradient(120% 90% at 0% 0%, #000 30%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(120% 90% at 0% 0%, #000 30%, transparent 72%)',
          }}
        />

        {/* Header: title + Live dot */}
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              Naka Labs overview
            </h2>
            <p className="text-[12px] sm:text-[13px] mt-0.5" style={{ color: '#8FA3FF' }}>
              On-chain intelligence + non-custodial trading, in one platform.
            </p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/80"
            style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.28)' }}
          >
            <span className="relative flex w-2 h-2">
              {!reduced && (
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
              )}
              <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
            </span>
            Live
          </span>
        </div>

        {/* 2x2 stat tiles */}
        <div className="relative grid grid-cols-2 gap-3 sm:gap-4 mt-5 sm:mt-6">
          {TILES.map((t) => (
            <div key={t.value} className="nl-card p-3.5 sm:p-5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,102,255,.12)', border: '1px solid rgba(0,150,255,.35)' }}
                >
                  <t.icon className="w-[18px] h-[18px] sm:w-5 sm:h-5" style={{ color: '#3d9bff' }} strokeWidth={1.7} />
                </div>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">
                  {t.label}
                </span>
              </div>
              <div className="text-xl sm:text-3xl font-black text-white leading-none tracking-tight">
                {t.value}
              </div>
              <p className="text-[11px] sm:text-[12.5px] text-white/50 leading-snug">
                {t.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Capability strip */}
        <div className="relative mt-5 sm:mt-6 pt-4 border-t border-white/[0.07]">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/35 mb-2.5">
            What Naka watches
          </div>
          <div className="flex flex-wrap gap-2">
            {CAPABILITIES.map((c) => (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] sm:text-[12px] font-medium text-white/75"
                style={{ background: 'rgba(0,102,255,.08)', border: '1px solid rgba(0,150,255,.22)' }}
              >
                <c.icon className="w-3.5 h-3.5" style={{ color: '#3d9bff' }} strokeWidth={1.8} />
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
