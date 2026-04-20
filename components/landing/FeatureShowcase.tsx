'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Brain, Send, Crosshair, Shield, BookOpen, Repeat, Network, Sparkles,
  ArrowRight,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Tilt card — pure CSS 3D, no deps                                   */
/* ------------------------------------------------------------------ */

function TiltCard({ children, tint, className = '' }: {
  children: React.ReactNode;
  tint: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    function handleMove(e: MouseEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const tiltX = (y - 0.5) * -10;
      const tiltY = (x - 0.5) * 12;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(0)`;
        const glow = el.querySelector<HTMLElement>('[data-glow]');
        if (glow) {
          glow.style.background = `radial-gradient(240px circle at ${x * 100}% ${y * 100}%, ${tint}22, transparent 65%)`;
        }
      });
    }
    function handleLeave() {
      cancelAnimationFrame(raf);
      if (!el) return;
      el.style.transform = 'perspective(900px) rotateX(0) rotateY(0)';
      const glow = el.querySelector<HTMLElement>('[data-glow]');
      if (glow) glow.style.background = 'transparent';
    }
    el.addEventListener('mousemove', handleMove);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('mousemove', handleMove);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [tint]);

  return (
    <div
      ref={ref}
      className={`relative transition-transform duration-200 ease-out will-change-transform ${className}`}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div data-glow className="pointer-events-none absolute inset-0 rounded-3xl" />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Floating 3D icon — layered perspective + pulse                     */
/* ------------------------------------------------------------------ */

function Floating3DIcon({ icon: Icon, color, delay = 0 }: {
  icon: React.ElementType; color: string; delay?: number;
}) {
  return (
    <div
      className="relative w-14 h-14"
      style={{
        perspective: '600px',
        animation: `floaty 4.5s ease-in-out ${delay}s infinite`,
      }}
    >
      {/* Back shadow layer */}
      <div
        className="absolute inset-0 rounded-2xl blur-xl opacity-40"
        style={{ background: color, transform: 'translateZ(-30px) translateY(10px) scale(0.9)' }}
      />
      {/* Glass plate */}
      <div
        className="absolute inset-0 rounded-2xl backdrop-blur-sm border"
        style={{
          background: `linear-gradient(145deg, ${color}25, ${color}08)`,
          borderColor: color + '40',
          transform: 'rotateX(15deg) rotateY(-5deg)',
        }}
      />
      {/* Icon */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ transform: 'translateZ(20px) rotateX(15deg) rotateY(-5deg)' }}
      >
        <Icon className="w-6 h-6" style={{ color, filter: `drop-shadow(0 4px 12px ${color}80)` }} />
      </div>
      {/* Top highlight */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 rounded-t-2xl pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.18), transparent)',
          transform: 'rotateX(15deg) rotateY(-5deg)',
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature data                                                       */
/* ------------------------------------------------------------------ */

interface Feature {
  icon: React.ElementType;
  kicker: string;
  title: string;
  desc: string;
  color: string;
  bullets: string[];
  badge?: 'new' | 'live' | 'soon';
  cta?: { label: string; href: string };
}

const FEATURES: Feature[] = [
  {
    icon: Brain,
    kicker: 'VTX AI Agent',
    title: 'Claude-powered copilot that executes.',
    desc: 'Ask in plain English. Get answers grounded in live on-chain data. Complete swaps inside the chat. Not a demo — production.',
    color: '#4D6BFF',
    bullets: ['30+ slash commands', 'Tool-using Claude', 'Inline TokenCard + SwapCard', 'Personalised wallet context (opt-in)'],
    badge: 'live',
    cta: { label: 'Try VTX', href: '/dashboard/vtx-ai' },
  },
  {
    icon: Send,
    kicker: 'Telegram Bot',
    title: 'The platform, in your DMs.',
    desc: 'Link your account in 10 seconds. Run /price, /whale, /portfolio, /copy, /snipe — all tier-gated, all instant.',
    color: '#06B6D4',
    bullets: ['10 slash commands', 'Tier gating enforced', 'Secure 6-digit link code', 'Outbound alerts — coming soon'],
    badge: 'live',
    cta: { label: 'Open @Nakalabsbot', href: 'https://t.me/Nakalabsbot' },
  },
  {
    icon: Shield,
    kicker: 'Security Stack',
    title: 'GoPlus + Shadow Guardian on every trade.',
    desc: 'Eight protection layers run automatically — before every swap, snipe, and contract interaction. You cannot accidentally skip the scan.',
    color: '#10B981',
    bullets: ['GoPlus token audit', 'Honeypot pre-simulation', 'Signature Insight decoder', 'Domain Shield phishing check'],
    badge: 'live',
  },
  {
    icon: Network,
    kicker: 'Whale Tracker + Copy',
    title: 'Follow the smart money. Mirror the winners.',
    desc: '1,000+ tracked wallets across 10 chains. Alerts on Mini, one-click copy on Pro, auto-copy on Max. Verified on-chain P&L.',
    color: '#F59E0B',
    bullets: ['Real-time whale feed (SSE)', 'Convergence signal alerts', 'Configurable copy parameters', 'Safety filters built-in'],
    badge: 'live',
    cta: { label: 'See whales', href: '/dashboard/whale-tracker' },
  },
  {
    icon: Crosshair,
    kicker: 'Sniper Bot',
    title: 'First to the trade. Never to the honeypot.',
    desc: 'Max-tier. Monitors new token launches in real time. 5-layer safety gate runs before every auto-buy. Server-side kill switch.',
    color: '#EF4444',
    bullets: ['GoPlus + liquidity + tax check', 'Holder concentration filter', 'Cross-chain support', 'Admin kill switch'],
    badge: 'live',
  },
  {
    icon: BookOpen,
    kicker: 'Research Lab',
    title: 'Deep analysis, publicly readable.',
    desc: 'Token dives, sector reports, security incident breakdowns. Published by the Naka research desk. No paywall on reading.',
    color: '#8B5CF6',
    bullets: ['Free to read', 'Pro contributors can submit', 'On-chain data citations', 'Category filtering'],
    badge: 'live',
    cta: { label: 'Read research', href: '/research' },
  },
  {
    icon: Repeat,
    kicker: 'Unified Swap',
    title: 'Best price, every chain, one click.',
    desc: '0x + Jupiter aggregation across Ethereum, Solana, Base, Arbitrum, Polygon, BNB, Avalanche. Review-before-confirm modal with price impact coding.',
    color: '#EC4899',
    bullets: ['Trust Score pre-check', 'Slippage + price impact tiers', 'Gasless on EVM (Pro+)', '7 chains, one UI'],
    badge: 'live',
    cta: { label: 'Open swap', href: '/dashboard/swap' },
  },
  {
    icon: Sparkles,
    kicker: 'DAO Governance',
    title: 'A voice in what we build next.',
    desc: 'Our governance framework is starting. Early contributors, Max subscribers, and pre-raise NFT holders will form the first voting pool.',
    color: '#A78BFA',
    bullets: ['Proposal + voting system', 'Weighted by tier + NFT', 'Treasury allocations', 'Fee structure input'],
    badge: 'soon',
  },
];

/* ------------------------------------------------------------------ */
/*  Section                                                            */
/* ------------------------------------------------------------------ */

export function FeatureShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="relative max-w-7xl mx-auto px-5 py-28 overflow-hidden">
      {/* Animated gradient mesh backdrop */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.35]">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px]"
             style={{ background: 'radial-gradient(circle, #4D6BFF44, transparent)', animation: 'orbfloat 16s ease-in-out infinite' }} />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px]"
             style={{ background: 'radial-gradient(circle, #8B5CF644, transparent)', animation: 'orbfloat 18s ease-in-out infinite reverse' }} />
      </div>

      <div className={`relative transition-all duration-1000 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-3 py-1 text-xs text-white/60 font-semibold mb-5">
            <Sparkles className="w-3 h-3 text-[#4D6BFF]" /> Every feature, in one platform
          </div>
          <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight mb-5 leading-[1.05]">
            The entire stack,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4D6BFF] via-[#8B5CF6] to-[#10B981]">
              priced for retail.
            </span>
          </h2>
          <p className="text-white/50 text-base sm:text-lg max-w-2xl leading-relaxed">
            Intelligence, security, execution and analytics — built around a single real-time data pipeline. No silos. No upsells. No $2,000 institutional tier.
          </p>

          {/* Floating 3D icon row */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-10">
            <Floating3DIcon icon={Brain}     color="#4D6BFF" delay={0} />
            <Floating3DIcon icon={Shield}    color="#10B981" delay={0.4} />
            <Floating3DIcon icon={Send}      color="#06B6D4" delay={0.8} />
            <Floating3DIcon icon={Crosshair} color="#EF4444" delay={1.2} />
            <Floating3DIcon icon={Network}   color="#F59E0B" delay={1.6} />
            <Floating3DIcon icon={Sparkles}  color="#A78BFA" delay={2.0} />
          </div>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <TiltCard
              key={f.kicker}
              tint={f.color}
              className={`opacity-0 ${visible ? 'animate-fadeInUp' : ''}`}
            >
              <div
                className="relative h-full rounded-3xl p-6 overflow-hidden border"
                style={{
                  background: `linear-gradient(165deg, ${f.color}08 0%, rgba(10,14,26,0.8) 55%)`,
                  borderColor: f.color + '22',
                  animationDelay: `${i * 80}ms`,
                }}
              >
                {/* Top ring */}
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border"
                  style={{
                    background: `linear-gradient(145deg, ${f.color}30, ${f.color}10)`,
                    borderColor: f.color + '50',
                    boxShadow: `0 8px 24px -6px ${f.color}40, inset 0 1px 0 rgba(255,255,255,0.1)`,
                  }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>

                {/* Kicker + badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-white/45 font-semibold">
                    {f.kicker}
                  </span>
                  {f.badge === 'live' && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 rounded-full px-1.5 py-0.5">Live</span>
                  )}
                  {f.badge === 'soon' && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-400 border border-amber-500/25 rounded-full px-1.5 py-0.5">Soon</span>
                  )}
                  {f.badge === 'new' && (
                    <span className="text-[9px] font-bold uppercase tracking-wide bg-[#0A1EFF]/20 text-[#6d85ff] border border-[#0A1EFF]/35 rounded-full px-1.5 py-0.5">New</span>
                  )}
                </div>

                {/* Title + desc */}
                <h3 className="text-[17px] font-bold text-white mb-2 leading-tight">{f.title}</h3>
                <p className="text-[13px] text-white/55 leading-[1.65] mb-4">{f.desc}</p>

                {/* Bullets */}
                <ul className="space-y-1.5 mb-5">
                  {f.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-[12px] text-white/60">
                      <span
                        className="w-1 h-1 rounded-full mt-2 flex-shrink-0"
                        style={{ background: f.color }}
                      />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {f.cta && (
                  <Link
                    href={f.cta.href}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold transition-all"
                    style={{ color: f.color }}
                  >
                    {f.cta.label}
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
              </div>
            </TiltCard>
          ))}
        </div>
      </div>

      {/* Animations keyframes — scoped */}
      <style jsx global>{`
        @keyframes floaty {
          0%, 100% { transform: translateY(0) rotateZ(0); }
          50%      { transform: translateY(-8px) rotateZ(2deg); }
        }
        @keyframes orbfloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(40px, -30px) scale(1.08); }
          66%      { transform: translate(-30px, 20px) scale(0.95); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.7s ease-out forwards;
        }
      `}</style>
    </section>
  );
}
