'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ArrowRight, Zap, Brain, TrendingUp, Shield, Target, Users, Search, BarChart3, Globe, Cpu, Eye, Layers, Lock, Activity, Send } from 'lucide-react';
import Link from 'next/link';
import PriceTicker from '@/components/PriceTicker';
import NakaLogo from '@/components/NakaLogo';
import ThemeToggle from '@/components/ThemeToggle';

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);
  const [scrolled, setScrolled] = useState(false);

  const faqs = [
    {
      q: "What is NAKA?",
      a: "NAKA is the world's first AI-powered on-chain intelligence platform. We analyze blockchain data across Ethereum, Solana, BSC, and Polygon to surface whale moves, rug pulls, and alpha signals BEFORE they hit Twitter."
    },
    {
      q: "How does NAKA make money?",
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
      a: "Our AI doesn't predict prices - it analyzes on-chain patterns and whale behavior to surface signals. We're in private beta and building accuracy data from real resolved predictions. Always DYOR."
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

  const [stats, setStats] = useState([
    { value: "12+", label: "Chains Supported" },
    { value: "7", label: "AI Tools" },
    { value: "24/7", label: "Live Monitoring" },
    { value: "100%", label: "Non-Custodial" },
  ]);

  useEffect(() => {
    fetch('/api/platform-stats')
      .then(res => res.json())
      .then(data => {
        setStats([
          { value: `${data.chains}+`, label: "Chains Supported" },
          { value: "7", label: "AI Tools" },
          { value: "24/7", label: "Live Monitoring" },
          { value: "100%", label: "Non-Custodial" },
        ]);
      })
      .catch(() => {});
  }, []);

  const howItWorks = [
    { step: "01", icon: Globe, title: "Connect", desc: "Link your wallet or enter any address. We read public data only." },
    { step: "02", icon: Cpu, title: "Analyze", desc: "Our AI processes millions of on-chain signals in real-time." },
    { step: "03", icon: Eye, title: "Discover", desc: "Get actionable intelligence: whale moves, risks, and alpha." },
    { step: "04", icon: Layers, title: "Act", desc: "Execute trades, track portfolios, and stay ahead of the market." },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white overflow-x-hidden font-sans">

      <nav className={`fixed top-0 w-full z-50 border-b transition-all duration-300 ${scrolled ? 'bg-[#0B0D14]/95 backdrop-blur-md border-white/[0.06]' : 'bg-transparent border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NakaLogo size={28} />
            <span className="text-base font-semibold tracking-tight">NAKA</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#9CA3AF]">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#security" className="hover:text-white transition-colors">Security</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/dashboard">
              <button className="bg-white text-[#0B0D14] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-white/90 transition-colors">
                Launch App
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 flex items-center justify-center">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#161822] border border-white/[0.06] rounded-full mb-8">
            <div className="w-1.5 h-1.5 bg-[#00D4AA] rounded-full"></div>
            <span className="text-[#9CA3AF] text-xs font-medium">Now Live on 12+ Chains</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-[1.1] tracking-tight">
            On-chain intelligence{' '}
            <br className="hidden md:block" />
            for the{' '}
            <span className="text-[#00D4AA]">open economy</span>
          </h1>

          <p className="text-base md:text-lg text-[#9CA3AF] mb-10 leading-relaxed max-w-xl mx-auto">
            Real-time AI analysis. Multi-chain intelligence. Security built in. Never get rugged again.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-16">
            <Link href="/dashboard">
              <button className="bg-white text-[#0B0D14] px-6 py-3 rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors flex items-center justify-center gap-2">
                Launch Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/whitepaper">
              <button className="px-6 py-3 rounded-lg font-semibold text-sm border border-white/[0.12] text-white hover:bg-white/[0.04] transition-colors">
                Read Whitepaper
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#12141D] border border-white/[0.06] rounded-lg p-4 text-center">
                <div className="text-xl md:text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-[11px] text-[#9CA3AF] uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-4 px-4 border-y border-white/[0.06] bg-[#12141D]/40">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-[#9CA3AF] text-[10px] uppercase tracking-[0.2em] mb-3">Supported Chains</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-[#9CA3AF]">
            {chains.map((chain) => (
              <span key={chain} className="hover:text-white transition-colors cursor-default">{chain}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="py-4 px-4">
        <div className="max-w-4xl mx-auto flex justify-center">
          <PriceTicker />
        </div>
      </section>

      <section id="features" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#00D4AA] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Platform Features</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Everything You Need,{' '}
              <span className="text-[#00D4AA]">Nothing You Don&apos;t</span>
            </h2>
            <p className="text-[#9CA3AF] text-sm max-w-md mx-auto">Eight integrated tools working together to give you an unfair advantage in crypto.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-[#161822] border border-white/[0.06] rounded-xl p-5 group hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#00D4AA]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-[#00D4AA]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold mb-1 text-white">{feature.title}</h3>
                      <p className="text-[#9CA3AF] text-xs leading-relaxed">{feature.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#6366F1] text-xs font-semibold uppercase tracking-[0.2em] mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              From Zero to Alpha{' '}
              <span className="text-[#6366F1]">in Four Steps</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {howItWorks.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="bg-[#161822] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.12] transition-colors relative"
                >
                  <div className="absolute top-3 right-3 text-2xl font-bold text-white/[0.04] select-none">{item.step}</div>
                  <div className="w-10 h-10 bg-[#6366F1]/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#6366F1]" />
                  </div>
                  <h3 className="text-sm font-semibold mb-2 text-white">{item.title}</h3>
                  <p className="text-[#9CA3AF] text-xs leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="security" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#00D4AA] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Security</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              Built for <span className="text-[#00D4AA]">Trust</span>
            </h2>
            <p className="text-[#9CA3AF] text-sm max-w-md mx-auto">Your security is our foundation. Non-custodial by design.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#161822] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.12] transition-colors">
              <div className="w-10 h-10 bg-[#00D4AA]/10 rounded-lg flex items-center justify-center mb-4">
                <Lock className="w-5 h-5 text-[#00D4AA]" />
              </div>
              <h3 className="text-sm font-semibold mb-2 text-white">Non-Custodial</h3>
              <p className="text-[#9CA3AF] text-xs leading-relaxed">We never store your private keys. Your funds stay in your wallet at all times.</p>
            </div>
            <div className="bg-[#161822] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.12] transition-colors">
              <div className="w-10 h-10 bg-[#6366F1]/10 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-5 h-5 text-[#6366F1]" />
              </div>
              <h3 className="text-sm font-semibold mb-2 text-white">AI Rug Detection</h3>
              <p className="text-[#9CA3AF] text-xs leading-relaxed">Real-time contract scanning identifies honeypots, rug pulls, and malicious code.</p>
            </div>
            <div className="bg-[#161822] border border-white/[0.06] rounded-xl p-6 hover:border-white/[0.12] transition-colors">
              <div className="w-10 h-10 bg-[#00D4AA]/10 rounded-lg flex items-center justify-center mb-4">
                <Activity className="w-5 h-5 text-[#00D4AA]" />
              </div>
              <h3 className="text-sm font-semibold mb-2 text-white">MEV Protection</h3>
              <p className="text-[#9CA3AF] text-xs leading-relaxed">Built-in safeguards against front-running and sandwich attacks on your transactions.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[#6366F1] text-xs font-semibold uppercase tracking-[0.2em] mb-3">FAQ</p>
            <h2 className="text-3xl md:text-4xl font-bold">
              Common <span className="text-[#6366F1]">Questions</span>
            </h2>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-[#161822] border border-white/[0.06] rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-sm font-medium text-white pr-4">{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-[#9CA3AF] flex-shrink-0 transition-transform duration-200 ${openFAQ === i ? 'rotate-180' : ''}`} />
                </button>
                {openFAQ === i && (
                  <div className="px-4 pb-4">
                    <p className="text-[#9CA3AF] text-xs leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to get <span className="text-[#00D4AA]">started</span>?
          </h2>
          <p className="text-[#9CA3AF] text-sm mb-8 max-w-md mx-auto">
            Join thousands of traders using NAKA to stay ahead of the market. Free to start, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard">
              <button className="bg-white text-[#0B0D14] px-6 py-3 rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors flex items-center justify-center gap-2">
                Launch Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/whitepaper">
              <button className="px-6 py-3 rounded-lg font-semibold text-sm border border-white/[0.12] text-white hover:bg-white/[0.04] transition-colors">
                Read Whitepaper
              </button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <NakaLogo size={24} />
                <span className="text-sm font-semibold">NAKA</span>
              </div>
              <p className="text-[#9CA3AF] text-xs leading-relaxed">On-chain intelligence for the open economy.</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">Product</h4>
              <div className="space-y-2">
                <Link href="/dashboard" className="block text-xs text-[#9CA3AF] hover:text-white transition-colors">Dashboard</Link>
                <a href="#features" className="block text-xs text-[#9CA3AF] hover:text-white transition-colors">Features</a>
                <Link href="/dashboard/pricing" className="block text-xs text-[#9CA3AF] hover:text-white transition-colors">Pricing</Link>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">Resources</h4>
              <div className="space-y-2">
                <Link href="/whitepaper" className="block text-xs text-[#9CA3AF] hover:text-white transition-colors">Whitepaper</Link>
                <a href="#faq" className="block text-xs text-[#9CA3AF] hover:text-white transition-colors">FAQ</a>
                <a href="#security" className="block text-xs text-[#9CA3AF] hover:text-white transition-colors">Security</a>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">Legal</h4>
              <div className="space-y-2">
                <span className="block text-xs text-[#9CA3AF]">Terms of Service</span>
                <span className="block text-xs text-[#9CA3AF]">Privacy Policy</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[#9CA3AF] text-xs">&copy; {new Date().getFullYear()} NAKA. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
