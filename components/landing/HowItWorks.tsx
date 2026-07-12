'use client';

import { motion } from 'framer-motion';
import { Wallet, Radar, ShieldCheck } from 'lucide-react';

/**
 * "How it works" — a clean three-step band for the landing page. Purely
 * presentational, on-brand (nl glass + blue aurora), with a staggered
 * whileInView reveal so it animates as the visitor scrolls it into frame. Real
 * product claims only (non-custodial, on-chain signal, protected swaps).
 */

const STEPS = [
  {
    icon: Wallet,
    title: 'Connect your wallet',
    body: 'Bring your own wallet or spin up the built-in one in seconds. Non-custodial by design: your keys never leave your device.',
  },
  {
    icon: Radar,
    title: 'Read the on-chain signal',
    body: 'Whale flows, fresh-money moves, honeypot / tax / liquidity-lock checks and AI research on any token, before you commit a cent.',
  },
  {
    icon: ShieldCheck,
    title: 'Trade with protection',
    body: 'Swap across 8 chains at the best route with MEV shielding and live risk review, so every trade is one you can trust.',
  },
];

const CHAINS = ['Ethereum', 'Solana', 'Base', 'Arbitrum', 'BSC', 'Polygon', 'Optimism', 'Avalanche'];

export function HowItWorks() {
  return (
    <section className="max-w-6xl mx-auto px-5 py-16 sm:py-20">
      <div className="text-center mb-10 sm:mb-12">
        <span className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: '#8FA3FF' }}>
          How it works
        </span>
        <h2 className="mt-3 text-2xl sm:text-4xl font-black text-white tracking-tight">
          From wallet to winning trade,{' '}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(90deg,#6FB4FF 0%,#1E90FF 55%,#0066FF 100%)' }}
          >
            in three steps
          </span>
        </h2>
        <p className="mt-3 text-white/55 text-sm sm:text-base max-w-2xl mx-auto">
          No custody, no guesswork. Naka Labs turns raw on-chain data into a clear read, then lets you act on it safely.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-2xl p-6 overflow-hidden"
              style={{
                background:
                  'radial-gradient(120% 90% at 0% 0%, rgba(0,102,255,0.10) 0%, transparent 46%), linear-gradient(160deg, rgba(12,18,44,0.60) 0%, rgba(5,8,22,0.82) 100%)',
                border: '1px solid rgba(255,255,255,0.07)',
                boxShadow: '0 20px 50px -30px rgba(0,102,255,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <span
                aria-hidden
                className="absolute top-4 right-5 text-5xl font-black leading-none select-none"
                style={{ color: 'rgba(0,102,255,0.14)' }}
              >
                {i + 1}
              </span>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(0,102,255,.12)', border: '1px solid rgba(0,150,255,.35)' }}
              >
                <Icon className="w-5 h-5" style={{ color: '#3d9bff' }} strokeWidth={1.7} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{s.title}</h3>
              <p className="text-[13.5px] text-white/55 leading-relaxed">{s.body}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Supported chains — a quiet, informative footer row. */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.6 }}
        className="mt-9 flex flex-col items-center gap-3"
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
          Live across 8 chains
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CHAINS.map((c) => (
            <span
              key={c}
              className="px-3 py-1.5 rounded-full text-[12px] font-semibold text-white/70 border border-white/[0.08] bg-white/[0.03]"
            >
              {c}
            </span>
          ))}
        </div>
      </motion.div>
    </section>
  );
}

export default HowItWorks;
