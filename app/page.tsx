'use client';

import { useState } from 'react';
import { ChevronDown, ArrowRight, Zap, Brain, TrendingUp, Shield, Target, Users, Search, BarChart3, Compass } from 'lucide-react';
import Link from 'next/link';

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
    { icon: Zap, title: "AI Context Feed", desc: "Real-time on-chain narrative intelligence curated by AI" },
    { icon: Brain, title: "VTX AI Engine", desc: "AI-powered assistant for markets, risk, and signals" },
    { icon: TrendingUp, title: "Trading DNA Analyzer", desc: "Your complete on-chain trading profile decoded" },
    { icon: Shield, title: "Security Shield", desc: "AI rug detector, scam scanner, MEV protection" },
    { icon: Target, title: "Builder Funding Portal", desc: "Verified builders meet capital with milestone releases" },
    { icon: Users, title: "Multi-Chain Swap", desc: "Trade across 12+ chains with built-in safety" },
    { icon: Search, title: "Project Discovery", desc: "Find verified Web3 projects and talent" },
    { icon: BarChart3, title: "Portfolio Tracker", desc: "Real-time P&L and performance scoring" },
  ];

  const chains = ["Solana", "Ethereum", "BNB", "Polygon", "Avalanche", "Base", "Arbitrum", "Optimism", "Fantom", "Bitcoin", "Tron"];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white overflow-x-hidden">
      <section className="pt-16 pb-12 px-4 relative overflow-hidden hero-mesh">
        <div className="absolute inset-0 grid-pattern pointer-events-none"></div>
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#00E5FF] rounded-full blur-[120px] animate-pulse-glow"></div>
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-[#7C3AED] rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="max-w-md mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#00E5FF]/10 border border-[#00E5FF]/30 rounded-full mb-8 backdrop-blur-sm animate-fadeInUp">
            <div className="w-2 h-2 bg-[#10B981] rounded-full animate-pulse"></div>
            <span className="text-[#00E5FF] text-sm font-semibold">Now Live on 12+ Chains</span>
          </div>

          <h1 className="text-4xl font-heading font-bold mb-6 leading-tight animate-fadeInUp stagger-1">
            The Intelligence Layer the On-Chain Economy{' '}
            <span className="bg-gradient-to-r from-[#00E5FF] via-[#7C3AED] to-[#00E5FF] bg-clip-text text-transparent animate-textGradient bg-[length:200%_200%]">
              Has Been Missing
            </span>
          </h1>

          <p className="text-base text-gray-300 mb-8 leading-relaxed px-2 animate-fadeInUp stagger-2">
            Real-time AI analysis. Multi-chain intelligence. Security built in. Never get rugged again.
          </p>

          <div className="flex flex-col gap-3 max-w-xs mx-auto mb-6 animate-fadeInUp stagger-3">
            <Link href="/dashboard">
              <button className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-6 py-3.5 rounded-xl font-semibold text-base hover:scale-105 transition-transform shimmer-btn">
                Launch Dashboard
              </button>
            </Link>
            <a href="#whitepaper">
              <button className="w-full glass px-6 py-3.5 rounded-xl font-semibold text-base hover:bg-white/10 transition-colors border border-white/20 gradient-border">
                Read Whitepaper
              </button>
            </a>
          </div>
        </div>
      </section>

      <section className="px-4 pb-6">
        <div className="max-w-md mx-auto">
          <div className="flex gap-6 overflow-x-auto scrollbar-hide py-2">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-gray-400 text-sm font-semibold">BTC</span>
              <span className="text-white font-mono text-sm">Loading...</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-gray-400 text-sm font-semibold">ETH</span>
              <span className="text-white font-mono text-sm">Loading...</span>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-gray-400 text-sm font-semibold">SOL</span>
              <span className="text-white font-mono text-sm">Loading...</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 px-4 border-y border-white/10 bg-[#111827]/30">
        <div className="max-w-md mx-auto">
          <p className="text-center text-gray-400 text-xs uppercase tracking-widest mb-4">Supported Chains</p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-gray-300">
            {chains.map((chain) => (
              <span key={chain} className="hover:text-[#00E5FF] transition-colors cursor-default">{chain}</span>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-12 px-4 relative">
        <div className="absolute inset-0 dot-pattern pointer-events-none"></div>
        <div className="max-w-md mx-auto relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-heading font-bold mb-2">
              Everything You Need,<br />
              <span className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent">
                Nothing You Don&apos;t
              </span>
            </h2>
          </div>

          <div className="space-y-3">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className={`glass rounded-xl p-5 border border-white/10 hover:border-[#00E5FF]/30 transition-all glow-card card-hover animate-slide-up stagger-${Math.min(i + 1, 8)}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#00E5FF]" />
                    </div>
                    <div>
                      <h3 className="text-base font-heading font-bold mb-1">{feature.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-md mx-auto">
          <div className="glass rounded-2xl p-6 border border-[#00E5FF]/20 bg-gradient-to-b from-[#00E5FF]/5 to-transparent text-center relative overflow-hidden">
            <div className="absolute inset-0 grid-pattern pointer-events-none opacity-50"></div>
            <div className="relative z-10">
              <div className="w-14 h-14 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-xl flex items-center justify-center mx-auto mb-4 animate-float">
                <Shield className="w-7 h-7 text-[#00E5FF]" />
              </div>
              <h2 className="text-2xl font-heading font-bold mb-2">
                Every Token. Every Wallet. Every Transaction.
              </h2>
              <p className="text-lg font-heading font-bold bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] bg-clip-text text-transparent mb-6">
                Scored Before You Touch It.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Zap, title: "AI Risk Engine", desc: "0-100 safety scoring on every asset" },
                  { icon: Search, title: "Contract Analyzer", desc: "Instant smart contract audit verification" },
                  { icon: Shield, title: "Rug Detection", desc: "Serial scammer identification & alerts" },
                  { icon: Compass, title: "Phishing Detector", desc: "Protect against malicious websites" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="glass rounded-xl p-3 border border-white/10 hover:border-[#00E5FF]/20 transition-all card-hover text-left">
                      <Icon className="w-5 h-5 text-[#00E5FF] mb-2" />
                      <h4 className="font-bold text-xs mb-0.5">{item.title}</h4>
                      <p className="text-gray-400 text-[10px] leading-relaxed">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="whitepaper" className="py-12 px-4 bg-[#111827]/30">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-2xl font-heading font-bold mb-4">
            Read the Whitepaper
          </h2>
          <p className="text-gray-300 mb-6 text-sm leading-relaxed">
            Deep dive into our architecture, AI models, and vision for on-chain intelligence.
          </p>
          <button className="glass px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/10 transition-colors border border-[#00E5FF]/30 gradient-border">
            Download Whitepaper (PDF)
          </button>
        </div>
      </section>

      <section id="faq" className="py-12 px-4">
        <div className="max-w-md mx-auto">
          <h2 className="text-2xl font-heading font-bold text-center mb-2">
            Frequently Asked Questions
          </h2>
          <p className="text-gray-400 text-center mb-8 text-sm">Everything you need to know</p>

          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`glass rounded-xl overflow-hidden transition-all duration-300 border ${
                  openFAQ === index ? 'border-[#00E5FF]/50 bg-gradient-to-r from-[#00E5FF]/5 to-[#7C3AED]/5' : 'border-white/10 hover:border-white/20'
                }`}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full px-4 py-4 flex justify-between items-center text-left hover:bg-white/5 transition-colors"
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
                  <div className="px-4 pb-4 text-gray-300 text-sm leading-relaxed">
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 hero-mesh pointer-events-none"></div>
        <div className="max-w-md mx-auto text-center relative z-10">
          <h2 className="text-2xl font-heading font-bold mb-4">
            Ready to Level Up?
          </h2>
          <p className="text-gray-300 mb-6 text-sm">
            Join the future of on-chain intelligence.
          </p>
          <Link href="/dashboard">
            <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-8 py-3.5 rounded-xl font-semibold text-base inline-flex items-center gap-2 hover:scale-105 transition-transform shimmer-btn">
              Launch Platform <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 px-4 bg-[#111827]/50">
        <div className="max-w-md mx-auto">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center">
              <span className="text-lg font-bold">S</span>
            </div>
            <span className="text-lg font-heading font-bold">STEINZ LABS</span>
          </div>
          <p className="text-gray-400 text-xs mb-6">Cultivate Intelligence. Navigate Risk. Grow Without Fear.</p>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <h4 className="font-bold text-sm mb-2">Product</h4>
              <div className="space-y-1 text-gray-400 text-xs">
                <div><Link href="/dashboard" className="hover:text-[#00E5FF] transition-colors">Dashboard</Link></div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Markets</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Security</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">DNA Analyzer</div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-2">Resources</h4>
              <div className="space-y-1 text-gray-400 text-xs">
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Whitepaper</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Docs</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">API</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Blog</div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-2">Community</h4>
              <div className="space-y-1 text-gray-400 text-xs">
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Twitter</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Telegram</div>
                <div className="hover:text-[#00E5FF] transition-colors cursor-pointer">Discord</div>
              </div>
            </div>
          </div>
          <div className="text-center text-gray-500 text-xs border-t border-white/10 pt-4">
            &copy; 2025 STEINZ Labs. Built on Ethereum & Solana.
          </div>
        </div>
      </footer>
    </div>
  );
}
