'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, ArrowRight, Zap, Brain, TrendingUp, Shield, Target, Users } from 'lucide-react';
import Link from 'next/link';

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(entry.target.id));
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('[data-animate]').forEach((el) => {
      observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

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
    { icon: Zap, title: "AI Context Feed", desc: "Real-time on-chain narrative intelligence curated by AI" },
    { icon: Brain, title: "VTX AI Engine", desc: "AI-powered assistant for markets, risk, and signals" },
    { icon: TrendingUp, title: "Trading DNA Analyzer", desc: "Your complete on-chain trading profile decoded" },
    { icon: Shield, title: "Security Shield", desc: "AI rug detector, scam scanner, MEV protection" },
    { icon: Target, title: "Builder Funding Portal", desc: "Verified builders meet capital with milestone releases" },
    { icon: Users, title: "Multi-Chain Swap", desc: "Trade across 12+ chains with built-in safety" },
  ];

  const chains = ["Solana", "Ethereum", "BNB", "Polygon", "Avalanche", "Base", "Arbitrum", "Optimism", "Fantom", "Bitcoin", "Tron"];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
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
        <div className="absolute inset-0 grid-pattern"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00E5FF] rounded-full blur-[120px] animate-pulse-glow"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#7C3AED] rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00E5FF]/30 rounded-full blur-[100px] animate-float"></div>
        </div>

        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-block px-4 py-2 bg-[#00E5FF]/10 border border-[#00E5FF]/30 rounded-full mb-6 backdrop-blur-sm animate-fadeInUp">
            <span className="text-[#00E5FF] text-sm font-semibold">🚀 Now Live on 12+ Chains</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6 leading-tight animate-fadeInUp stagger-1">
            The Intelligence Layer<br />
            the On-Chain Economy
            <br />
            <span className="bg-gradient-to-r from-[#00E5FF] via-[#7C3AED] to-[#00E5FF] bg-clip-text text-transparent bg-[length:200%_auto] animate-textGradient">
              Has Been Missing
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-4xl mx-auto leading-relaxed animate-fadeInUp stagger-2">
            Real-time AI analysis. Multi-chain intelligence. Security built in. Never get rugged again.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fadeInUp stagger-3">
            <Link href="/dashboard">
              <button className="group bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-8 py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-2 hover:scale-105 transition-all shadow-lg shadow-[#00E5FF]/25 relative overflow-hidden">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
                <span className="relative">Launch Dashboard</span> <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <a href="#whitepaper">
              <button className="glass px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-colors border border-[#00E5FF]/30 hover:border-[#00E5FF]/60 hover:shadow-lg hover:shadow-[#00E5FF]/10">
                Read Whitepaper
              </button>
            </a>
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

      <section className="py-12 px-4 border-y border-white/10 bg-[#111827]/30 relative overflow-hidden">
        <div className="absolute inset-0 dot-pattern opacity-50"></div>
        <div className="max-w-6xl mx-auto relative z-10">
          <p className="text-center text-gray-400 text-sm uppercase tracking-wider mb-6">Supported Chains</p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-gray-300">
            {chains.map((chain) => (
              <span key={chain} className="hover:text-[#00E5FF] transition-colors cursor-default">{chain}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 relative" data-animate>
        <div className="absolute inset-0 grid-pattern opacity-50"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-heading font-bold mb-4">
              Everything You Need,<br />
              <span className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent">
                Nothing You Don&apos;t
              </span>
            </h2>
            <p className="text-gray-400 text-lg">Built for serious traders and builders</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`glow-card glass rounded-2xl p-8 hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:border-[#00E5FF]/30 opacity-0 ${
                    visibleSections.has('features') ? 'animate-fadeInUp' : ''
                  } stagger-${i + 1}`}
                  id={i === 0 ? 'features-trigger' : undefined}
                  data-animate
                >
                  <div className="w-14 h-14 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-[#00E5FF]/20">
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-[#00E5FF]/5 relative">
        <div className="absolute inset-0 dot-pattern opacity-30"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="w-20 h-20 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#00E5FF]/20 animate-float">
            <Shield className="w-10 h-10" />
          </div>
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
            Every Token. Every Wallet.<br />Every Transaction.
            <br />
            <span className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent">
              Scored Before You Touch It.
            </span>
          </h2>
          <p className="text-xl text-gray-300 mb-10 leading-relaxed">
            0-100 safety scoring on every asset
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "AI Risk Engine", desc: "0-100 safety scoring on every asset" },
              { title: "Contract Analyzer", desc: "Instant smart contract audit verification" },
              { title: "Rug Detection", desc: "Serial scammer identification & alerts" },
              { title: "Phishing Detector", desc: "Protect against malicious websites" },
            ].map((item) => (
              <div key={item.title} className="glow-card glass rounded-xl p-6 border border-white/10 hover:border-[#00E5FF]/30 transition-all duration-300">
                <h4 className="font-bold text-lg mb-2 text-[#00E5FF]">{item.title}</h4>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="whitepaper" className="py-20 px-4 bg-[#111827]/30 relative">
        <div className="absolute inset-0 grid-pattern opacity-30"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
            Read the Whitepaper
          </h2>
          <p className="text-xl text-gray-300 mb-10 leading-relaxed">
            Deep dive into our architecture, AI models, and vision for on-chain intelligence.
          </p>
          <button className="glass px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white/10 transition-colors border border-[#00E5FF]/30 hover:border-[#00E5FF]/60 hover:shadow-lg hover:shadow-[#00E5FF]/10">
            Download Whitepaper (PDF)
          </button>
        </div>
      </section>

      <section id="faq" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-center mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-400 text-center mb-12 text-lg">Everything you need to know</p>

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
                    className={`w-5 h-5 text-[#00E5FF] transition-transform flex-shrink-0 ${
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
            <div className="glow-card glass rounded-2xl p-8 hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:border-[#00E5FF]/30">
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

            <div className="glow-card glass rounded-2xl p-8 hover:scale-[1.03] transition-all duration-300 border-2 border-[#00E5FF] relative shadow-lg shadow-[#00E5FF]/10">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-4 py-1 rounded-full text-sm font-semibold">
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

            <div className="glow-card glass rounded-2xl p-8 hover:scale-[1.03] transition-all duration-300 border border-white/10 hover:border-[#00E5FF]/30">
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

      <section className="py-20 px-4 relative">
        <div className="absolute inset-0 opacity-10">
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
            <button className="group bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-10 py-4 rounded-xl font-semibold text-lg inline-flex items-center gap-2 hover:scale-105 transition-transform shadow-lg shadow-[#00E5FF]/25 relative overflow-hidden">
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></span>
              <span className="relative">Launch Platform</span> <ArrowRight className="w-5 h-5 relative group-hover:translate-x-1 transition-transform" />
            </button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-12 px-4 bg-[#111827]/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-xl flex items-center justify-center">
                  <span className="text-2xl font-bold">S</span>
                </div>
                <span className="text-2xl font-heading font-bold">STEINZ</span>
              </div>
              <p className="text-gray-400 text-sm">Cultivate Intelligence. Navigate Risk. Grow Without Fear.</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <div className="space-y-2 text-gray-400 text-sm">
                <div><Link href="/dashboard">Dashboard</Link></div>
                <div>Markets</div>
                <div>Security</div>
                <div>DNA Analyzer</div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Resources</h4>
              <div className="space-y-2 text-gray-400 text-sm">
                <div>Whitepaper</div>
                <div>Docs</div>
                <div>API</div>
                <div>Blog</div>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-4">Community</h4>
              <div className="space-y-2 text-gray-400 text-sm">
                <div>Twitter</div>
                <div>Telegram</div>
                <div>Discord</div>
              </div>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm border-t border-white/10 pt-8">
            &copy; 2025 STEINZ Labs. Built on Ethereum & Solana.
          </div>
        </div>
      </footer>
    </div>
  );
}
