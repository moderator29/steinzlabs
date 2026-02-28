'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown, ArrowRight, Zap, Brain, TrendingUp, Shield, Target, Users, Search, BarChart3, Compass, ExternalLink, Sparkles, Activity, Lock, Eye, Globe, Layers, Cpu } from 'lucide-react';
import Link from 'next/link';
import PriceTicker from '@/components/PriceTicker';
import SteinzLogo from '@/components/SteinzLogo';

function AnimatedCounter({ value, label }: { value: string; label: string }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const numericPart = value.replace(/[^0-9.]/g, '');
          const prefix = value.match(/^[^0-9]*/)?.[0] || '';
          const suffix = value.match(/[^0-9.]*$/)?.[0] || '';
          const target = parseFloat(numericPart);
          const duration = 1800;
          const start = performance.now();

          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = target * eased;

            if (numericPart.includes('.')) {
              setDisplay(`${prefix}${current.toFixed(1)}${suffix}`);
            } else {
              setDisplay(`${prefix}${Math.floor(current)}${suffix}`);
            }

            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-center group">
      <div className="text-xl md:text-2xl font-heading font-bold bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent group-hover:scale-110 transition-transform duration-300">
        {display}
      </div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

const PARTICLES = Array.from({ length: 25 }).map((_, i) => {
  const seed = (i * 7 + 13) % 100;
  const seed2 = (i * 11 + 29) % 100;
  return {
    left: `${(seed * 37 + i * 17) % 100}%`,
    top: `${(seed2 * 43 + i * 23) % 100}%`,
    color: i % 3 === 0 ? '#00E5FF' : i % 3 === 1 ? '#7C3AED' : '#10B981',
    opacity: 0.12 + (seed % 20) / 100,
    delay: `${(i * 0.35) % 8}s`,
    duration: `${6 + (seed2 % 8)}s`,
    size: i % 5 === 0 ? 'w-1.5 h-1.5' : 'w-1 h-1',
  };
});

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className={`absolute rounded-full animate-particle ${p.size}`}
          style={{
            left: p.left,
            top: p.top,
            background: p.color,
            opacity: p.opacity,
            animationDelay: p.delay,
            animationDuration: p.duration,
            boxShadow: `0 0 6px ${p.color}40`,
          }}
        />
      ))}
    </div>
  );
}

function DataStream() {
  return (
    <div className="absolute right-[5%] top-24 bottom-0 w-px hidden lg:block pointer-events-none overflow-hidden">
      <div className="data-stream-line"></div>
    </div>
  );
}

function HexGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
      <svg className="absolute top-0 left-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hexGrid" width="56" height="100" patternUnits="userSpaceOnUse" patternTransform="scale(1.5)">
            <path d="M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100" fill="none" stroke="#00E5FF" strokeWidth="0.5"/>
            <path d="M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34" fill="none" stroke="#7C3AED" strokeWidth="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexGrid)" />
      </svg>
    </div>
  );
}

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const spotlightRef = useRef<HTMLDivElement>(null);

  const faqs = [
    {
      q: "What is STEINZ?",
      a: "STEINZ is the world's first AI-powered on-chain intelligence platform. We analyze blockchain data across Ethereum, Solana, BSC, and Polygon to surface whale moves, rug pulls, and alpha signals BEFORE they hit Twitter."
    },
    {
      q: "How does STEINZ make money?",
      a: "We offer a free tier with basic features. Pro ($4/month) unlocks unlimited Context Feed, whale alerts, and VTX AI. We also take a small fee (2-3%) on Builder Funding transactions and swap volumes. No ads, ever."
    },
    {
      q: "Is my wallet data private?",
      a: "100%. We NEVER store your private keys. When you connect your wallet, we only READ public blockchain data. Your funds are always under your control. We're non-custodial."
    },
    {
      q: "What chains do you support?",
      a: "Ethereum, Solana, BSC, Polygon, Arbitrum, Optimism, Avalanche, Base, Fantom, Bitcoin, and Tron. More chains coming based on demand."
    },
    {
      q: "Can I trust the AI predictions?",
      a: "Our AI doesn't predict prices - it analyzes on-chain patterns and whale behavior to surface signals. Historically, signals have 89% accuracy in directional movement within 48 hours. Always DYOR."
    },
    {
      q: "How accurate is the whale tracking?",
      a: "We track real transactions from verified whale wallets (>$1M holdings). Every signal links to the actual on-chain transaction - you can verify it yourself on Etherscan/Solscan."
    },
    {
      q: "What's the Builder Funding Portal?",
      a: "A launchpad where projects raise funds with milestone-based escrow. Builders get paid when they deliver. Investors get refunds if projects fail. Trustless and transparent."
    },
    {
      q: "Do I need crypto experience?",
      a: "Nope! Our VTX AI assistant explains everything in plain English. Connect your wallet, ask questions, get answers. No jargon."
    },
    {
      q: "How much does it cost?",
      a: "Free tier: 20 events/day, 1 wallet tracking. Pro ($4/month): Unlimited everything. Premium ($15/month): Predictions, copy trading, API access."
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. No contracts, no hidden fees. Cancel with one click. Your data stays yours."
    }
  ];

  const features = [
    { icon: Zap, title: "AI Context Feed", desc: "Real-time on-chain narrative intelligence curated by AI", accent: "from-[#00E5FF] to-[#06B6D4]" },
    { icon: Brain, title: "VTX AI Engine", desc: "AI-powered assistant for markets, risk, and signals", accent: "from-[#7C3AED] to-[#A78BFA]" },
    { icon: TrendingUp, title: "Trading DNA Analyzer", desc: "Your complete on-chain trading profile decoded", accent: "from-[#10B981] to-[#34D399]" },
    { icon: Shield, title: "Security Shield", desc: "AI rug detector, scam scanner, MEV protection", accent: "from-[#EF4444] to-[#F87171]" },
    { icon: Target, title: "Builder Funding Portal", desc: "Verified builders meet capital with milestone releases", accent: "from-[#F59E0B] to-[#FBBF24]" },
    { icon: Users, title: "Multi-Chain Swap", desc: "Trade across 12+ chains with built-in safety", accent: "from-[#00E5FF] to-[#7C3AED]" },
    { icon: Search, title: "Project Discovery", desc: "Find verified Web3 projects and talent", accent: "from-[#8B5CF6] to-[#C084FC]" },
    { icon: BarChart3, title: "Portfolio Tracker", desc: "Real-time P&L and performance scoring", accent: "from-[#06B6D4] to-[#22D3EE]" },
  ];

  const chains = ["Solana", "Ethereum", "BNB", "Polygon", "Avalanche", "Base", "Arbitrum", "Optimism", "Fantom", "Bitcoin", "Tron"];

  const stats = [
    { value: "12+", label: "Chains" },
    { value: "89%", label: "Signal Accuracy" },
    { value: "$2.4B", label: "Volume Tracked" },
    { value: "50K+", label: "Active Users" },
  ];

  const howItWorks = [
    { step: "01", icon: Globe, title: "Connect", desc: "Link your wallet or enter any address. We read public data only.", color: "#00E5FF" },
    { step: "02", icon: Cpu, title: "Analyze", desc: "Our AI processes millions of on-chain signals in real-time.", color: "#7C3AED" },
    { step: "03", icon: Eye, title: "Discover", desc: "Get actionable intelligence: whale moves, risks, and alpha.", color: "#10B981" },
    { step: "04", icon: Layers, title: "Act", desc: "Execute trades, track portfolios, and stay ahead of the market.", color: "#F59E0B" },
  ];

  const [scrolled, setScrolled] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (spotlightRef.current) {
        spotlightRef.current.style.left = `${e.clientX - 200}px`;
        spotlightRef.current.style.top = `${e.clientY - 200}px`;
        spotlightRef.current.style.opacity = '1';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    Object.values(sectionRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white overflow-x-hidden">
      <div className="noise-overlay"></div>

      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all duration-500 ${scrolled ? 'bg-[#0A0E1A]/90 border-white/10 shadow-lg shadow-black/20' : 'bg-transparent border-white/5'}`}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SteinzLogo size={32} className="shadow-lg shadow-[#00E5FF]/20 animate-float-subtle" />
            <span className="text-base font-heading font-bold tracking-tight">STEINZ</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-[#00E5FF] transition-colors relative group">Features<span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-px bg-[#00E5FF] transition-all"></span></a>
            <a href="#how-it-works" className="hover:text-[#00E5FF] transition-colors relative group">How It Works<span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-px bg-[#00E5FF] transition-all"></span></a>
            <a href="#security" className="hover:text-[#00E5FF] transition-colors relative group">Security<span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-px bg-[#00E5FF] transition-all"></span></a>
            <a href="#faq" className="hover:text-[#00E5FF] transition-colors relative group">FAQ<span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-px bg-[#00E5FF] transition-all"></span></a>
          </div>
          <Link href="/dashboard">
            <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-4 py-1.5 rounded-lg text-xs font-semibold hover:scale-105 transition-transform shadow-lg shadow-[#00E5FF]/20 shimmer-btn">
              Launch App
            </button>
          </Link>
        </div>
      </nav>

      <section className="pt-24 pb-16 px-4 relative overflow-hidden min-h-[85vh] flex items-center">
        <div className="absolute inset-0 hero-mesh-enhanced pointer-events-none"></div>
        <div className="absolute inset-0 grid-pattern pointer-events-none"></div>
        <HexGrid />
        <FloatingParticles />
        <DataStream />

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[15%] left-[20%] w-96 h-96 bg-[#00E5FF] rounded-full blur-[180px] opacity-[0.07] animate-pulse-glow"></div>
          <div className="absolute bottom-[10%] right-[15%] w-96 h-96 bg-[#7C3AED] rounded-full blur-[180px] opacity-[0.07] animate-pulse-glow" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#00E5FF]/5 to-[#7C3AED]/5 rounded-full blur-[100px] animate-breathe"></div>
        </div>

        <div
          ref={spotlightRef}
          className="absolute w-[400px] h-[400px] rounded-full pointer-events-none hidden md:block"
          style={{
            background: 'radial-gradient(circle, rgba(0,229,255,0.04) 0%, transparent 70%)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
          }}
        />

        <div className="absolute top-20 left-10 w-px h-32 bg-gradient-to-b from-transparent via-[#00E5FF]/20 to-transparent animate-scanline hidden md:block"></div>
        <div className="absolute top-40 right-16 w-px h-24 bg-gradient-to-b from-transparent via-[#7C3AED]/20 to-transparent animate-scanline hidden md:block" style={{ animationDelay: '3s' }}></div>

        <div className="absolute top-32 right-[10%] hidden lg:block">
          <div className="hero-ring w-48 h-48">
            <div className="hero-ring-inner"></div>
          </div>
        </div>

        <div className="absolute bottom-32 left-[8%] hidden lg:block">
          <div className="hero-ring w-32 h-32" style={{ animationDuration: '40s' }}>
            <div className="hero-ring-inner"></div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto text-center relative z-10 w-full">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00E5FF]/5 border border-[#00E5FF]/20 rounded-full mb-8 backdrop-blur-sm animate-fadeInUp hover:bg-[#00E5FF]/10 transition-colors cursor-default group">
            <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
            <span className="text-[#00E5FF] text-xs font-semibold tracking-wide">Now Live on 12+ Chains</span>
            <Sparkles className="w-3 h-3 text-[#00E5FF]/60 group-hover:text-[#00E5FF] transition-colors" />
          </div>

          <h1 className="text-4xl md:text-6xl font-heading font-bold mb-6 leading-[1.1] tracking-tight animate-fadeInUp stagger-1">
            The Intelligence Layer{' '}
            <br className="hidden md:block" />
            the On-Chain Economy{' '}
            <span className="bg-gradient-to-r from-[#00E5FF] via-[#7C3AED] to-[#00E5FF] bg-clip-text text-transparent animate-textGradient bg-[length:200%_200%] inline-block">
              Has Been Missing
            </span>
          </h1>

          <p className="text-base md:text-lg text-gray-400 mb-10 leading-relaxed max-w-lg mx-auto animate-fadeInUp stagger-2">
            Real-time AI analysis. Multi-chain intelligence. Security built in.
            <span className="text-gray-300 font-medium"> Never get rugged again.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-14 animate-fadeInUp stagger-3">
            <Link href="/dashboard" className="flex-1">
              <button className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3.5 rounded-xl font-semibold text-sm hover:scale-[1.03] transition-all shimmer-btn shadow-xl shadow-[#00E5FF]/20 flex items-center justify-center gap-2 btn-glow relative overflow-hidden">
                <span className="relative z-10 flex items-center gap-2">Launch Dashboard <ArrowRight className="w-4 h-4" /></span>
              </button>
            </Link>
            <a href="#whitepaper" className="flex-1">
              <button className="w-full glass px-6 py-3.5 rounded-xl font-semibold text-sm hover:bg-white/10 transition-all border border-white/10 gradient-border hover:border-white/20">
                Read Whitepaper
              </button>
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto animate-fadeInUp stagger-4">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-card rounded-lg p-3">
                <AnimatedCounter value={stat.value} label={stat.label} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section className="py-6 px-4 border-y border-white/5 bg-[#111827]/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0E1A] via-transparent to-[#0A0E1A] z-10 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-500 text-[10px] uppercase tracking-[0.2em] mb-3">Supported Chains</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-400 relative z-20">
            {chains.map((chain, i) => (
              <span key={chain} className="hover:text-[#00E5FF] transition-all duration-300 cursor-default animate-fadeIn hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(0,229,255,0.3)]" style={{ animationDelay: `${i * 0.05}s` }}>{chain}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-4 px-4">
        <div className="max-w-4xl mx-auto flex justify-center">
          <PriceTicker />
        </div>
      </section>

      <div className="section-divider"></div>

      <section id="features" ref={(el) => { sectionRefs.current['features'] = el; }} className="py-16 px-4 relative">
        <div className="absolute inset-0 dot-pattern pointer-events-none opacity-50"></div>
        <div className="max-w-4xl mx-auto relative z-10">
          <div className={`text-center mb-12 transition-all duration-700 ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-[#00E5FF] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Platform Features</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">
              Everything You Need,<br />
              <span className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent">
                Nothing You Don&apos;t
              </span>
            </h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">Eight integrated tools working together to give you an unfair advantage in crypto.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`feature-card glass rounded-xl p-5 border border-white/[0.06] hover:border-[#00E5FF]/20 transition-all duration-500 glow-card group ${visibleSections.has('features') ? `animate-slide-up stagger-${Math.min(i + 1, 8)}` : 'opacity-0'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 bg-gradient-to-br ${feature.accent} rounded-lg flex items-center justify-center flex-shrink-0 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 shadow-lg group-hover:shadow-xl`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-heading font-bold mb-1 group-hover:text-white transition-colors">{feature.title}</h3>
                      <p className="text-gray-500 text-xs leading-relaxed group-hover:text-gray-400 transition-colors">{feature.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section id="how-it-works" ref={(el) => { sectionRefs.current['how-it-works'] = el; }} className="py-16 px-4 relative">
        <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
        <div className={`max-w-4xl mx-auto relative z-10 transition-all duration-700 ${visibleSections.has('how-it-works') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-12">
            <p className="text-[#7C3AED] text-xs font-semibold uppercase tracking-[0.2em] mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">
              From Zero to Alpha<br />
              <span className="bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] bg-clip-text text-transparent">
                in Four Steps
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
            <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00E5FF]/10 to-transparent hidden lg:block -translate-y-1/2"></div>

            {howItWorks.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className={`relative glass rounded-xl p-6 border border-white/[0.06] hover:border-white/10 transition-all duration-500 group step-card ${visibleSections.has('how-it-works') ? `animate-slide-up stagger-${i + 1}` : 'opacity-0'}`}
                >
                  <div className="absolute -top-3 -left-1 text-4xl font-heading font-bold opacity-[0.06] select-none" style={{ color: item.color }}>{item.step}</div>
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110"
                    style={{ background: `${item.color}10`, boxShadow: `0 0 0 1px ${item.color}15` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-sm font-heading font-bold mb-2 group-hover:text-white transition-colors">{item.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                  <div className="absolute bottom-0 left-0 w-full h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: `linear-gradient(90deg, transparent, ${item.color}30, transparent)` }}></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section id="security" ref={(el) => { sectionRefs.current['security'] = el; }} className="py-16 px-4">
        <div className={`max-w-4xl mx-auto transition-all duration-700 ${visibleSections.has('security') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="glass rounded-2xl p-8 border border-[#00E5FF]/10 bg-gradient-to-b from-[#00E5FF]/[0.03] to-transparent relative overflow-hidden">
            <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00E5FF]/30 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#7C3AED]/20 to-transparent"></div>
            <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-[#00E5FF]/10 via-transparent to-[#7C3AED]/10"></div>
            <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-[#7C3AED]/10 via-transparent to-[#00E5FF]/10"></div>
            <div className="relative z-10">
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-gradient-to-br from-[#00E5FF]/10 to-[#7C3AED]/10 rounded-xl flex items-center justify-center mx-auto mb-4 animate-float border border-white/5 security-icon-glow">
                  <Shield className="w-7 h-7 text-[#00E5FF]" />
                </div>
                <p className="text-[#00E5FF] text-xs font-semibold uppercase tracking-[0.2em] mb-2">Security Suite</p>
                <h2 className="text-2xl md:text-3xl font-heading font-bold mb-2">
                  Every Token. Every Wallet. Every Transaction.
                </h2>
                <p className="text-lg font-heading font-bold bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent">
                  Scored Before You Touch It.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: Zap, title: "AI Risk Engine", desc: "0-100 safety scoring on every asset" },
                  { icon: Search, title: "Contract Analyzer", desc: "Instant smart contract audit verification" },
                  { icon: Shield, title: "Rug Detection", desc: "Serial scammer identification & alerts" },
                  { icon: Compass, title: "Phishing Detector", desc: "Protect against malicious websites" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="glass rounded-xl p-4 border border-white/[0.06] hover:border-[#00E5FF]/20 transition-all duration-300 card-hover text-left group security-card">
                      <div className="w-8 h-8 bg-[#00E5FF]/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-[#00E5FF]/20 transition-colors group-hover:shadow-[0_0_20px_rgba(0,229,255,0.15)]">
                        <Icon className="w-4 h-4 text-[#00E5FF]" />
                      </div>
                      <h4 className="font-bold text-xs mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-[10px] leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="whitepaper" className="py-16 px-4 bg-[#111827]/20 relative">
        <div className="absolute inset-0 dot-pattern pointer-events-none opacity-30"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <p className="text-[#7C3AED] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Deep Dive</p>
          <h2 className="text-2xl md:text-3xl font-heading font-bold mb-3">
            Read the Whitepaper
          </h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed max-w-md mx-auto">
            Deep dive into our architecture, AI models, and vision for on-chain intelligence.
          </p>
          <button className="glass px-8 py-3 rounded-xl font-semibold text-sm hover:bg-white/10 transition-all border border-[#00E5FF]/20 gradient-border inline-flex items-center gap-2 hover:scale-[1.03]">
            <ExternalLink className="w-4 h-4" /> Download Whitepaper (PDF)
          </button>
        </div>
      </section>

      <div className="section-divider"></div>

      <section id="faq" ref={(el) => { sectionRefs.current['faq'] = el; }} className="py-16 px-4">
        <div className={`max-w-2xl mx-auto transition-all duration-700 ${visibleSections.has('faq') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-10">
            <p className="text-[#00E5FF] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Support</p>
            <h2 className="text-2xl md:text-3xl font-heading font-bold mb-2">
              Frequently Asked Questions
            </h2>
            <p className="text-gray-500 text-sm">Everything you need to know</p>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`glass rounded-xl overflow-hidden transition-all duration-300 border ${
                  openFAQ === index ? 'border-[#00E5FF]/30 bg-gradient-to-r from-[#00E5FF]/[0.03] to-[#7C3AED]/[0.03] shadow-[0_0_30px_rgba(0,229,255,0.05)]' : 'border-white/[0.06] hover:border-white/10'
                }`}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full px-5 py-4 flex justify-between items-center text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="font-semibold text-sm pr-3">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#00E5FF] transition-transform duration-300 flex-shrink-0 ${
                      openFAQ === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFAQ === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-5 pb-4 text-gray-400 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="section-divider"></div>

      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 hero-mesh-enhanced pointer-events-none"></div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-[#00E5FF]/5 to-[#7C3AED]/5 rounded-full blur-[120px] animate-breathe"></div>
        </div>
        <FloatingParticles />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#10B981]/10 border border-[#10B981]/20 rounded-full mb-6">
            <Activity className="w-3 h-3 text-[#10B981]" />
            <span className="text-[#10B981] text-[11px] font-semibold">Free to start</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            Ready to <span className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent">Level Up</span>?
          </h2>
          <p className="text-gray-400 mb-10 text-sm max-w-md mx-auto leading-relaxed">
            Join the future of on-chain intelligence. Free to start, powerful from day one. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
            <Link href="/dashboard" className="flex-1">
              <button className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-8 py-4 rounded-xl font-semibold text-sm inline-flex items-center justify-center gap-2 hover:scale-[1.03] transition-all shimmer-btn shadow-xl shadow-[#00E5FF]/20 btn-glow">
                Launch Platform <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/dashboard/pricing" className="flex-1">
              <button className="w-full glass px-8 py-4 rounded-xl font-semibold text-sm hover:bg-white/10 transition-all border border-white/10 gradient-border">
                View Pricing
              </button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 px-4 bg-[#111827]/30 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00E5FF]/10 to-transparent"></div>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-4">
            <SteinzLogo size={32} />
            <span className="text-base font-heading font-bold">STEINZ LABS</span>
          </div>
          <p className="text-gray-500 text-xs mb-8">Cultivate Intelligence. Navigate Risk. Grow Without Fear.</p>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div>
              <h4 className="font-bold text-xs mb-3 text-gray-300">Product</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div><Link href="/dashboard" className="hover:text-[#00E5FF] transition-colors">Dashboard</Link></div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Markets</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Security</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">DNA Analyzer</div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-xs mb-3 text-gray-300">Resources</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Whitepaper</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Docs</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">API</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Blog</div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-xs mb-3 text-gray-300">Community</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Twitter</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Telegram</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Discord</div>
              </div>
            </div>
          </div>
          <div className="text-center text-gray-600 text-[11px] border-t border-white/5 pt-6">
            &copy; 2026 STEINZ Labs. Built on Ethereum & Solana.
          </div>
        </div>
      </footer>
    </div>
  );
}
