'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Database, BarChart3, Shield, Brain, Zap, Activity, Globe, Search, TrendingUp, Lock, Eye, Layers, Send, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import ThemeToggle from '@/components/ThemeToggle';

function AnimatedCounter({ value, label }: { value: string; label: string }) {
  const match = value.match(/^([^0-9]*)(\d[\d,.]*)(.*)$/);
  const hasNumber = !!match;
  const prefix = match ? match[1] : '';
  const numericStr = match ? match[2].replace(/,/g, '') : '';
  const suffix = match ? match[3] : '';
  const target = hasNumber ? parseFloat(numericStr) : 0;
  const isAnimatable = hasNumber && !isNaN(target) && target > 0;
  const [display, setDisplay] = useState(isAnimatable ? `${prefix}0${suffix}` : value);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isAnimatable) {
      setDisplay(value);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 1800;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = target * eased;
            if (numericStr.includes('.')) {
              setDisplay(`${prefix}${current.toFixed(1)}${suffix}`);
            } else {
              setDisplay(`${prefix}${Math.floor(current).toLocaleString()}${suffix}`);
            }
            if (progress < 1) requestAnimationFrame(animate);
            else setDisplay(value);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, isAnimatable, numericStr, target, prefix, suffix]);

  return (
    <div ref={ref} className="text-center">
      <div className="text-2xl md:text-3xl font-heading font-bold text-white">
        {display}
      </div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

const featureCategories = [
  {
    tag: "Intelligence",
    title: "On-chain data, decoded",
    description: "Real-time blockchain analytics across 12+ chains. Surface whale movements, track smart money flows, and discover alpha before the crowd.",
    features: [
      { icon: Database, label: "Multi-chain indexing" },
      { icon: Activity, label: "Real-time event feeds" },
      { icon: Eye, label: "Whale movement tracking" },
      { icon: Globe, label: "Cross-chain analytics" },
    ],
    accent: "#0A1EFF",
  },
  {
    tag: "Trading",
    title: "Execute with confidence",
    description: "Built-in swap aggregation, portfolio tracking, and trading DNA analysis. Understand your patterns, optimize your edge, and trade smarter.",
    features: [
      { icon: TrendingUp, label: "Portfolio P&L tracking" },
      { icon: BarChart3, label: "Trading DNA profiling" },
      { icon: Layers, label: "Multi-chain swaps" },
      { icon: Search, label: "Token discovery" },
    ],
    accent: "#7C3AED",
  },
  {
    tag: "Security",
    title: "Never get rugged again",
    description: "AI-powered contract analysis, rug detection, and risk scoring. Every token scanned, every wallet profiled, every risk surfaced before you commit.",
    features: [
      { icon: Shield, label: "AI risk scoring (0–100)" },
      { icon: Lock, label: "Contract audit verification" },
      { icon: Zap, label: "Rug pull detection" },
      { icon: Eye, label: "MEV protection alerts" },
    ],
    accent: "#10B981",
  },
  {
    tag: "AI Engine",
    title: "Your on-chain copilot",
    description: "VTX AI processes millions of signals to deliver actionable insights. Ask questions in plain English, get answers backed by real blockchain data.",
    features: [
      { icon: Brain, label: "Natural language queries" },
      { icon: Activity, label: "Signal aggregation" },
      { icon: Database, label: "Context-aware feed" },
      { icon: Zap, label: "Predictive analytics" },
    ],
    accent: "#F59E0B",
  },
];

const faqs = [
  {
    q: "What is STEINZ LABS?",
    a: "STEINZ LABS is a professional on-chain intelligence platform. We analyze blockchain data across Ethereum, Solana, BSC, Polygon, and 8+ other chains to surface actionable insights — whale moves, risk signals, and trading opportunities.",
  },
  {
    q: "How do I get started?",
    a: "Create a free account to access real-time feeds, basic analytics, and market overview. Upgrade to STEINZ Pro for unlimited whale tracking, DNA Analyzer, advanced portfolio analytics, and priority signals.",
  },
  {
    q: "Is my wallet data private?",
    a: "100%. We never store your private keys. When you connect your wallet, we only read public blockchain data. Your funds remain under your control at all times. Fully non-custodial.",
  },
  {
    q: "What chains do you support?",
    a: "Ethereum, Solana, BSC, Polygon, Arbitrum, Optimism, Avalanche, Base, Fantom, Bitcoin, and Tron. More chains added based on community demand.",
  },
  {
    q: "How accurate is the whale tracking?",
    a: "We track verified whale wallets (>$1M holdings) in real-time. Every signal links to the actual on-chain transaction — verify it yourself on Etherscan or Solscan.",
  },
  {
    q: "What's included in the free tier?",
    a: "Free tier includes real-time feeds and basic analytics. Upgrade to STEINZ Pro for unlimited whale tracking, DNA Analyzer, advanced portfolio analytics, and priority signals.",
  },
];

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const stats = [
    { value: "12+", label: "Chains" },
    { value: "1000000+", label: "Datasets Indexed" },
    { value: "24/7", label: "Live Monitoring" },
    { value: "100%", label: "Non-Custodial" },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
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
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06] shadow-lg shadow-black/20' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SteinzLogo size={28} />
            <span className="text-sm font-heading font-bold tracking-tight">STEINZ LABS</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <Link href="/whitepaper" className="hover:text-white transition-colors">Docs</Link>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block text-[13px] font-medium text-gray-300 hover:text-white px-3 py-2 transition-colors">
              Log In
            </Link>
            <Link href="/signup" className="hidden sm:flex items-center bg-white text-black px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-gray-100 transition-all">
              Sign Up
            </Link>
            <div className="flex sm:hidden items-center gap-1">
              <Link href="/login" className="text-[13px] font-medium text-gray-300 hover:text-white px-2 py-1.5 transition-colors">
                Log In
              </Link>
              <Link href="/signup" className="bg-white text-black px-3 py-1.5 rounded-lg text-[12px] font-semibold hover:bg-gray-100 transition-all">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[20%] left-[15%] w-[500px] h-[500px] bg-neon-blue/[0.04] rounded-full blur-[150px]"></div>
          <div className="absolute bottom-[10%] right-[10%] w-[400px] h-[400px] bg-purple/[0.03] rounded-full blur-[150px]"></div>
        </div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-full mb-8 animate-fade-slide-in">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></div>
            <span className="text-[12px] text-gray-400 font-medium">Professional on-chain intelligence platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-6 leading-[1.08] tracking-tight animate-fade-slide-in" style={{ animationDelay: '0.1s' }}>
            The intelligence layer
            <br />
            <span className="gradient-text-blue">for on-chain alpha</span>
          </h1>

          <p className="text-base sm:text-lg text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed animate-fade-slide-in" style={{ animationDelay: '0.2s' }}>
            Track whales. Analyze wallets. Scan contracts. Act on real-time blockchain data before the crowd.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto mb-20 animate-fade-slide-in" style={{ animationDelay: '0.3s' }}>
            <Link href="/login" className="flex-1 w-full bg-neon-blue px-6 py-3.5 rounded-xl font-semibold text-sm text-white hover:bg-neon-blue-400 transition-all shadow-neon flex items-center justify-center gap-2">
              Launch App <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/whitepaper" className="flex-1 w-full px-6 py-3.5 rounded-xl font-semibold text-sm text-gray-300 border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.03] transition-all text-center">
              Read Docs
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 max-w-2xl mx-auto animate-fade-slide-in" style={{ animationDelay: '0.4s' }}>
            {stats.map((stat) => (
              <AnimatedCounter key={stat.label} value={stat.value} label={stat.label} />
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section
        id="features"
        ref={(el) => { sectionRefs.current['features'] = el; }}
        className="py-24 px-4 sm:px-6"
      >
        <div className="max-w-5xl mx-auto">
          <div className={`text-center mb-16 transition-all duration-700 ${visibleSections.has('features') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className="text-neon-blue text-[12px] font-semibold uppercase tracking-[0.2em] mb-3">Platform</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Built for serious analysts
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              Four integrated modules working together to give you a complete picture of on-chain activity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featureCategories.map((category, i) => (
              <div
                key={category.tag}
                className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-300 group ${visibleSections.has('features') ? 'animate-fade-slide-in' : 'opacity-0'}`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div
                  className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-4 px-2.5 py-1 rounded-md inline-block"
                  style={{ color: category.accent, background: `${category.accent}10` }}
                >
                  {category.tag}
                </div>
                <h3 className="text-lg font-heading font-bold mb-2 group-hover:text-white transition-colors">{category.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">{category.description}</p>
                <div className="grid grid-cols-2 gap-3">
                  {category.features.map((f) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.label} className="flex items-center gap-2.5 text-[13px] text-gray-400">
                        <Icon className="w-4 h-4 flex-shrink-0" style={{ color: category.accent }} />
                        <span>{f.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section
        id="security"
        ref={(el) => { sectionRefs.current['security'] = el; }}
        className="py-24 px-4 sm:px-6"
      >
        <div className={`max-w-4xl mx-auto transition-all duration-700 ${visibleSections.has('security') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 sm:p-12">
            <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
              <div className="flex-1">
                <p className="text-success text-[12px] font-semibold uppercase tracking-[0.2em] mb-3">Security First</p>
                <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">
                  Your assets, your control
                </h2>
                <p className="text-gray-400 text-sm leading-relaxed mb-6">
                  Non-custodial by design. We read public blockchain data only — your private keys never leave your wallet. Every analysis runs on verified on-chain transactions.
                </p>
                <div className="space-y-4">
                  {[
                    { label: "Non-custodial architecture", desc: "We never have access to your funds" },
                    { label: "Read-only data access", desc: "Public blockchain data only, no write permissions" },
                    { label: "Verified on-chain sources", desc: "Every data point traceable to its transaction" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 bg-success rounded-full"></div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-[13px] text-gray-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 w-full md:w-auto">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "0", label: "Private keys stored" },
                    { value: "100%", label: "Non-custodial" },
                    { value: "12+", label: "Chains secured" },
                    { value: "24/7", label: "Monitoring" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center min-w-[120px]">
                      <div className="text-lg font-heading font-bold text-white">{s.value}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section
        id="pricing"
        ref={(el) => { sectionRefs.current['pricing'] = el; }}
        className="py-24 px-4 sm:px-6"
      >
        <div className={`max-w-4xl mx-auto transition-all duration-700 ${visibleSections.has('pricing') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-12">
            <p className="text-neon-blue text-[12px] font-semibold uppercase tracking-[0.2em] mb-3">Plans</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Unlock the full intelligence layer
            </h2>
            <p className="text-gray-500 text-sm max-w-lg mx-auto">
              Choose a plan that fits your needs — from free analytics to professional-grade intelligence tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                tier: "Free",
                price: "$0",
                desc: "Get started with core features",
                perks: ["Real-time context feed", "Basic token scanner", "Market overview", "VTX Agent (15 msgs/day)"],
                accent: "#6B7280",
                cta: "Start Free",
                link: "/signup",
              },
              {
                tier: "STEINZ Pro",
                price: "$19/mo",
                desc: "Full intelligence suite unlocked",
                perks: ["DNA Wallet Analyzer (AI)", "Unlimited whale tracking", "Advanced portfolio analytics", "Unlimited VTX Agent"],
                accent: "#0A1EFF",
                cta: "Coming Soon",
                featured: true,
                link: "#",
              },
              {
                tier: "Premium",
                price: "$99/mo",
                desc: "Maximum power for professionals",
                perks: ["Everything in Pro tier", "API access for developers", "Custom webhook alerts", "Priority support"],
                accent: "#F59E0B",
                cta: "Coming Soon",
                link: "#",
              },
            ].map((plan) => (
              <div
                key={plan.tier}
                className={`rounded-xl border p-6 ${plan.featured ? 'border-neon-blue/30 bg-neon-blue/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}
              >
                {plan.featured && (
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neon-blue mb-3">Most Popular</div>
                )}
                <h3 className="text-lg font-heading font-bold mb-1" style={{ color: plan.accent }}>{plan.tier}</h3>
                <div className="text-xl font-bold mb-1">{plan.price}</div>
                <p className="text-gray-500 text-xs mb-4">{plan.desc}</p>
                <div className="space-y-2 mb-6">
                  {plan.perks.map((perk) => (
                    <div key={perk} className="flex items-center gap-2 text-[13px] text-gray-300">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: plan.accent }}></div>
                      {perk}
                    </div>
                  ))}
                </div>
                <Link href={plan.link}>
                  <button
                    className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                    style={plan.featured ? { backgroundColor: plan.accent, color: 'white' } : { border: '1px solid rgba(255,255,255,0.1)', color: '#9CA3AF' }}
                    disabled={plan.cta === 'Coming Soon'}
                  >
                    {plan.cta}
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section
        id="faq"
        ref={(el) => { sectionRefs.current['faq'] = el; }}
        className="py-24 px-4 sm:px-6"
      >
        <div className={`max-w-2xl mx-auto transition-all duration-700 ${visibleSections.has('faq') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="text-center mb-12">
            <p className="text-neon-blue text-[12px] font-semibold uppercase tracking-[0.2em] mb-3">FAQ</p>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">
              Frequently asked questions
            </h2>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`rounded-xl border transition-all duration-300 ${
                  openFAQ === index
                    ? 'border-neon-blue/20 bg-neon-blue/[0.02]'
                    : 'border-white/[0.06] hover:border-white/[0.1]'
                }`}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full px-5 py-4 flex justify-between items-center text-left"
                >
                  <span className="font-semibold text-sm pr-3">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform duration-300 flex-shrink-0 ${
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

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent max-w-4xl mx-auto"></div>

      <section className="py-24 px-4 sm:px-6 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-blue/[0.03] rounded-full blur-[150px]"></div>
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
            Start your intelligence journey
          </h2>
          <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto leading-relaxed">
            Free to start. No credit card required. Sign in with email to unlock STEINZ LABS intelligence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
            <Link href="/login" className="flex-1 w-full bg-neon-blue px-8 py-4 rounded-xl font-semibold text-sm text-white hover:bg-neon-blue-400 transition-all shadow-neon flex items-center justify-center gap-2">
              Launch App <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/whitepaper" className="flex-1">
              <button className="w-full px-8 py-4 rounded-xl font-semibold text-sm text-gray-300 border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.03] transition-all flex items-center justify-center gap-2">
                Learn More
              </button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <SteinzLogo size={24} />
                <span className="text-sm font-heading font-bold">STEINZ LABS</span>
              </div>
              <p className="text-gray-500 text-xs leading-relaxed">
                Professional on-chain intelligence platform.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-xs mb-3 text-gray-300 uppercase tracking-wider">Product</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></div>
                <div><Link href="/dashboard/dna-analyzer" className="hover:text-white transition-colors">DNA Analyzer</Link></div>
                <div><Link href="/dashboard/security" className="hover:text-white transition-colors">Security Scanner</Link></div>
                <div><Link href="/dashboard/vtx-ai" className="hover:text-white transition-colors">VTX AI</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-xs mb-3 text-gray-300 uppercase tracking-wider">Resources</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div><Link href="/whitepaper" className="hover:text-white transition-colors">Whitepaper</Link></div>
                <div><Link href="/whitepaper#architecture" className="hover:text-white transition-colors">Documentation</Link></div>
                <div><Link href="/dashboard/trading-suite" className="hover:text-white transition-colors">STEINZ Terminal</Link></div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-xs mb-3 text-gray-300 uppercase tracking-wider">Community</h4>
              <div className="space-y-2 text-gray-500 text-xs">
                <div><a href="https://x.com/steinzlabs" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitter / X</a></div>
                <div><span className="hover:text-white transition-colors cursor-pointer">Telegram</span></div>
                <div><span className="hover:text-white transition-colors cursor-pointer">Discord</span></div>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.06] pt-8">
            <div className="flex items-center gap-3">
              <p className="text-gray-600 text-[11px]">&copy; 2026 STEINZ LABS. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
