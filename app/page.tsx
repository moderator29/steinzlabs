'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, ArrowRight, Play, Target, Shield, Zap, TrendingUp, Brain, Users } from 'lucide-react';
import Link from 'next/link';

function AnimatedCounter({ end, suffix = '', prefix = '' }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000;
          const startTime = performance.now();
          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return <div ref={ref}>{prefix}{count.toLocaleString()}{suffix}</div>;
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const features = useInView(0.1);
  const stats = useInView(0.3);

  const faqs = [
    {
      q: "What is STEINZ?",
      a: "STEINZ is the world's first AI-powered on-chain intelligence platform. We analyze blockchain data across Ethereum, Solana, BSC, and Polygon to surface whale moves, rug pulls, and alpha signals BEFORE they hit Twitter. Think of us as your unfair advantage in crypto."
    },
    {
      q: "How does STEINZ make money?",
      a: "We offer a free tier with basic features. Pro ($4/month) unlocks unlimited Context Feed, whale alerts, and VTX AI. We also take a small fee (2-3%) on Builder Funding transactions and swap volumes. No ads, ever."
    },
    {
      q: "Is my wallet data private?",
      a: "100%. We NEVER store your private keys. When you connect your wallet, we only READ public blockchain data (which is already public anyway). Your funds are always under your control. We're non-custodial."
    },
    {
      q: "What chains do you support?",
      a: "Ethereum, Solana, BSC (Binance Smart Chain), Polygon, Arbitrum, and Optimism. More chains coming based on user demand."
    },
    {
      q: "Can I trust the AI predictions?",
      a: "Our AI doesn't predict prices - it analyzes on-chain patterns and whale behavior to surface signals. Historically, signals flagged by our system have 89% accuracy in directional movement within 48 hours. But crypto is volatile - always DYOR."
    },
    {
      q: "How accurate is the whale tracking?",
      a: "We track real transactions from verified whale wallets (>$1M holdings). Every signal links to the actual on-chain transaction - you can verify it yourself on Etherscan/Solscan. It's not guesswork; it's math."
    },
    {
      q: "What's the Builder Funding Portal?",
      a: "It's a launchpad where projects can raise funds with milestone-based escrow protection. Builders get paid only when they deliver. Investors get refunds if projects fail. It's trustless, transparent, and protects everyone."
    },
    {
      q: "Do I need crypto experience?",
      a: "Nope! Our VTX AI assistant explains everything in plain English. Connect your wallet, ask questions, get answers. No jargon, no confusion."
    },
    {
      q: "How much does it cost?",
      a: "Free tier: Context Feed (20 events/day), 1 wallet tracking, basic scanner. Pro ($4/month): Unlimited everything. Premium ($15/month): Predictions, copy trading, API access."
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes. No contracts, no hidden fees. Cancel with one click from your dashboard. Your data stays yours even after canceling."
    }
  ];

  const featureCards = [
    { icon: Zap, title: "Context Feed", desc: "Real-time on-chain events with AI summaries, sentiment analysis, and trust scores. Never miss a whale move again." },
    { icon: Brain, title: "VTX AI Assistant", desc: "Context-aware AI that knows your portfolio and trading history. Ask anything, get personalized insights." },
    { icon: TrendingUp, title: "Whale Tracker", desc: "Track wallets with >$1M holdings. Get alerts when Smart Money moves. Follow the winners." },
    { icon: Shield, title: "Security Scanner", desc: "Token scanner, rug detector, contract analyzer, and phishing protection. Stay safe." },
    { icon: Target, title: "Predictions Market", desc: "Vote on price predictions with crypto. Winners earn rewards. Community-driven intelligence." },
    { icon: Users, title: "Builder Funding", desc: "Trustless launchpad with milestone escrow. Builders get paid, investors protected." },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <div className="fixed inset-0 grid-pattern pointer-events-none z-0"></div>

      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center shadow-lg shadow-[#00E5FF]/20">
                <span className="text-2xl font-bold">S</span>
              </div>
              <span className="text-2xl font-heading font-bold">STEINZ</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="hover:text-[#00E5FF] transition-colors">Features</a>
              <a href="#whitepaper" className="hover:text-[#00E5FF] transition-colors">Whitepaper</a>
              <a href="#pricing" className="hover:text-[#00E5FF] transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-[#00E5FF] transition-colors">FAQ</a>
            </div>
            <Link href="/dashboard">
              <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-2.5 rounded-lg font-semibold hover:scale-105 transition-transform shadow-lg shadow-[#00E5FF]/20">
                Launch App
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00E5FF] rounded-full blur-[120px] animate-float"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7C3AED] rounded-full blur-[120px] animate-float-delayed"></div>
        </div>

        <div className="absolute top-20 left-10 w-2 h-2 bg-[#00E5FF] rounded-full animate-orbit opacity-40"></div>
        <div className="absolute top-40 right-20 w-1.5 h-1.5 bg-[#7C3AED] rounded-full animate-orbit opacity-30" style={{ animationDuration: '25s', animationDirection: 'reverse' }}></div>
        <div className="absolute bottom-40 left-1/3 w-1 h-1 bg-[#00E5FF] rounded-full animate-orbit opacity-20" style={{ animationDuration: '30s' }}></div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-block px-4 py-2 bg-[#00E5FF]/10 border border-[#00E5FF]/30 rounded-full mb-6 backdrop-blur-sm animate-fadeInUp animate-borderGlow">
            <span className="text-[#00E5FF] text-sm font-semibold">🚀 Beta Launch - Join Early</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6 leading-tight animate-fadeInUp stagger-1">
            On-Chain Intelligence,
            <br />
            <span className="bg-gradient-to-r from-[#00E5FF] via-[#7C3AED] to-[#00E5FF] bg-clip-text text-transparent animate-textGradient bg-[length:200%_auto]">
              Redefined.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto leading-relaxed animate-fadeInUp stagger-2">
            The only platform that shows you what Smart Money sees before everyone else.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fadeInUp stagger-3">
            <Link href="/dashboard">
              <button className="group bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-8 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:scale-105 transition-all duration-300 shadow-lg shadow-[#00E5FF]/25 hover:shadow-[#00E5FF]/40 relative overflow-hidden">
                <span className="relative z-10 flex items-center gap-2">
                  Start Free - No Card Required <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto animate-fadeInUp stagger-4">
            <div className="flex flex-col items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" />
              <span className="text-sm text-gray-400">Real-time tracking</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" />
              <span className="text-sm text-gray-400">AI-powered signals</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" />
              <span className="text-sm text-gray-400">Zero noise</span>
            </div>
          </div>
        </div>
      </section>

      <section ref={stats.ref} className="py-16 px-4 border-y border-white/10 relative">
        <div className="absolute inset-0 dot-pattern pointer-events-none"></div>
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
          {[
            { end: 847, prefix: '$', suffix: 'M', label: 'Whale Moves Tracked' },
            { end: 12347, prefix: '', suffix: '', label: 'Active Users' },
            { end: 89, prefix: '', suffix: '%', label: 'Signal Accuracy' },
            { end: 6, prefix: '', suffix: '', label: 'Chains Supported' },
          ].map((stat, i) => (
            <div key={i} className={`text-center ${stats.inView ? 'animate-fadeInScale' : 'opacity-0'}`} style={{ animationDelay: `${i * 0.15}s` }}>
              <div className="text-4xl font-heading font-bold text-[#00E5FF] mb-2">
                {stats.inView ? <AnimatedCounter end={stat.end} prefix={stat.prefix} suffix={stat.suffix} /> : `${stat.prefix}0${stat.suffix}`}
              </div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="py-20 px-4 bg-gradient-to-b from-transparent to-[#111827]/30 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">
              Built for Serious Traders
            </h2>
            <p className="text-gray-400 text-lg">Everything you need to stay ahead of the market</p>
          </div>

          <div ref={features.ref} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  className={`glow-card glass rounded-2xl p-8 hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:border-[#00E5FF]/30 group ${features.inView ? 'animate-fadeInUp' : 'opacity-0'}`}
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center mb-4 group-hover:shadow-lg group-hover:shadow-[#00E5FF]/30 transition-shadow duration-300">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-3">{card.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{card.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="whitepaper" className="py-20 px-4 bg-[#111827]/30 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-72 h-72 bg-[#7C3AED] rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#00E5FF] rounded-full blur-[100px]"></div>
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
            Read the Whitepaper
          </h2>
          <p className="text-xl text-gray-300 mb-10 leading-relaxed">
            Deep dive into our architecture, AI models, and vision for on-chain intelligence.
          </p>
          <button className="glass px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-all duration-300 border border-[#00E5FF]/30 hover:border-[#00E5FF]/60 hover:shadow-lg hover:shadow-[#00E5FF]/10">
            Download Whitepaper (PDF)
          </button>
        </div>
      </section>

      <section id="faq" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-center mb-4">
            Everything You Want to Know
          </h2>
          <p className="text-gray-400 text-center mb-12 text-lg">Get answers to common questions</p>

          <div className="space-y-3">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`glass rounded-xl overflow-hidden transition-all duration-300 border ${
                  openFAQ === index ? 'border-[#00E5FF]/50 bg-gradient-to-r from-[#00E5FF]/5 to-[#7C3AED]/5 shadow-lg shadow-[#00E5FF]/5' : 'border-white/10'
                }`}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full px-6 py-5 flex justify-between items-center text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold text-lg pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#00E5FF] transition-transform duration-300 flex-shrink-0 ${
                      openFAQ === index ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    openFAQ === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="px-6 pb-5 text-gray-300 leading-relaxed">
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 bg-gradient-to-b from-transparent to-[#00E5FF]/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-center mb-12">
            Choose Your Edge
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glow-card glass rounded-2xl p-8 hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:border-white/20">
              <h3 className="text-2xl font-heading font-bold mb-2">Free</h3>
              <div className="text-5xl font-bold mb-6">$0</div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">20 events/day</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">1 wallet tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">Basic scanner</span>
                </li>
              </ul>
              <Link href="/dashboard">
                <button className="w-full glass px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
                  Get Started
                </button>
              </Link>
            </div>

            <div className="glow-card glass rounded-2xl p-8 hover:scale-[1.03] transition-all duration-300 border-2 border-[#00E5FF] relative animate-borderGlow shadow-lg shadow-[#00E5FF]/10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-4 py-1 rounded-full text-sm font-semibold shadow-lg shadow-[#00E5FF]/30">
                MOST POPULAR
              </div>
              <h3 className="text-2xl font-heading font-bold mb-2">Pro</h3>
              <div className="text-5xl font-bold mb-6">
                $4<span className="text-lg text-gray-400">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">Unlimited events</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">Unlimited wallets</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">Whale alerts</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">VTX AI (50/day)</span>
                </li>
              </ul>
              <button className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3 rounded-lg font-semibold hover:scale-105 transition-transform shadow-lg shadow-[#00E5FF]/20">
                Upgrade to Pro
              </button>
            </div>

            <div className="glow-card glass rounded-2xl p-8 hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:border-white/20">
              <h3 className="text-2xl font-heading font-bold mb-2">Premium</h3>
              <div className="text-5xl font-bold mb-6">
                $15<span className="text-lg text-gray-400">/mo</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">Everything in Pro</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">Predictions Market</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">Copy Trading</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-[#10B981] mt-1 flex-shrink-0" />
                  <span className="text-gray-300">API Access</span>
                </li>
              </ul>
              <button className="w-full glass px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
                Go Premium
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-full blur-[150px]"></div>
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
            Ready to Level Up?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join the future of on-chain intelligence.
          </p>
          <Link href="/dashboard">
            <button className="group bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-10 py-4 rounded-xl font-semibold text-lg inline-flex items-center gap-2 hover:scale-105 transition-all duration-300 shadow-lg shadow-[#00E5FF]/25 hover:shadow-[#00E5FF]/40 relative overflow-hidden">
              <span className="relative z-10 flex items-center gap-2">
                Launch Platform <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-[#7C3AED] to-[#00E5FF] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-12 px-4 bg-[#111827]/50 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center shadow-lg shadow-[#00E5FF]/20">
                <span className="text-2xl font-bold">S</span>
              </div>
              <span className="text-2xl font-heading font-bold">STEINZ</span>
            </div>
            <div className="flex gap-8 text-gray-400">
              <a href="#" className="hover:text-[#00E5FF] transition-colors">Twitter</a>
              <a href="#" className="hover:text-[#00E5FF] transition-colors">Discord</a>
              <a href="#" className="hover:text-[#00E5FF] transition-colors">Docs</a>
              <a href="#" className="hover:text-[#00E5FF] transition-colors">Blog</a>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm mt-8">
            © 2025 STEINZ Labs. Built on Ethereum & Solana.
          </div>
        </div>
      </footer>
    </div>
  );
}
