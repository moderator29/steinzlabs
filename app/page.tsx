'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ArrowRight, Zap, Brain, TrendingUp, Shield, Target, Users, Search, BarChart3, Compass, ExternalLink, Sparkles } from 'lucide-react';
import Link from 'next/link';
import PriceTicker from '@/components/PriceTicker';

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

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

  const [scrolled, setScrolled] = useState(false);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

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
      <nav className={`fixed top-0 w-full z-50 backdrop-blur-xl border-b transition-all duration-300 ${scrolled ? 'bg-[#0A0E1A]/90 border-white/10 shadow-lg shadow-black/20' : 'bg-transparent border-white/5'}`}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center shadow-lg shadow-[#00E5FF]/20 animate-float-subtle">
              <span className="text-sm font-bold">S</span>
            </div>
            <span className="text-base font-heading font-bold tracking-tight">STEINZ</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-400">
            <a href="#features" className="hover:text-[#00E5FF] transition-colors relative group">Features<span className="absolute -bottom-1 left-0 w-0 group-hover:w-full h-px bg-[#00E5FF] transition-all"></span></a>
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

      <section className="pt-24 pb-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 hero-mesh-enhanced pointer-events-none"></div>
        <div className="absolute inset-0 grid-pattern pointer-events-none"></div>

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[15%] left-[20%] w-96 h-96 bg-[#00E5FF] rounded-full blur-[180px] opacity-[0.07] animate-pulse-glow"></div>
          <div className="absolute bottom-[10%] right-[15%] w-96 h-96 bg-[#7C3AED] rounded-full blur-[180px] opacity-[0.07] animate-pulse-glow" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#00E5FF]/5 to-[#7C3AED]/5 rounded-full blur-[100px] animate-breathe"></div>
        </div>

        <div className="absolute top-20 left-10 w-px h-32 bg-gradient-to-b from-transparent via-[#00E5FF]/20 to-transparent animate-scanline hidden md:block"></div>
        <div className="absolute top-40 right-16 w-px h-24 bg-gradient-to-b from-transparent via-[#7C3AED]/20 to-transparent animate-scanline hidden md:block" style={{ animationDelay: '3s' }}></div>

        <div className="max-w-2xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00E5FF]/5 border border-[#00E5FF]/20 rounded-full mb-8 backdrop-blur-sm animate-fadeInUp">
            <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
            <span className="text-[#00E5FF] text-xs font-semibold tracking-wide">Now Live on 12+ Chains</span>
            <Sparkles className="w-3 h-3 text-[#00E5FF]/60" />
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

          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto mb-12 animate-fadeInUp stagger-3">
            <Link href="/dashboard" className="flex-1">
              <button className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3.5 rounded-xl font-semibold text-sm hover:scale-[1.03] transition-all shimmer-btn shadow-xl shadow-[#00E5FF]/20 flex items-center justify-center gap-2">
                Launch Dashboard <ArrowRight className="w-4 h-4" />
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
              <div key={stat.label} className="text-center">
                <div className="text-xl md:text-2xl font-heading font-bold bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent">{stat.value}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-6 px-4 border-y border-white/5 bg-[#111827]/20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0E1A] via-transparent to-[#0A0E1A] z-10 pointer-events-none"></div>
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-500 text-[10px] uppercase tracking-[0.2em] mb-3">Supported Chains</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-400 relative z-20">
            {chains.map((chain, i) => (
              <span key={chain} className="hover:text-[#00E5FF] transition-colors cursor-default animate-fadeIn" style={{ animationDelay: `${i * 0.05}s` }}>{chain}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-4 px-4">
        <div className="max-w-4xl mx-auto flex justify-center">
          <PriceTicker />
        </div>
      </section>

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
                  className={`glass rounded-xl p-5 border border-white/[0.06] hover:border-[#00E5FF]/20 transition-all duration-500 glow-card group animate-slide-up stagger-${Math.min(i + 1, 8)}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 bg-gradient-to-br ${feature.accent} rounded-lg flex items-center justify-center flex-shrink-0 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all duration-300 shadow-lg`}>
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

      <section id="security" ref={(el) => { sectionRefs.current['security'] = el; }} className="py-16 px-4">
        <div className={`max-w-4xl mx-auto transition-all duration-700 ${visibleSections.has('security') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="glass rounded-2xl p-8 border border-[#00E5FF]/10 bg-gradient-to-b from-[#00E5FF]/[0.03] to-transparent relative overflow-hidden">
            <div className="absolute inset-0 grid-pattern pointer-events-none opacity-30"></div>
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[#00E5FF]/30 to-transparent"></div>
            <div className="relative z-10">
              <div className="text-center mb-8">
                <div className="w-14 h-14 bg-gradient-to-br from-[#00E5FF]/10 to-[#7C3AED]/10 rounded-xl flex items-center justify-center mx-auto mb-4 animate-float border border-white/5">
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
                    <div key={item.title} className="glass rounded-xl p-4 border border-white/[0.06] hover:border-[#00E5FF]/20 transition-all duration-300 card-hover text-left group">
                      <div className="w-8 h-8 bg-[#00E5FF]/10 rounded-lg flex items-center justify-center mb-3 group-hover:bg-[#00E5FF]/20 transition-colors">
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

      <section id="whitepaper" className="py-16 px-4 bg-[#111827]/20">
        <div className="max-w-4xl mx-auto text-center">
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
                  openFAQ === index ? 'border-[#00E5FF]/30 bg-gradient-to-r from-[#00E5FF]/[0.03] to-[#7C3AED]/[0.03]' : 'border-white/[0.06] hover:border-white/10'
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

      <section className="py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 hero-mesh-enhanced pointer-events-none"></div>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-br from-[#00E5FF]/5 to-[#7C3AED]/5 rounded-full blur-[120px]"></div>
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-2xl md:text-3xl font-heading font-bold mb-3">
            Ready to Level Up?
          </h2>
          <p className="text-gray-400 mb-8 text-sm max-w-md mx-auto">
            Join the future of on-chain intelligence. Free to start, powerful from day one.
          </p>
          <Link href="/dashboard">
            <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-8 py-4 rounded-xl font-semibold text-sm inline-flex items-center gap-2 hover:scale-[1.03] transition-all shimmer-btn shadow-xl shadow-[#00E5FF]/20">
              Launch Platform <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 px-4 bg-[#111827]/30">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center shadow-lg shadow-[#00E5FF]/10">
              <span className="text-sm font-bold">S</span>
            </div>
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
