'use client';

import { useState } from 'react';
import { ChevronDown, Check, ArrowRight, Play } from 'lucide-react';

export default function LandingPage() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(0);

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

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan to-purple rounded-lg"></div>
              <span className="text-xl font-heading font-bold">STEINZ</span>
            </div>
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="hover:text-cyan transition-colors">Features</a>
              <a href="#pricing" className="hover:text-cyan transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-cyan transition-colors">FAQ</a>
            </div>
            <button className="btn-gradient px-6 py-2 rounded-lg font-semibold">
              Launch App
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6">
            On-Chain Intelligence,
            <br />
            <span className="gradient-text">Redefined.</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
            The only platform that shows you what Smart Money sees before everyone else.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button className="btn-gradient px-8 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2">
              Start Analyzing Free <ArrowRight className="w-5 h-5" />
            </button>
            <button className="glass px-8 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-2 hover:bg-white/10 transition-colors">
              <Play className="w-5 h-5" /> Watch Demo
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span>Real-time whale tracking</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span>AI-powered risk scoring</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-success" />
              <span>Zero false signals</span>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 border-y border-white/10">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="text-center">
            <div className="text-4xl font-heading font-bold text-cyan mb-2">$847M</div>
            <div className="text-gray-400">Whale Moves Tracked</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-heading font-bold text-cyan mb-2">12,347</div>
            <div className="text-gray-400">Active Users</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-heading font-bold text-cyan mb-2">89%</div>
            <div className="text-gray-400">Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-heading font-bold text-cyan mb-2">1.2M</div>
            <div className="text-gray-400">Signals Processed</div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-center mb-4">
            Everything You Want to Know
          </h2>
          <p className="text-gray-400 text-center mb-12">Get answers to common questions</p>
          
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className={`glass rounded-xl overflow-hidden transition-all duration-300 ${
                  openFAQ === index ? 'bg-gradient-to-r from-cyan/10 to-purple/10' : ''
                }`}
              >
                <button
                  onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                  className="w-full px-6 py-5 flex justify-between items-center text-left hover:bg-white/5 transition-colors"
                >
                  <span className="font-semibold text-lg pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-cyan transition-transform flex-shrink-0 ${
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

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gradient-to-b from-transparent to-cyan/5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-heading font-bold text-center mb-12">
            Choose Your Edge
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Free Tier */}
            <div className="glass rounded-2xl p-8 card-hover">
              <h3 className="text-2xl font-heading font-bold mb-2">Free</h3>
              <div className="text-4xl font-bold mb-6">$0</div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>20 events/day Context Feed</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>1 wallet tracking</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>Basic security scanner</span>
                </li>
              </ul>
              <button className="w-full glass px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
                Get Started
              </button>
            </div>

            {/* Pro Tier */}
            <div className="glass rounded-2xl p-8 card-hover border-2 border-cyan relative">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan to-purple px-4 py-1 rounded-full text-sm font-semibold">
                POPULAR
              </div>
              <h3 className="text-2xl font-heading font-bold mb-2">Pro</h3>
              <div className="text-4xl font-bold mb-6">
                $4<span className="text-lg text-gray-400">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>Unlimited Context Feed</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>Unlimited wallets</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>10 Trading DNA reports/month</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>Whale alerts</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>VTX AI (50 questions/day)</span>
                </li>
              </ul>
              <button className="w-full btn-gradient px-6 py-3 rounded-lg font-semibold">
                Upgrade to Pro
              </button>
            </div>

            {/* Premium Tier */}
            <div className="glass rounded-2xl p-8 card-hover">
              <h3 className="text-2xl font-heading font-bold mb-2">Premium</h3>
              <div className="text-4xl font-bold mb-6">
                $15<span className="text-lg text-gray-400">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>Predictions Market</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>Copy Trading access</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>VTX AI unlimited</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-success mt-1 flex-shrink-0" />
                  <span>API access</span>
                </li>
              </ul>
              <button className="w-full glass px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors">
                Go Premium
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-heading font-bold mb-6">
            Ready to See What You've Been Missing?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join 12,000+ traders already ahead.
          </p>
          <button className="btn-gradient px-8 py-4 rounded-lg font-semibold text-lg inline-flex items-center gap-2">
            Start Analyzing Free - No Card <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="max-w-6xl mx-auto text-center text-gray-400">
          <div className="mb-4">
            <span className="text-2xl font-heading font-bold text-white">STEINZ</span>
          </div>
          <p className="mb-4">On-chain intelligence for everyone.</p>
          <p className="text-sm">© 2025 STEINZ Labs. Built on Solana & Ethereum.</p>
        </div>
      </footer>
    </div>
  );
}
