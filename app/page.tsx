'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Shield, Brain, Zap, Eye, TrendingUp, BarChart3, Lock, Globe,
  Activity, Database, Search, ArrowRight, Check, Users, Target,
  Network, Layers, Bell, ChevronRight
} from 'lucide-react';

// ─── 3D Floating Logo ─────────────────────────────────────────────────────────
function FloatingLogo3D() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let t = 0;
    let id: number;
    function tick() {
      t += 0.012;
      if (ref.current) {
        const y = Math.sin(t) * 18;
        const rx = Math.sin(t * 0.7) * 8;
        const rz = Math.cos(t * 0.5) * 4;
        ref.current.style.transform = `translateY(${y}px) rotateX(${rx}deg) rotateZ(${rz}deg)`;
      }
      id = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="flex justify-center mb-10" style={{ perspective: '800px' }}>
      <div
        ref={ref}
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.05s linear',
          filter: 'drop-shadow(0 40px 60px rgba(10,30,255,0.6)) drop-shadow(0 0 80px rgba(10,30,255,0.4))',
        }}
      >
        {/* 3D S logo — layered divs for depth */}
        <div className="relative w-36 h-36 md:w-48 md:h-48">
          {/* Back glow layer */}
          <div
            className="absolute inset-0 rounded-3xl"
            style={{
              background: 'linear-gradient(135deg, #0A1EFF 0%, #3d57ff 50%, #0a10cc 100%)',
              transform: 'translateZ(-20px) scale(1.05)',
              filter: 'blur(12px)',
              opacity: 0.8,
            }}
          />
          {/* Main face */}
          <div
            className="absolute inset-0 rounded-3xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(145deg, #1a35ff 0%, #0A1EFF 40%, #0610cc 100%)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,10,0.4), 0 20px 60px rgba(10,30,255,0.5)',
              border: '1px solid rgba(100,140,255,0.4)',
            }}
          >
            {/* S letter */}
            <div
              className="font-black text-white select-none"
              style={{
                fontSize: 'clamp(56px, 10vw, 88px)',
                letterSpacing: '-4px',
                textShadow: '0 4px 12px rgba(0,0,60,0.5), 0 0 30px rgba(120,160,255,0.6)',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                lineHeight: 1,
              }}
            >
              S
            </div>
          </div>
          {/* Side depth */}
          <div
            className="absolute rounded-r-3xl"
            style={{
              top: '4%', right: '-8px', bottom: '4%', width: '12px',
              background: 'linear-gradient(90deg, #0610a0, #04087a)',
              transform: 'rotateY(-45deg)',
              transformOrigin: 'left center',
            }}
          />
          {/* Bottom depth */}
          <div
            className="absolute rounded-b-3xl"
            style={{
              bottom: '-8px', left: '4%', right: '4%', height: '12px',
              background: 'linear-gradient(180deg, #04087a, #020450)',
              transform: 'rotateX(-45deg)',
              transformOrigin: 'top center',
            }}
          />
          {/* Shine */}
          <div
            className="absolute top-3 left-4 w-16 h-8 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 100%)',
              filter: 'blur(4px)',
            }}
          />
          {/* Floating orb */}
          <div
            className="absolute -bottom-6 -right-4 w-10 h-10 rounded-full"
            style={{
              background: 'linear-gradient(135deg, #0A1EFF, #6d85ff)',
              boxShadow: '0 0 20px rgba(10,30,255,0.8)',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Feature Card (GoPlus style) ─────────────────────────────────────────────
function FeatureCard({
  tag,
  title,
  description,
  icon: Icon,
  iconBg,
  gradient,
  cta,
  href,
}: {
  tag: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  gradient: string;
  cta: string;
  href: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl p-8 md:p-10 flex flex-col gap-6"
      style={{ background: gradient }}
    >
      {/* Tag pill */}
      <div className="inline-flex w-fit">
        <span className="px-4 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold text-white border border-white/30">
          {tag}
        </span>
      </div>

      {/* 3D Icon */}
      <div className="flex justify-center py-4">
        <div
          className="w-32 h-32 md:w-40 md:h-40 rounded-3xl flex items-center justify-center relative"
          style={{
            background: iconBg,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
            transform: 'perspective(400px) rotateX(8deg)',
          }}
        >
          <Icon className="w-16 h-16 md:w-20 md:h-20 text-white" strokeWidth={1.5} />
          {/* Shine */}
          <div
            className="absolute top-2 left-3 w-20 h-8 rounded-full"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 100%)', filter: 'blur(6px)' }}
          />
        </div>
      </div>

      {/* Text */}
      <div>
        <h3 className="text-2xl md:text-3xl font-black text-white mb-3 leading-tight">{title}</h3>
        <p className="text-white/80 text-sm md:text-base leading-relaxed">{description}</p>
      </div>

      {/* CTA */}
      <Link
        href={href}
        className="w-full py-4 rounded-2xl font-bold text-center text-white/90 bg-white/20 hover:bg-white/30 border border-white/30 transition-all flex items-center justify-center gap-2"
      >
        {cta}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-6 py-4">
      <div className="text-3xl md:text-4xl font-black text-white mb-1">{value}</div>
      <div className="text-sm text-white/60 font-medium">{label}</div>
    </div>
  );
}

// ─── Security Feature Row ─────────────────────────────────────────────────────
function SecurityRow({ icon: Icon, title, description, color }: {
  icon: React.ElementType; title: string; description: string; color: string;
}) {
  return (
    <div className="flex items-start gap-5 p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}22`, border: `1px solid ${color}44` }}
      >
        <Icon className="w-6 h-6" style={{ color }} />
      </div>
      <div>
        <div className="font-bold text-white mb-1">{title}</div>
        <div className="text-sm text-white/50 leading-relaxed">{description}</div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const featureCards = [
    {
      tag: 'For Traders',
      title: 'On-Chain Intelligence Engine',
      description: 'Real-time whale tracking, smart money flows, and wallet DNA analysis across 12+ chains. See what institutions see, before they move.',
      icon: Brain,
      iconBg: 'linear-gradient(135deg, #0A1EFF 0%, #3d57ff 100%)',
      gradient: 'linear-gradient(135deg, #0A1EFF 0%, #0c22e0 50%, #050ea8 100%)',
      cta: 'Start Analyzing',
      href: '/signup',
    },
    {
      tag: 'For Security',
      title: 'Shadow Guardian Protection',
      description: 'AI-powered scam detection on every transaction. Token safety scanner, rug detector, domain shield, and signature insight built-in.',
      icon: Shield,
      iconBg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
      gradient: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)',
      cta: 'Scan Any Token',
      href: '/signup',
    },
    {
      tag: 'For DeFi',
      title: 'Multi-Chain Swap Engine',
      description: 'Best-price routing across Jupiter, Raydium, Uniswap, and 1inch. Safety check runs before every swap. 0.1% platform fee.',
      icon: Zap,
      iconBg: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
      gradient: 'linear-gradient(135deg, #4c1d95 0%, #5b21b6 50%, #6d28d9 100%)',
      cta: 'Start Trading',
      href: '/signup',
    },
    {
      tag: 'For Builders',
      title: 'VTX Intelligence Agent',
      description: 'Ask anything in plain English. Get real-time on-chain answers, token analysis, wallet profiles, and market context instantly.',
      icon: Activity,
      iconBg: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)',
      gradient: 'linear-gradient(135deg, #78350f 0%, #92400e 50%, #b45309 100%)',
      cta: 'Ask VTX',
      href: '/signup',
    },
  ];

  const securityFeatures = [
    { icon: Shield, title: 'Token Safety Scanner', description: '0-100 trust score on any contract. Honeypot simulation, tax analysis, liquidity lock status.', color: '#0A1EFF' },
    { icon: Eye, title: 'Rug Pull Detector', description: 'Full deployer history, serial rugger flagging, liquidity removal pattern analysis.', color: '#10B981' },
    { icon: Globe, title: 'Domain Shield', description: 'Every link checked in real time. Domain age, scam database, phishing verdict.', color: '#8B5CF6' },
    { icon: Search, title: 'Signature Insight', description: 'Decode any transaction signature. Understand exactly what you are signing before you sign.', color: '#F59E0B' },
    { icon: Lock, title: 'Approval Manager', description: 'See and revoke all token approvals across EVM chains. Kill dangerous permissions instantly.', color: '#EF4444' },
    { icon: Target, title: 'Contract Analyzer', description: 'AI reads bytecode and explains what a contract does in plain English. Flags hidden traps.', color: '#06B6D4' },
  ];

  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      color: '#6B7280',
      features: ['Shadow Guardian protection', 'Context feed (live signals)', 'VTX Agent (25 msgs/day)', 'Basic swap', '1 wallet', 'Security scanner'],
    },
    {
      name: 'Pro',
      price: '$6',
      period: '/month',
      color: '#0A1EFF',
      popular: true,
      features: ['Everything in Free', 'Smart money panel', 'Deep holder analysis', 'DNA Analyzer', 'Copy trading', '3 wallets', 'Unlimited VTX Agent', '20 alerts'],
    },
    {
      name: 'Premium',
      price: '$15',
      period: '/month',
      color: '#F59E0B',
      features: ['Everything in Pro', 'Network graph analysis', 'Historical data (365d)', 'Pattern matching & AI predictions', '5 wallets', 'API access', 'Priority support'],
    },
  ];

  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: '#07090f' }}>

      {/* ── NAV ── */}
      <nav
        className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'border-b border-white/10' : ''}`}
        style={{ background: scrolled ? 'rgba(7,9,15,0.95)' : 'transparent', backdropFilter: scrolled ? 'blur(20px)' : 'none' }}
      >
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background: 'linear-gradient(135deg, #0A1EFF, #3d57ff)', boxShadow: '0 0 16px rgba(10,30,255,0.4)' }}
            >
              S
            </div>
            <span className="font-black text-sm tracking-tight">STEINZ LABS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-white/50">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link href="/whitepaper" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[13px] text-white/60 hover:text-white transition-colors px-3 py-2">
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #0A1EFF, #3d57ff)', boxShadow: '0 0 20px rgba(10,30,255,0.35)' }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section
        className="relative min-h-screen flex flex-col items-center justify-center px-5 pt-20 pb-16 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, #0A1EFF 0%, #050ea8 25%, #07090f 55%)',
        }}
      >
        {/* Stars */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 2 + 1,
                height: Math.random() * 2 + 1,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                opacity: Math.random() * 0.6 + 0.1,
                animation: `pulse ${2 + Math.random() * 3}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Glow orbs */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(10,30,255,0.3) 0%, transparent 70%)', filter: 'blur(40px)' }}
        />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* 3D Logo */}
          <FloatingLogo3D />

          {/* Headline */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-[1.05] tracking-tight uppercase"
            style={{ textShadow: '0 4px 30px rgba(10,30,255,0.3)' }}
          >
            ON-CHAIN
            <br />
            INTELLIGENCE
            <br />
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>FOR WEB3</span>
          </h1>

          <p className="text-lg md:text-xl text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
            Protect every transaction. Track every whale. Trade with institutional intelligence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(10px)' }}
            >
              Launch App
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              View Dashboard
            </Link>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, #07090f)' }}
        />
      </section>

      {/* ── STATS BAR ── */}
      <section style={{ background: 'linear-gradient(90deg, #0A1EFF08, #0A1EFF12, #0A1EFF08)', borderTop: '1px solid rgba(10,30,255,0.2)', borderBottom: '1px solid rgba(10,30,255,0.2)' }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 divide-x divide-white/5">
          <StatItem value="12+" label="Chains Supported" />
          <StatItem value="1M+" label="Datasets Indexed" />
          <StatItem value="24/7" label="Live Monitoring" />
          <StatItem value="100%" label="Non-Custodial" />
        </div>
      </section>

      {/* ── FEATURE CARDS ── */}
      <section id="features" className="max-w-7xl mx-auto px-5 py-24">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-sm font-semibold"
            style={{ background: 'rgba(10,30,255,0.1)', border: '1px solid rgba(10,30,255,0.3)', color: '#6d85ff' }}
          >
            Platform Features
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Everything you need to win</h2>
          <p className="text-white/50 max-w-xl mx-auto">One platform. Every on-chain intelligence tool you need.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {featureCards.map((card) => (
            <FeatureCard key={card.title} {...card} />
          ))}
        </div>
      </section>

      {/* ── SECURITY CENTER ── */}
      <section id="security" style={{ background: 'linear-gradient(180deg, #07090f 0%, #060810 100%)' }} className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-sm font-semibold"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}
            >
              Security Solutions
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Building an All-Scenario Web3<br />Security Network
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">From on-chain protocols to user actions, every threat detected before it reaches you.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {securityFeatures.map((f) => (
              <SecurityRow key={f.title} {...f} />
            ))}
          </div>

          {/* Full-width highlight card */}
          <div
            className="mt-8 rounded-3xl p-10 md:p-14 flex flex-col md:flex-row items-center gap-8"
            style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)' }}
          >
            <div className="flex-1">
              <span className="px-4 py-1.5 bg-white/20 rounded-full text-sm font-semibold text-white border border-white/30 inline-block mb-5">For Users</span>
              <h3 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
                Proactively Scan Every<br />On-Chain Transaction
              </h3>
              <p className="text-white/70 mb-6 text-base leading-relaxed">Shadow Guardian checks every token, every contract, every link in real time. Safeguard your assets before you sign anything.</p>
              <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white/90 bg-white/15 border border-white/30 hover:bg-white/25 transition-all">
                Start for Free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div
              className="w-48 h-48 rounded-3xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.2), 0 20px 60px rgba(0,0,0,0.3)',
                transform: 'perspective(400px) rotateY(-8deg)',
              }}
            >
              <Shield className="w-24 h-24 text-white" strokeWidth={1} />
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 px-5 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-sm font-semibold"
            style={{ background: 'rgba(10,30,255,0.1)', border: '1px solid rgba(10,30,255,0.3)', color: '#6d85ff' }}
          >
            Pricing
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Simple, Transparent Pricing</h2>
          <p className="text-white/50">Institutional-grade intelligence. Accessible prices.</p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}
          >
            <Lock className="w-4 h-4" /> Payment integration launching soon
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className="relative rounded-3xl p-8 border transition-all"
              style={{
                background: plan.popular ? `linear-gradient(135deg, ${plan.color}15, ${plan.color}08)` : 'rgba(255,255,255,0.03)',
                borderColor: plan.popular ? `${plan.color}50` : 'rgba(255,255,255,0.08)',
                boxShadow: plan.popular ? `0 0 40px ${plan.color}20` : 'none',
              }}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="px-4 py-1.5 rounded-full text-xs font-bold text-white"
                    style={{ background: plan.color }}>MOST POPULAR</span>
                </div>
              )}
              <div className="mb-6">
                <div className="font-bold text-white/60 text-sm mb-2">{plan.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black text-white">{plan.price}</span>
                  <span className="text-white/40 text-sm">{plan.period}</span>
                </div>
              </div>
              <div className="space-y-3 mb-8">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm text-white/70">
                    <Check className="w-4 h-4 flex-shrink-0" style={{ color: plan.color }} />
                    {f}
                  </div>
                ))}
              </div>
              <Link
                href="/signup"
                className="w-full py-3.5 rounded-2xl font-bold text-center text-sm block transition-all hover:scale-105"
                style={plan.popular ? {
                  background: plan.color,
                  color: '#fff',
                  boxShadow: `0 0 20px ${plan.color}50`,
                } : {
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                {plan.name === 'Free' ? 'Get Started Free' : 'Coming Soon'}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-24 px-5">
        <div
          className="max-w-4xl mx-auto rounded-3xl p-12 md:p-16 text-center relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0A1EFF 0%, #0c22e0 50%, #050ea8 100%)' }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.15) 0%, transparent 60%)' }}
          />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Start trading smarter today
            </h2>
            <p className="text-white/70 mb-10 text-lg max-w-xl mx-auto">
              Join thousands of traders using STEINZ LABS for real-time on-chain intelligence.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl font-bold text-base transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)', color: '#fff' }}
            >
              Create Free Account
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} className="py-10 px-5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs"
              style={{ background: 'linear-gradient(135deg, #0A1EFF, #3d57ff)' }}
            >
              S
            </div>
            <span className="font-black text-sm text-white/80">STEINZ LABS</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-white/30">
            <span>Non-Custodial</span>
            <span>On-Chain Intelligence</span>
            <span>Web3 Security</span>
          </div>
          <div className="text-sm text-white/20">&copy; 2025 STEINZ LABS</div>
        </div>
      </footer>
    </div>
  );
}
