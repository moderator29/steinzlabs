'use client';

import Link from 'next/link';
import { ArrowLeft, Shield, Brain, Zap, Globe, BarChart3, TrendingUp, Users, Target, CheckCircle, AlertTriangle, ExternalLink, Layers, FileText, BookOpen, Repeat, Fish, Star } from 'lucide-react';

function WpSection({ id, n, title, children }: { id: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-14 scroll-mt-20 pb-14 border-b border-white/[0.05] last:border-0">
      <div className="flex items-baseline gap-3 mb-5">
        <span className="text-4xl font-black text-white/[0.04] font-mono select-none leading-none">{n}</span>
        <h2 className="text-xl sm:text-2xl font-bold text-white">{title}</h2>
      </div>
      <div className="space-y-4 text-sm text-gray-400 leading-relaxed">{children}</div>
    </section>
  );
}

function Callout({ color, icon: Icon, title, children }: { color: string; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 my-4" style={{ background: color + '08', border: '1px solid ' + color + '25' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="text-xs text-gray-400 leading-relaxed">{children}</div>
    </div>
  );
}

function FeatureGrid({ items }: { items: { icon: React.ElementType; color: string; title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
      {items.map(({ icon: Icon, color, title, desc }) => (
        <div key={title} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
            <Icon className="w-3.5 h-3.5" style={{ color }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white mb-0.5">{title}</div>
            <div className="text-xs text-gray-500 leading-relaxed">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

const TOC = [
  { n: '01', label: 'Executive Summary', id: 'summary' },
  { n: '02', label: 'The Problem', id: 'problem' },
  { n: '03', label: 'Vision & Mission', id: 'vision' },
  { n: '04', label: 'Platform Architecture', id: 'architecture' },
  { n: '05', label: 'Intelligence Layer', id: 'intelligence' },
  { n: '06', label: 'Security Layer', id: 'security' },
  { n: '07', label: 'Trading Suite', id: 'trading' },
  { n: '08', label: 'Smart Money & Whales', id: 'smart-money' },
  { n: '09', label: 'Portfolio & Analytics', id: 'portfolio' },
  { n: '10', label: 'Community & Discovery', id: 'community' },
  { n: '11', label: 'Platform Economics', id: 'economics' },
  { n: '12', label: 'Roadmap', id: 'roadmap' },
];

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[#080C18] text-white">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#080C18]/98 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <span className="hidden sm:block w-px h-4 bg-white/[0.08]" />
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0A1EFF]" />
              <span className="text-sm font-semibold">STEINZ LABS Whitepaper</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs" className="hidden sm:flex text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 border border-white/[0.08] rounded-lg">
              Documentation
            </Link>
            <Link href="/dashboard" className="text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
              Open App
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-16 lg:flex lg:gap-14">
        {/* TOC - Desktop */}
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Contents</div>
            <nav className="space-y-1">
              {TOC.map(t => (
                <a key={t.id} href={`#${t.id}`}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs text-gray-500 hover:text-white hover:bg-white/[0.04] transition-all">
                  <span className="font-mono text-gray-700 w-5">{t.n}</span>
                  {t.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 max-w-3xl">
          {/* Hero */}
          <div className="mb-12 pb-10 border-b border-white/[0.06]">
            <div className="inline-flex items-center gap-2 bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 rounded-full px-3 py-1 text-xs text-[#4D6BFF] font-semibold mb-5">
              <FileText className="w-3 h-3" />v1.0 — April 2026
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-4">
              STEINZ LABS<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0A1EFF] to-[#10B981]">Whitepaper</span>
            </h1>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed max-w-2xl">
              The institutional-grade on-chain intelligence operating system that puts professional-level crypto research, security, and trading tools in every user's hands.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              <a href="#summary" className="inline-flex items-center gap-2 text-sm bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-4 py-2.5 rounded-xl font-semibold transition-colors">
                Read whitepaper
              </a>
              <Link href="/docs" className="inline-flex items-center gap-2 text-sm bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-300 px-4 py-2.5 rounded-xl font-semibold transition-colors">
                View Docs
              </Link>
            </div>
          </div>

          {/* Mobile TOC */}
          <div className="lg:hidden mb-10 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
            <div className="text-xs font-semibold text-gray-400 mb-3">Table of Contents</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {TOC.map(t => (
                <a key={t.id} href={`#${t.id}`} className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1.5">
                  <span className="font-mono text-gray-700">{t.n}</span>{t.label}
                </a>
              ))}
            </div>
          </div>

          {/* Section 01 — Executive Summary */}
          <WpSection id="summary" n="01" title="Executive Summary">
            <p>STEINZ LABS is an on-chain intelligence operating system built for the next generation of crypto participants. It aggregates real-time data across 12+ blockchains, applies Claude AI to surface actionable signals, and delivers a unified experience covering intelligence, security, trading, and portfolio management — all in a browser-based platform requiring no installation.</p>
            <p>The platform has four core tenets: <strong className="text-white">see more</strong> (intelligence layer with real-time on-chain data), <strong className="text-white">trade safer</strong> (security layer with pre-trade scanning), <strong className="text-white">act faster</strong> (execution layer with DEX aggregation and automation), and <strong className="text-white">understand deeper</strong> (analytics layer with AI-driven behavioral analysis).</p>
            <Callout color="#0A1EFF" icon={Zap} title="Platform by the numbers">
              12+ supported blockchains · 1,000+ whale wallets tracked · 15+ data source integrations · Sub-second intelligence streaming · 0-100 Trust Score on every token · 6 trading tools · 6 security tools
            </Callout>
          </WpSection>

          {/* Section 02 — The Problem */}
          <WpSection id="problem" n="02" title="The Problem">
            <p>Crypto markets are among the most information-asymmetric environments in the world. Institutional players, protocol insiders, and professional traders have access to real-time on-chain data, automated alerting, and AI-driven analysis. Retail participants do not.</p>
            <p>The consequences are predictable: retail investors routinely buy what institutions are selling, interact with fraudulent contracts they cannot audit, and miss the smart money signals that precede major price moves by hours or days.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
              {[
                { n: '$4.6B+', label: 'Lost to crypto scams annually', color: '#EF4444' },
                { n: '78%', label: 'of retail traders lose money', color: '#F59E0B' },
                { n: '100x', label: 'data advantage held by institutions', color: '#0A1EFF' },
              ].map(s => (
                <div key={s.label} className="text-center bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-2xl font-black mb-1" style={{ color: s.color }}>{s.n}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
            <p>Existing tools are either siloed (a security scanner here, a portfolio tracker there) or require technical expertise to operate. No single platform has unified professional-grade intelligence, security, and trading in an accessible interface. Until now.</p>
          </WpSection>

          {/* Section 03 — Vision */}
          <WpSection id="vision" n="03" title="Vision & Mission">
            <p><strong className="text-white">Vision:</strong> A world where every crypto participant — regardless of capital size or technical expertise — has access to the same quality of on-chain intelligence that professional funds use to make decisions.</p>
            <p><strong className="text-white">Mission:</strong> Build the most comprehensive, accurate, and accessible on-chain intelligence platform — and continuously raise the bar for what crypto analytics tools can do.</p>
            <Callout color="#10B981" icon={Target} title="Core principles">
              <div className="space-y-2 mt-1">
                {['Real-time first — every data point is live, never stale', 'Security by default — every interaction is scanned before execution', 'AI-native — VTX AI is a first-class citizen, not an add-on', 'Cross-chain — no single blockchain is privileged over others', 'Accessible — institutional power in a consumer interface'].map(p => (
                  <div key={p} className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-[#10B981] flex-shrink-0 mt-0.5" /><span>{p}</span></div>
                ))}
              </div>
            </Callout>
          </WpSection>

          {/* Section 04 — Architecture */}
          <WpSection id="architecture" n="04" title="Platform Architecture">
            <p>STEINZ LABS is built on Next.js 15 with server-side rendering, real-time Server-Sent Event streams, and a TypeScript-first codebase. The platform integrates 15+ external blockchain data APIs through a unified abstraction layer, enabling chain-agnostic intelligence with consistent data quality.</p>
            <FeatureGrid items={[
              { icon: Layers, color: '#0A1EFF', title: 'Intelligence Layer', desc: 'VTX AI engine, Context Feed, Trading DNA, Wallet Classification, Trend Detection' },
              { icon: Shield, color: '#10B981', title: 'Security Layer', desc: 'Trust Score engine, Shadow Guardian, Contract Analyzer, Domain Shield, Approval Manager' },
              { icon: Repeat, color: '#F59E0B', title: 'Execution Layer', desc: 'DEX aggregation (Jupiter + 0x Protocol), Copy Trading, Sniper Bot, Limit Orders' },
              { icon: BarChart3, color: '#8B5CF6', title: 'Analytics Layer', desc: 'Portfolio Tracker, Prediction Markets, Research Lab, Whale Tracker, Smart Money' },
            ]} />
            <p>Data sources include Birdeye, Alchemy, DexScreener, DeFiLlama, GoPlus, Arkham Intelligence, CoinGecko, LunarCrush, Jupiter, and 0x Protocol. Each source is abstracted behind a typed service layer with automatic fallback, rate limit management, and response caching.</p>
          </WpSection>

          {/* Section 05 — Intelligence */}
          <WpSection id="intelligence" n="05" title="Intelligence Layer">
            <p>The intelligence layer is the cognitive core of STEINZ LABS. It processes thousands of on-chain events per minute and applies AI to surface only the highest-signal information.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Context Feed</h3>
            <p>A real-time stream of classified on-chain signals — BULLISH, HYPE, BEAR, or NEUTRAL — each carrying a Trust Score from 0–100. The feed is personalized to the user's watched wallets and chains, powered by SSE streaming for true real-time delivery.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">VTX AI Engine</h3>
            <p>Powered by Anthropic's Claude and given direct tool access to live on-chain data APIs. Users ask questions in plain English and receive answers grounded in real-time blockchain data. VTX AI can analyze wallets, audit contracts, explain transactions, identify trends, and validate investment theses — all without the user needing to understand the underlying data infrastructure.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Trading DNA Analyzer</h3>
            <p>A complete behavioral fingerprint for any wallet. The analyzer processes every trade a wallet has made and produces: win rate, total P&L, average holding time, best/worst trade, trading archetype classification, and an Alpha Score representing overall quality of decision-making.</p>
            <p>Archetypes: <span className="text-[#F59E0B]">Diamond Hands</span>, <span className="text-[#0A1EFF]">Scalper</span>, <span className="text-[#EF4444]">Degen</span>, <span className="text-[#8B5CF6]">Whale Follower</span>, <span className="text-[#10B981]">Holder</span>, New Wallet, Inactive.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">On-Chain Trends</h3>
            <p>Monitors DeFi TVL, stablecoin flows, gas trends, active addresses, and cross-chain capital migration. Uses 14-point sparklines with 24h/7d delta tracking to identify momentum before it appears in token prices. Alerts fire automatically when a tracked metric moves more than 10% in 24 hours.</p>
          </WpSection>

          {/* Section 06 — Security */}
          <WpSection id="security" n="06" title="Security Layer">
            <p>Security is not a feature in STEINZ LABS — it is the default operating mode. Every token interaction is scanned before execution. Every approval is monitored. Every domain is checked in real time.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Token Trust Score (0–100)</h3>
            <p>Calculated from six on-chain factors: contract verification status, liquidity lock duration, top-10 holder concentration, buy/sell tax presence, ownership renouncement, and a live honeypot simulation. The result is a single number that tells you, at a glance, whether a token is worth engaging with.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
              {[{ range: '80–100', label: 'Safe', color: '#10B981' }, { range: '50–79', label: 'Caution', color: '#F59E0B' }, { range: '20–49', label: 'High risk', color: '#EF4444' }, { range: '0–19', label: 'Avoid', color: '#7F1D1D' }].map(t => (
                <div key={t.range} className="text-center p-3 rounded-xl" style={{ background: t.color + '12', border: '1px solid ' + t.color + '30' }}>
                  <div className="text-sm font-bold" style={{ color: t.color }}>{t.range}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{t.label}</div>
                </div>
              ))}
            </div>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Shadow Guardian</h3>
            <p>Before every trade executes, Shadow Guardian simulates the transaction on-chain. If the token's contract prevents selling — the hallmark of a honeypot — the trade is blocked and the user is warned. This simulation runs in under 200ms and has no cost to the user.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Contract Analyzer</h3>
            <p>Powered by VTX AI, the Contract Analyzer decodes any smart contract's bytecode and produces a plain-English summary of what the contract does. It flags dangerous functions: mint, pause, blacklist, fee manipulation, proxy upgrades, and backdoor withdrawal mechanisms.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Domain Shield</h3>
            <p>Phishing attacks are responsible for a significant portion of crypto theft. Domain Shield cross-references URLs against known scam databases, checks domain registration age, SSL validity, and pattern similarity to known legitimate sites — warning users before they interact with fraudulent URLs.</p>
            <Callout color="#EF4444" icon={AlertTriangle} title="Security disclaimer">
              All security tools provide advisory information based on on-chain data. They do not guarantee protection from loss. STEINZ LABS is not responsible for trading decisions made using platform data. Always conduct independent research.
            </Callout>
          </WpSection>

          {/* Section 07 — Trading */}
          <WpSection id="trading" n="07" title="Trading Suite">
            <p>STEINZ LABS provides a complete set of trading tools — from simple swaps to fully automated execution. Every tool is designed with security-first principles: no trade executes without a pre-flight safety check.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Multi-Chain Swap Engine</h3>
            <p>Powered by Jupiter (Solana) and 0x Protocol (EVM), the swap engine routes each trade across all available DEX liquidity to find the best execution price. Users swap directly from the STEINZ LABS interface without leaving the platform. Each swap is preceded by a Trust Score check on the destination token.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Copy Trading</h3>
            <p>Copy trading lets users mirror the on-chain activity of any tracked wallet. Users configure a copy size (absolute or percentage), a maximum per-trade cap, and optional safety filters (skip tokens below a Trust Score threshold). Copies execute automatically when the source wallet buys; users retain control over exits.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Sniper Bot</h3>
            <p>The Sniper Bot monitors new token launches in real time across DexScreener and Pump.fun. When a new token is detected, it runs a 5-layer safety protocol (honeypot, tax, liquidity lock, ownership, holder analysis) before executing the configured buy. Failed safety checks abort the transaction automatically.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Trading Suite</h3>
            <p>Advanced order types including limit orders (buy/sell at a target price) and stop-loss automation. Full position tracking with real-time P&L, entry price, current value, and ROI. Cross-chain portfolio view showing all open positions in one place.</p>
          </WpSection>

          {/* Section 08 — Smart Money */}
          <WpSection id="smart-money" n="08" title="Smart Money & Whale Tracking">
            <p>Understanding what professional capital is doing is one of the most powerful edges available in on-chain markets. STEINZ LABS tracks 1,000+ high-performance wallets across 10 chains in real time, classifies them by behavior, and surfaces their moves as they happen.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Smart Money Classification</h3>
            <p>Wallets are continuously scored on win rate, risk-adjusted P&L, consistency of performance, and trade timing relative to price moves. The top performers are classified as Smart Money and added to the tracked pool. Classification is dynamic — wallets can enter or exit the pool as their performance changes.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Convergence Signal</h3>
            <p>When two or more Smart Money wallets buy the same token within a configurable time window, the platform emits a Convergence Signal. Historically, convergence signals have preceded significant price moves in the same direction. Users can set alerts to trigger on any convergence event across their followed chains.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Whale Tracker</h3>
            <p>Whale wallets are classified into four tiers: MEGA ($10M+ 7-day volume), LARGE ($1M–$10M), MID ($100K–$1M), and SMALL. The Live Feed tab streams their transactions in real time via SSE. From any whale profile, users can initiate a Copy Trade with a built-in 15-second confirmation window to review the whale's track record.</p>
          </WpSection>

          {/* Section 09 — Portfolio */}
          <WpSection id="portfolio" n="09" title="Portfolio & Analytics">
            <p>Portfolio management in STEINZ LABS is designed to be fully non-custodial and read-only. You add wallet addresses — never private keys — and the platform builds a unified financial picture across every chain.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Portfolio Tracker</h3>
            <p>Tracks holdings, USD values, cost basis, and P&L across all connected wallets. Historical charting shows portfolio value over time. Chain breakdown view shows concentration risk by network. Token history logs every position ever held by tracked wallets.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Prediction Markets</h3>
            <p>On-chain prediction markets for crypto events — price targets, protocol milestones, governance outcomes. Users stake tokens on YES or NO outcomes. Markets resolve on-chain using verifiable data sources. Winners receive proportional payouts based on total pool size and position weight.</p>
            <h3 className="text-base font-bold text-white mt-6 mb-3">Research Lab</h3>
            <p>In-depth analysis of protocols, sectors, and on-chain narratives. STEINZ LABS publishes original research, and Pro subscribers can submit analyses for community review and publication. Research is cited with on-chain data links so every claim is verifiable.</p>
          </WpSection>

          {/* Section 10 — Community */}
          <WpSection id="community" n="10" title="Community & Discovery">
            <p>STEINZ LABS extends beyond individual analysis to community-level intelligence — connecting builders, traders, and researchers in a verifiable, on-chain-first ecosystem.</p>
            <FeatureGrid items={[
              { icon: Users, color: '#0A1EFF', title: 'Social Trading', desc: 'Share alpha, post trade ideas with verified on-chain P&L backing them, and follow the analysts with the best track records.' },
              { icon: Star, color: '#F59E0B', title: 'Project Discovery', desc: 'A curated pipeline of early-stage projects vetted by the STEINZ LABS team and community. Each project carries a Trust Score and on-chain diligence report.' },
              { icon: Zap, color: '#10B981', title: 'Launchpad', desc: 'A trust-scored token launch platform. Projects launching through STEINZ LABS undergo security auditing before listing, giving early participants a meaningful safety edge.' },
              { icon: Brain, color: '#8B5CF6', title: 'Builder Network', desc: 'A directory of active on-chain builders with verifiable project histories. Builder Fund grants are available to qualifying projects building on supported chains.' },
            ]} />
          </WpSection>

          {/* Section 11 — Economics */}
          <WpSection id="economics" n="11" title="Platform Economics">
            <p>STEINZ LABS generates revenue through three mechanisms, all designed to align platform incentives with user success.</p>
            <div className="space-y-3 my-5">
              {[
                { title: 'Subscription tiers', color: '#0A1EFF', desc: 'Free (limited access), Pro (full feature access, higher limits), and Enterprise (custom limits, white-label options, dedicated support). Subscription revenue funds continuous platform development.' },
                { title: 'DEX swap fees', color: '#10B981', desc: 'A small fee on swaps executed through the STEINZ LABS interface. This fee is disclosed upfront and included in the displayed quote. No hidden charges.' },
                { title: 'Launchpad participation', color: '#F59E0B', desc: 'Projects launching through the STEINZ LABS Launchpad pay a listing fee that covers security auditing and community promotion. No ongoing royalties.' },
              ].map(r => (
                <div key={r.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="text-sm font-semibold mb-1" style={{ color: r.color }}>{r.title}</div>
                  <div className="text-xs text-gray-400 leading-relaxed">{r.desc}</div>
                </div>
              ))}
            </div>
          </WpSection>

          {/* Section 12 — Roadmap */}
          <WpSection id="roadmap" n="12" title="Roadmap">
            <p>STEINZ LABS is actively developed. The following roadmap reflects planned capability expansions — timelines are targets, not guarantees.</p>
            <div className="space-y-3 my-5">
              {[
                { phase: 'Current', color: '#10B981', items: ['Multi-chain intelligence across 10+ chains', 'VTX AI Engine', 'Security Center (6 tools)', 'DEX swap aggregation', 'Whale & Smart Money Tracking', 'Push notifications'] },
                { phase: 'Near-term', color: '#0A1EFF', items: ['Mobile app (iOS + Android)', 'Advanced copy trading automation', 'Social trading leaderboards with verified P&L', 'Additional chain support (Ton, Sui native)', 'MEV protection integration', 'Expanded Launchpad'] },
                { phase: 'Long-term', color: '#8B5CF6', items: ['On-chain derivatives intelligence', 'Cross-chain arbitrage detection', 'Institutional API access tier', 'AI-generated research reports on demand', 'Decentralized prediction market infrastructure', 'STEINZ token utility layer'] },
              ].map(p => (
                <div key={p.phase} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4" style={{ borderColor: p.color + '25' }}>
                  <div className="text-sm font-bold mb-3" style={{ color: p.color }}>{p.phase}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {p.items.map(item => (
                      <div key={item} className="flex items-start gap-2 text-xs text-gray-400">
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: p.color }} />{item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </WpSection>

          {/* Footer */}
          <div className="pt-8 border-t border-white/[0.06]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-xs text-gray-600">&copy; 2026 STEINZ LABS. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <Link href="/docs" className="text-xs text-[#0A1EFF] hover:text-[#4D6BFF] transition-colors">Documentation</Link>
                <Link href="/dashboard" className="text-xs text-gray-400 hover:text-white transition-colors">Open App</Link>
              </div>
            </div>
            <p className="text-xs text-gray-700 mt-4 leading-relaxed">
              This whitepaper is for informational purposes only. Nothing herein constitutes financial advice, investment advice, or a solicitation to invest. Crypto assets are highly volatile and speculative. Past performance of platform tools does not guarantee future results. Use of STEINZ LABS is subject to our Terms of Service.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
