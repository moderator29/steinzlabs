'use client';

import Link from 'next/link';
import BackButton from '@/components/ui/BackButton';
import {
  Shield, Brain, Zap, BarChart3, Users, Target, CheckCircle,
  AlertTriangle, Layers, FileText, Repeat, Star, Lock, Eye, EyeOff,
  Sparkles, Globe, Wallet, KeyRound, ShieldCheck, Cpu, Database, Network,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Layout primitives                                                  */
/* ------------------------------------------------------------------ */

function WpSection({
  id, n, title, kicker, children,
}: { id: string; n: string; title: string; kicker?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-20 scroll-mt-24 pb-20 border-b border-white/[0.05] last:border-0 last:mb-0 last:pb-0">
      <div className="mb-8">
        {kicker && (
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#4D6BFF] font-semibold mb-2">{kicker}</div>
        )}
        <div className="flex items-baseline gap-4">
          <span className="text-5xl sm:text-6xl font-black text-white/[0.05] font-mono select-none leading-none">{n}</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{title}</h2>
        </div>
      </div>
      <div className="space-y-5 text-[15px] text-gray-400 leading-[1.75]">{children}</div>
    </section>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-bold text-white mt-10 mb-4 tracking-tight">{children}</h3>;
}

function Callout({
  color, icon: Icon, title, children,
}: { color: string; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 my-6" style={{ background: color + '10', border: '1px solid ' + color + '30' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-semibold text-white">{title}</span>
      </div>
      <div className="text-[13px] text-gray-300 leading-[1.7]">{children}</div>
    </div>
  );
}

function FeatureGrid({
  items,
}: { items: { icon: React.ElementType; color: string; title: string; desc: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
      {items.map(({ icon: Icon, color, title, desc }) => (
        <div key={title} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '20' }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <div className="text-sm font-semibold text-white mb-1">{title}</div>
            <div className="text-[13px] text-gray-500 leading-[1.7]">{desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={{ background: color + '18', color, border: '1px solid ' + color + '35' }}
    >
      {children}
    </span>
  );
}

function StatList({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
      {items.map((i) => (
        <div key={i.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <dt className="text-[11px] uppercase tracking-wide text-gray-500">{i.label}</dt>
          <dd className="text-lg font-bold text-white mt-1">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/*  Table of Contents                                                  */
/* ------------------------------------------------------------------ */

const TOC = [
  { n: '01', label: 'Overview',                     id: 'overview' },
  { n: '02', label: 'The Problem',                  id: 'problem' },
  { n: '03', label: 'Platform Architecture',        id: 'architecture' },
  { n: '04', label: 'Intelligence Layer',           id: 'intelligence' },
  { n: '05', label: 'Security — Our Full Stack',    id: 'security' },
  { n: '06', label: 'Trading Suite',                id: 'trading' },
  { n: '07', label: 'Whales & Smart Money',         id: 'whales' },
  { n: '08', label: 'Non-Custodial Wallet',         id: 'wallet' },
  { n: '09', label: 'Your Privacy, Our View',       id: 'privacy' },
  { n: '10', label: 'Telegram Bot',                 id: 'telegram' },
  { n: '11', label: 'Pricing & Tiers',              id: 'pricing' },
  { n: '12', label: 'Why Naka Delivers More Value', id: 'value' },
  { n: '13', label: 'Coming Soon',                  id: 'coming-soon' },
  { n: '14', label: 'Company & Legal',              id: 'company' },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen bg-[#080C18] text-white">
      {/* Ambient animated gradient orbs — subtle depth in the background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute top-[10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.25]"
             style={{ background: 'radial-gradient(circle, #4D6BFF 0%, transparent 70%)', animation: 'wpOrb 22s ease-in-out infinite' }} />
        <div className="absolute bottom-[5%] right-[-10%] w-[700px] h-[700px] rounded-full blur-[150px] opacity-[0.2]"
             style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)', animation: 'wpOrb 26s ease-in-out infinite reverse' }} />
      </div>
      {/* Keyframes for ambient + hero icons */}
      <style jsx global>{`
        @keyframes wpFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-5px); }
        }
        @keyframes wpOrb {
          0%, 100% { transform: translate(0,0) scale(1); }
          33%      { transform: translate(60px,-40px) scale(1.1); }
          66%      { transform: translate(-40px, 30px) scale(0.95); }
        }
      `}</style>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#080C18]/98 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton href="/" label="Back" />
            <span className="hidden sm:block w-px h-4 bg-white/[0.08]" />
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#0A1EFF]" />
              <span className="text-sm font-semibold">Naka Labs Whitepaper</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/docs" className="hidden sm:flex text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 border border-white/[0.08] rounded-lg">
              Docs
            </Link>
            <Link href="/dashboard" className="text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
              Open App
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 lg:py-20 lg:flex lg:gap-16">
        {/* TOC - Desktop */}
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-[0.15em] mb-4">Contents</div>
            <nav className="space-y-0.5">
              {TOC.map(t => (
                <a key={t.id} href={`#${t.id}`}
                   className="flex items-center gap-3 py-1.5 px-2 rounded-lg text-[12.5px] text-gray-500 hover:text-white hover:bg-white/[0.04] transition-all">
                  <span className="font-mono text-gray-700 w-5 text-[11px]">{t.n}</span>
                  {t.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 max-w-3xl">
          {/* Hero */}
          <div className="mb-16 pb-12 border-b border-white/[0.06]">
            <div className="flex flex-wrap gap-2 mb-6">
              <div className="inline-flex items-center gap-2 bg-[#0A1EFF]/10 border border-[#0A1EFF]/25 rounded-full px-3 py-1 text-xs text-[#4D6BFF] font-semibold">
                <FileText className="w-3 h-3" /> v1.0 · 2026
              </div>
              <div className="inline-flex items-center gap-2 bg-[#F59E0B]/10 border border-[#F59E0B]/25 rounded-full px-3 py-1 text-xs text-[#F59E0B] font-semibold">
                <Sparkles className="w-3 h-3" /> MVP release
              </div>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight mb-6">
              Naka Labs<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4D6BFF] via-[#8B5CF6] to-[#10B981]">
                On-chain intelligence, reimagined.
              </span>
            </h1>
            <p className="text-gray-400 text-[17px] sm:text-lg leading-[1.75] max-w-2xl">
              A unified intelligence, security and trading workspace for anyone who takes crypto seriously. Built for people who want the same data professional funds use — without the five-figure subscription, without giving up custody, and without the jargon.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <a href="#overview" className="inline-flex items-center gap-2 text-sm bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-5 py-3 rounded-xl font-semibold transition-colors">
                Start reading
              </a>
              <Link href="/docs" className="inline-flex items-center gap-2 text-sm bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-gray-300 px-5 py-3 rounded-xl font-semibold transition-colors">
                Product Docs
              </Link>
            </div>

            {/* Floating 3D icon strip — lightweight visual signal of the four layers */}
            <div className="mt-10 flex flex-wrap gap-5 items-center">
              {[
                { Icon: Brain,       color: '#4D6BFF', label: 'Intelligence' },
                { Icon: ShieldCheck, color: '#10B981', label: 'Security'     },
                { Icon: Repeat,      color: '#F59E0B', label: 'Execution'    },
                { Icon: BarChart3,   color: '#8B5CF6', label: 'Analytics'    },
              ].map((it, i) => (
                <div key={it.label} className="flex items-center gap-2.5 group" style={{ animation: `wpFloat 5s ease-in-out ${i * 0.3}s infinite` }}>
                  <div className="relative w-11 h-11" style={{ perspective: 600 }}>
                    <div className="absolute inset-0 rounded-xl blur-lg opacity-40 group-hover:opacity-70 transition-opacity"
                         style={{ background: it.color, transform: 'translateZ(-20px) translateY(6px) scale(0.9)' }} />
                    <div className="absolute inset-0 rounded-xl border backdrop-blur-sm"
                         style={{
                           background: `linear-gradient(145deg, ${it.color}25, ${it.color}08)`,
                           borderColor: it.color + '45',
                           transform: 'rotateX(14deg) rotateY(-6deg)',
                         }} />
                    <div className="absolute inset-0 flex items-center justify-center"
                         style={{ transform: 'translateZ(14px) rotateX(14deg) rotateY(-6deg)' }}>
                      <it.Icon className="w-5 h-5" style={{ color: it.color, filter: `drop-shadow(0 4px 12px ${it.color}70)` }} />
                    </div>
                    <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl pointer-events-none"
                         style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18), transparent)', transform: 'rotateX(14deg) rotateY(-6deg)' }} />
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.15em] text-white/45 font-semibold">{it.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile TOC */}
          <div className="lg:hidden mb-12 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Contents</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {TOC.map(t => (
                <a key={t.id} href={`#${t.id}`} className="text-[12.5px] text-gray-500 hover:text-white transition-colors flex items-center gap-2">
                  <span className="font-mono text-gray-700 text-[11px]">{t.n}</span>{t.label}
                </a>
              ))}
            </div>
          </div>

          {/* 01 — Overview */}
          <WpSection id="overview" n="01" title="Overview" kicker="Start here">
            <p>
              Naka Labs is an on-chain intelligence platform built around a single idea: retail users should have access to the same quality of information, the same execution tooling, and the same security guarantees as professional trading desks — in a clean, browser-based product they can understand in minutes.
            </p>
            <p>
              The platform brings four things together in one place:
            </p>
            <FeatureGrid items={[
              { icon: Brain,    color: '#0A1EFF', title: 'Intelligence',  desc: 'A real-time signal stream, an AI agent with live on-chain tools, and behavioural fingerprints for any wallet on any chain we support.' },
              { icon: Shield,   color: '#10B981', title: 'Security',      desc: 'Every token gets a Trust Score. Every swap gets a pre-flight simulation. Every approval, URL and signature gets checked — automatically.' },
              { icon: Repeat,   color: '#F59E0B', title: 'Execution',     desc: 'Multi-chain swaps routed through best-price liquidity. A sniper engine that won’t fire on honeypots. Copy-trade tooling built on verified on-chain P&L.' },
              { icon: BarChart3,color: '#8B5CF6', title: 'Analytics',     desc: 'Portfolio tracking, smart-money convergence, whale flow, network metrics and research — all using the same live data feed.' },
            ]} />
            <p>
              This whitepaper is long on purpose. Every feature is explained. Every security claim is backed by where and how it’s applied. Every promise we can’t yet keep is labelled <Pill color="#F59E0B">Coming soon</Pill> rather than quietly implied.
            </p>
            <Callout color="#F59E0B" icon={Sparkles} title="This is our MVP">
              What you see today is the first public release. The core features are live and in daily use. A significant pipeline of upgrades — mobile apps, DAO governance, deeper automation, new chains — is in active development. Section 13 is the only place where we list them, and we don’t attach hard dates we can’t keep.
            </Callout>
          </WpSection>

          {/* 02 — Problem */}
          <WpSection id="problem" n="02" title="The Problem" kicker="Why this exists">
            <p>
              Crypto markets remain one of the most information-asymmetric environments on the internet. Funds, market makers, and protocol insiders have real-time on-chain feeds, private dashboards, and automated alerts. Retail participants — the people the industry keeps claiming it serves — have fragmented tools, stale data, and walls of jargon between them and the numbers that actually matter.
            </p>
            <StatList items={[
              { label: 'Lost to crypto scams annually', value: '$4.6B+' },
              { label: 'Retail traders net-unprofitable', value: '~78%' },
              { label: 'Tools most retail users juggle',  value: '5–10'  },
              { label: 'Cost of a pro analytics stack',   value: '$20k+/yr' },
            ]} />
            <p>
              The result: retail consistently buys what institutions are selling, interacts with malicious contracts they cannot audit, and misses smart-money signals that front-run most major moves by hours or days.
            </p>
            <p>
              Existing solutions are either siloed (a scanner here, a portfolio tracker there), technical (read-the-docs-or-good-luck), or built for institutions at institutional prices. Naka Labs collapses the entire stack into one interface — and keeps pricing in the $0–$15 range where it belongs.
            </p>
          </WpSection>

          {/* 03 — Architecture */}
          <WpSection id="architecture" n="03" title="Platform Architecture" kicker="How it all fits together">
            <p>
              Naka Labs is organised into four layers that share a single real-time data pipeline. You never have to think about which layer you’re in — the product decides — but the shape matters because it’s why the number you see in the Context Feed is the same number VTX reasons over and the same number the swap engine quotes against. One source of truth, everywhere.
            </p>
            <FeatureGrid items={[
              { icon: Layers,    color: '#0A1EFF', title: 'Intelligence Layer', desc: 'Context Feed, VTX AI Agent, DNA Analyzer, Wallet Intelligence, Bubble Map, On-Chain Trends.' },
              { icon: ShieldCheck, color: '#10B981', title: 'Security Layer',  desc: 'Trust Score, Shadow Guardian, Contract Analyzer, Domain Shield, Signature Insight, Approval Manager, Risk Scanner.' },
              { icon: Repeat,    color: '#F59E0B', title: 'Execution Layer',   desc: 'Multi-chain Swap, VTX built-in swap, Sniper Bot, Whale Copy-Trading, Alerts & automation hooks.' },
              { icon: BarChart3, color: '#8B5CF6', title: 'Analytics Layer',   desc: 'Portfolio Tracker, Research, Whale Tracker, Smart Money, Network Graph, Archive.' },
            ]} />
            <H3>Data sources</H3>
            <p>
              Naka Labs pulls from a deliberately wide set of first-class data providers so no single source is a point of failure. Live market data flows through CoinGecko. EVM chain data runs through Alchemy; Solana through Helius. Token security checks are powered by GoPlus (more in section 05). Liquidity, trending and early-launch signals come from DexScreener and Birdeye. Social and attention data is supplemented by LunarCrush. AI reasoning runs on Anthropic Claude via its tool-use API.
            </p>
            <p>
              Every inbound API is wrapped with timeouts, retries, and fallbacks. If CoinGecko is rate-limited, we degrade gracefully instead of blanking the UI. If a cache miss happens, we serve stale data with a short TTL rather than hang the page. Users don’t see the plumbing — but the plumbing is why the experience stays snappy even when a vendor has a bad day.
            </p>
            <Callout color="#8B5CF6" icon={Cpu} title="Runtime">
              Built on Next.js 14 and deployed on Vercel’s edge. Database + auth on Supabase with Row-Level Security on every table. Client-side state is hydrated from server props; real-time streams use SSE. The whole thing runs in a browser — no installs, no extensions beyond the wallets you already have.
            </Callout>
          </WpSection>

          {/* 04 — Intelligence */}
          <WpSection id="intelligence" n="04" title="Intelligence Layer" kicker="What the platform sees for you">
            <p>
              The intelligence layer is the cognitive core. It processes on-chain events, classifies them, scores them, and surfaces only the ones that matter to you — filtered by the wallets you watch, the chains you care about, and the tokens in your portfolio.
            </p>

            <H3>Context Feed</H3>
            <p>
              A real-time stream of classified on-chain signals: <span className="text-[#10B981] font-semibold">BULLISH</span>, <span className="text-[#F59E0B] font-semibold">HYPE</span>, <span className="text-[#EF4444] font-semibold">BEAR</span>, or <span className="text-gray-300 font-semibold">NEUTRAL</span>. Each event carries a Trust Score from 0–100 and a verifiable on-chain link. The feed is personalised to your watched wallets and chains, and streamed via Server-Sent Events so signals appear within seconds of the on-chain transaction.
            </p>
            <p>
              The feed is powered by four parallel sources: live CoinGecko market data (top gainers, trending, new listings, large-cap movements), Alchemy and Solana RPC streams for whale transfers, DexScreener for liquidity and pump-fun tokens, and Birdeye for Solana momentum. A composite scorer combines recency, trust, USD size, pump-fun penalty, and whale boost into a single sort order — no fake "trending" padding.
            </p>

            <H3>VTX AI Agent</H3>
            <p>
              VTX is a Claude-powered assistant with direct tool access to live on-chain APIs. You ask in plain English, it reasons with real data. Common flows include: "What is this wallet’s recent activity", "Audit this contract for me", "What are smart money wallets buying right now", "Swap 0.1 ETH for USDC with low slippage".
            </p>
            <p>
              VTX has 30+ slash commands (see docs) covering token lookup, wallet analysis, security scans, charts, whale feeds, trending, news and direct swap execution. Responses can render an inline <strong className="text-white">TokenCard</strong> (price, market cap, 7d chart, buy button) or an actionable <strong className="text-white">SwapCard</strong> (route, price impact, review-before-confirm) right inside the chat.
            </p>

            <H3>DNA Analyzer</H3>
            <p>
              A complete behavioural fingerprint for any wallet on a supported chain. The analyzer processes every historical trade and produces: win rate, total realised P&L, average hold time, best and worst trades, an archetype classification, and an Alpha Score representing overall decision quality.
            </p>
            <p>
              Archetypes detected: <Pill color="#F59E0B">Diamond Hands</Pill> <Pill color="#0A1EFF">Scalper</Pill> <Pill color="#EF4444">Degen</Pill> <Pill color="#8B5CF6">Whale Follower</Pill> <Pill color="#10B981">Holder</Pill> <Pill color="#9CA3AF">New Wallet</Pill>.
            </p>

            <H3>Bubble Map</H3>
            <p>
              A force-directed graph of any token’s holders and their relationships. Nodes scale by holding size. The central token node colours green or red based on its 24-hour move. Three view modes — Token Holders, Wallet Network, Cluster View — let you spot coordinated holdings, insider clusters, and wallets tagged as exchanges, whales, scammers or team.
            </p>

            <H3>Wallet Intelligence</H3>
            <p>
              Drop any address in. Get holdings, USD values, transaction history, concentration by chain, security flags on risky holdings, and an AI summary of the wallet’s style. Works on Ethereum, Solana, Base, Arbitrum, Polygon, BNB, Avalanche, and more.
            </p>

            <H3>On-Chain Trends</H3>
            <p>
              Monitors DeFi TVL, stablecoin flows, gas trends, active addresses, and cross-chain capital migration. 14-point sparklines with 24h / 7d deltas. Alerts fire automatically when a tracked metric moves more than 10% in 24 hours.
            </p>
          </WpSection>

          {/* 05 — Security */}
          <WpSection id="security" n="05" title="Security — Our Full Stack" kicker="Why you can trust us">
            <p>
              Security is not a feature in Naka Labs. It is the default operating mode. Every token interaction is scanned before execution. Every approval is monitored. Every domain is checked. Every signature request is decoded. Users do not have to remember to run the checks — the platform runs them automatically, every time.
            </p>

            <Callout color="#10B981" icon={ShieldCheck} title="How our security stack actually works">
              We combine our own on-chain analysis with <strong className="text-white">GoPlus Security</strong> — one of the most widely-used token and contract security engines in crypto. GoPlus is our <em>third-party</em> audit backbone; our scoring, routing and pre-flight simulations sit <em>on top of it</em>. If GoPlus flags a contract, we block the interaction before it reaches your wallet. If we have additional signals GoPlus doesn’t (e.g. cluster analysis, whale dump detection) we add them. The result is defence-in-depth.
            </Callout>

            <H3>Token Trust Score (0–100)</H3>
            <p>
              A single number that tells you, at a glance, whether a token is worth engaging with. Calculated from six on-chain factors and a GoPlus contract audit: contract verification status, liquidity lock duration, top-10 holder concentration, buy/sell tax presence, ownership renouncement, and a live honeypot simulation.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-5">
              {[
                { range: '80–100', label: 'Safe',      color: '#10B981' },
                { range: '50–79',  label: 'Caution',   color: '#F59E0B' },
                { range: '20–49',  label: 'High risk', color: '#EF4444' },
                { range: '0–19',   label: 'Avoid',     color: '#7F1D1D' },
              ].map(t => (
                <div key={t.range} className="text-center p-3 rounded-xl" style={{ background: t.color + '12', border: '1px solid ' + t.color + '30' }}>
                  <div className="text-sm font-bold" style={{ color: t.color }}>{t.range}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{t.label}</div>
                </div>
              ))}
            </div>

            <H3>Where GoPlus is applied</H3>
            <p>GoPlus runs automatically — you never have to invoke it — in every one of the following places:</p>
            <div className="space-y-2 my-5">
              {[
                { icon: Repeat, label: 'Swap engine', desc: 'Before a swap quote is executed, we run GoPlus on the destination token. Honeypots, taxes above threshold, blacklists, or unverified contracts abort the swap.' },
                { icon: Target, label: 'Sniper Bot',  desc: 'New launches are put through a 5-layer safety gate that uses GoPlus as one of the layers. Auto-buy will not fire on a contract that fails honeypot + liquidity + holder checks.' },
                { icon: Brain,  label: 'VTX Agent',   desc: 'When you ask VTX about a token, the response is grounded in a GoPlus pull. You get a plain-English summary of risks, not just a price quote.' },
                { icon: Layers, label: 'Context Feed',desc: 'High-trust events weight higher in the feed. Tokens flagged by GoPlus receive warning treatment or are hidden depending on severity.' },
                { icon: Eye,    label: 'Bubble Map',  desc: 'Holder graph integrates GoPlus flags — wallets tagged as scammers or blacklisted are coloured and labelled in the graph.' },
              ].map(i => (
                <div key={i.label} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <div className="w-7 h-7 rounded-lg bg-[#10B981]/15 flex items-center justify-center flex-shrink-0">
                    <i.icon className="w-3.5 h-3.5 text-[#10B981]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{i.label}</div>
                    <div className="text-[13px] text-gray-400 mt-1">{i.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <H3>Shadow Guardian — pre-trade simulation</H3>
            <p>
              Before every trade executes, Shadow Guardian simulates the transaction on-chain. If the token contract prevents selling — the defining property of a honeypot — the trade is blocked and the user is warned. This simulation runs in under 200ms and costs nothing. Shadow Guardian catches sophisticated scams where a token technically passes surface checks but reverts on sell.
            </p>

            <H3>Contract Analyzer</H3>
            <p>
              Powered by VTX AI, the Contract Analyzer decodes any smart contract’s bytecode and produces a plain-English summary. It flags dangerous functions: mint, pause, blacklist, fee manipulation, proxy upgrades, backdoor withdrawals. Useful before you interact with a new contract, approve spending, or provide liquidity.
            </p>

            <H3>Domain Shield</H3>
            <p>
              Phishing is the single largest vector for crypto theft. Domain Shield cross-references URLs against known scam databases, checks domain registration age, SSL validity, WHOIS history, and string similarity to legitimate sites. If a domain looks suspicious, you’re warned before you interact with it.
            </p>

            <H3>Signature Insight</H3>
            <p>
              Decodes wallet signature requests into readable English. "Approve unlimited USDC to 0x7c3..." becomes "This will let an unknown contract spend any amount of your USDC, forever." Signature Insight is especially valuable for EIP-712 permit signatures, where the cost of a mistake is total drain of the affected token.
            </p>

            <H3>Approval Manager</H3>
            <p>
              A unified view of every token approval your wallet has outstanding, across every chain we support. Revoke approvals in one click. Surface the high-risk ones automatically — unlimited approvals, approvals to unverified contracts, approvals older than 30 days.
            </p>

            <H3>Risk Scanner</H3>
            <p>
              A whole-wallet health check. Scans your wallet for risky holdings, dangerous approvals, exposure to compromised contracts, and concentration risk. Produces a single risk score and a prioritised list of suggested cleanup actions.
            </p>

            <H3>Infrastructure-level security</H3>
            <p>Underneath the feature-level tools, the platform itself runs on hardened infrastructure:</p>
            <FeatureGrid items={[
              { icon: Lock,      color: '#10B981', title: 'Row-Level Security', desc: 'Every Supabase table enforces RLS. Users can only read and write rows they own. Admin routes use a separate service-role key that never reaches the browser.' },
              { icon: KeyRound,  color: '#0A1EFF', title: 'JWT verification',    desc: 'Middleware verifies Supabase JWTs on every protected route. Cookies are httpOnly, secure, SameSite=lax. PKCE flow for auth.' },
              { icon: ShieldCheck, color: '#F59E0B', title: 'Bot & abuse',       desc: 'Cloudflare Turnstile gates signup and login. Rate limits on every sensitive endpoint. Sentry for error tracking, PostHog for anomaly detection.' },
              { icon: Database,  color: '#8B5CF6', title: 'Wallet encryption',  desc: 'Internal wallet keys encrypted client-side with AES-256-GCM + PBKDF2 (100k rounds) before ever touching our servers.' },
            ]} />
            <Callout color="#EF4444" icon={AlertTriangle} title="What security cannot do">
              All of the above reduces risk. None of it eliminates it. Smart contracts can be exploited post-audit. Centralised wallets can be compromised at the provider. Users can lose seed phrases. Use security tools as a floor, not a ceiling, and never invest more than you can afford to lose.
            </Callout>
          </WpSection>

          {/* 06 — Trading */}
          <WpSection id="trading" n="06" title="Trading Suite" kicker="Act on what you see">
            <p>
              Every trading tool in Naka Labs is designed around a single principle: no trade executes without a pre-flight safety check. The UI layer is optimised for speed; the safety layer is non-negotiable.
            </p>

            <H3>Multi-Chain Swap Engine</H3>
            <p>
              Powered by Jupiter (Solana) and 0x Protocol (EVM). Routes each trade across all available DEX liquidity to find the best execution price. Supports Ethereum, Base, Arbitrum, Polygon, BNB, Avalanche, and Solana. Trust Score and GoPlus check run automatically on the destination token. The user sees a review-before-confirm modal with rate, price impact (green/yellow/orange/red), slippage, minimum received, fee, and route before the transaction signs.
            </p>

            <H3>VTX Built-in Swap</H3>
            <p>
              Ask VTX "swap 0.5 ETH for USDC" in plain English. VTX detects the intent, pulls a live quote, and renders an inline SwapCard in the chat. The card is a full review screen — tap Execute to sign, or keep typing and VTX keeps reasoning. No context switch between "analysis" and "action".
            </p>

            <H3>Sniper Bot <Pill color="#F59E0B">Max plan</Pill></H3>
            <p>
              Monitors new token launches in real time and — when the user’s criteria match — executes a configured buy. The 5-layer safety protocol runs before every auto-buy: honeypot simulation, tax threshold, liquidity lock check, ownership renouncement, top-holder concentration. Failed checks abort the transaction automatically. A server-side kill switch lets the user (or platform admin) stop all active snipes in a single call.
            </p>
            <p>
              <Pill color="#F59E0B">Coming soon</Pill> Full mempool listening for pre-mint detection, cross-chain sniper config sharing, and stop-loss / take-profit automation on sniper positions.
            </p>

            <H3>Copy Trading</H3>
            <p>
              Mirror the on-chain activity of any tracked whale. Configure a copy size (absolute or percentage of the source), a maximum per-trade cap, and optional safety filters (skip tokens below a Trust Score threshold). Copies execute when the source wallet buys; users retain control over exits.
            </p>
            <p>Tier mapping: <Pill color="#0A1EFF">Alerts-only</Pill> <Pill color="#10B981">Pro — one-click copy</Pill> <Pill color="#F59E0B">Max — auto-copy</Pill>.</p>

            <H3>Alerts</H3>
            <p>
              Price alerts, whale-activity alerts, security alerts (token flagged, approval expired, risky domain clicked), and portfolio alerts (position up/down x%). Delivery channels: in-app notifications, email, and Telegram bot. Tier caps on alert count apply.
            </p>

            <H3>Advanced order types <Pill color="#F59E0B">Coming soon</Pill></H3>
            <p>
              Limit orders, dollar-cost-averaging, trailing stops, bracket orders, and scaled entries are in active development. The Trading Suite page in-app shows a clean "coming soon" state with an email waitlist for early access.
            </p>
          </WpSection>

          {/* 07 — Whales */}
          <WpSection id="whales" n="07" title="Whales & Smart Money" kicker="Where the money actually moves">
            <p>
              Understanding what professional capital is doing is one of the strongest edges available on-chain. Naka Labs tracks 1,000+ high-performance wallets across 10 chains in real time, classifies them by behaviour, and surfaces their moves as they happen.
            </p>

            <H3>Smart Money Classification</H3>
            <p>
              Wallets are continuously scored on win rate, risk-adjusted P&L, consistency of performance, and trade timing relative to price moves. Top performers are classified as Smart Money and added to the tracked pool. Classification is dynamic — wallets can enter or exit the pool as their performance changes. No static list, no cherry-picking.
            </p>

            <H3>Convergence Signal</H3>
            <p>
              When two or more Smart Money wallets buy the same token within a configurable time window, the platform emits a Convergence Signal. Historically these precede significant price moves in the same direction. Set an alert to trigger on any convergence event across your followed chains.
            </p>

            <H3>Whale Tracker</H3>
            <p>
              Whales are classified into four tiers by 7-day volume: <Pill color="#EF4444">MEGA $10M+</Pill> <Pill color="#F59E0B">LARGE $1M–$10M</Pill> <Pill color="#0A1EFF">MID $100K–$1M</Pill> <Pill color="#6B7280">SMALL</Pill>. The Live Feed tab streams their transactions in real time. My Whale Tracker lets you watchlist specific whales and act on their activity directly.
            </p>

            <H3>Wallet Clusters</H3>
            <p>
              Graph analysis that groups related wallets into clusters by transaction patterns. Useful for spotting coordinated buying, insider groups, wash-trading rings, and whale-satellite structures. Each cluster displays total aggregate holdings and a behavioural summary.
            </p>
          </WpSection>

          {/* 08 — Non-custodial wallet */}
          <WpSection id="wallet" n="08" title="Non-Custodial Wallet" kicker="Your keys, your coins, always">
            <p>
              Naka Labs includes a built-in wallet — but "built-in" does not mean "custodied". At no point does Naka Labs ever see your private keys, your seed phrase, or the decryption password that protects them. This is not a marketing claim; it’s a consequence of how the wallet is designed.
            </p>

            <H3>How the wallet is created</H3>
            <p>
              When you create a wallet, your browser generates a standard BIP-39 mnemonic (12 words) locally. The mnemonic is shown to you exactly once for backup. You’re warned — repeatedly and loudly — to write it down physically and never share it. The mnemonic derives your private keys using standard HD wallet derivation (m/44’/60’/0’/0/0 for EVM, m/44’/501’/0’/0’ for Solana).
            </p>

            <H3>How the wallet is stored</H3>
            <p>
              Your private keys are encrypted in your browser using <strong className="text-white">AES-256-GCM</strong> before they leave your device. The encryption key is derived from a password you set, using <strong className="text-white">PBKDF2 with 100,000 iterations of SHA-256</strong> and a per-wallet random salt. Only the ciphertext — which we cannot decrypt without the password you never send us — is synced to our Supabase <code className="text-[11px] bg-white/5 px-1.5 py-0.5 rounded">user_wallets_v2</code> table (protected by Row-Level Security so only your session can read it).
            </p>

            <H3>How the wallet is used</H3>
            <p>
              When you need to sign a transaction, the ciphertext is pulled from Supabase to your browser, decrypted locally using your password, the transaction is signed in-memory, and the plaintext key is immediately cleared. The signed transaction is broadcast through Alchemy (EVM) or Helius (Solana). We never see the private key. Server logs never contain it. Database backups never contain it.
            </p>

            <Callout color="#10B981" icon={Lock} title="What this means practically">
              If Naka Labs is ever compromised, your funds are not exposed. The attacker would get ciphertext they cannot decrypt without passwords we never stored. If you forget your password, we cannot recover it — which is also why we nag you to back up your seed phrase. Non-custodial means non-custodial.
            </Callout>

            <H3>External wallet support</H3>
            <p>
              If you prefer to keep using MetaMask or Phantom, the entire platform works with those too. Connect from any page, Naka Labs reads your address and transaction history, and every signing request is still surfaced through Signature Insight so you always know what you’re signing.
            </p>

            <H3>Create / Import / Switch</H3>
            <p>
              Users can create multiple wallets, import existing wallets via seed phrase or private key, and switch between them from any page. The switch cascades across Portfolio, VTX, Settings and every place that reads "your wallet". Backup reminders persist on every wallet entry until the seed is confirmed backed up.
            </p>
          </WpSection>

          {/* 09 — Privacy */}
          <WpSection id="privacy" n="09" title="Your Privacy, Our View" kicker="What we see, and what we don't">
            <p>
              The question "what does this platform actually know about me" deserves a direct answer. Here it is, in full, without hedging.
            </p>

            <H3>What Naka Labs sees</H3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
              {[
                { icon: Eye,    label: 'Your email', desc: 'Used for login, password reset, receipts, and alerts you opt into.' },
                { icon: Eye,    label: 'Your wallet addresses', desc: 'Whichever addresses you add to the platform. Public information, same as anything else on-chain.' },
                { icon: Eye,    label: 'Your subscription tier', desc: 'Tracked so feature gates work. Upgrades and cancellations logged.' },
                { icon: Eye,    label: 'Your watchlist / follows', desc: 'Which whales, tokens, and chains you watch. Used to personalise your feed.' },
                { icon: Eye,    label: 'Your chat history (VTX)', desc: 'Your conversations with the VTX Agent are stored so you can revisit them. Can be deleted at any time.' },
                { icon: Eye,    label: 'Aggregate analytics', desc: 'PostHog captures page views, feature usage, and errors in anonymised form.' },
              ].map(i => (
                <div key={i.label} className="flex items-start gap-3 bg-[#10B981]/8 border border-[#10B981]/20 rounded-xl p-4">
                  <i.icon className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">{i.label}</div>
                    <div className="text-[13px] text-gray-400 mt-1">{i.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <H3>What Naka Labs never sees</H3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-5">
              {[
                { icon: EyeOff, label: 'Your seed phrase', desc: 'Generated in your browser, shown once, never transmitted. We have no copy, no backup, no recovery.' },
                { icon: EyeOff, label: 'Your private keys', desc: 'Derived from the seed in your browser. Encrypted locally before sync. Never transmitted in plaintext.' },
                { icon: EyeOff, label: 'Your wallet password', desc: 'The password that decrypts your keys. Used client-side only. Never sent to our servers.' },
                { icon: EyeOff, label: 'Your DMs / private accounts', desc: 'We do not hook into your Telegram, X, Discord or any social account beyond the explicit Telegram bot link.' },
              ].map(i => (
                <div key={i.label} className="flex items-start gap-3 bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-xl p-4">
                  <i.icon className="w-4 h-4 text-[#EF4444] flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-semibold text-white">{i.label}</div>
                    <div className="text-[13px] text-gray-400 mt-1">{i.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <H3>VTX and wallet access — your choice</H3>
            <p>
              By default, VTX only sees data you explicitly paste or query. You can opt-in to letting VTX see your wallet holdings (via the <em>VTX Wallet Access</em> toggle on your Profile), which unlocks personalised answers like "how is my portfolio doing" or "is my exposure to memecoins too high". The toggle is off by default. Flip it only if the personalisation is worth it to you. <Pill color="#F59E0B">Coming soon</Pill>
            </p>

            <H3>Your rights</H3>
            <p>
              You can export your data, request deletion, and cancel your subscription at any time from Settings → Account. We honour GDPR and CCPA requests. Deletion is complete deletion — nothing retained in backups beyond our documented retention window.
            </p>
          </WpSection>

          {/* 10 — Telegram */}
          <WpSection id="telegram" n="10" title="Telegram Bot" kicker="Intelligence where you already are">
            <p>
              The Naka Labs Telegram bot is the same intelligence platform, delivered to the chat app you check anyway. Link your account with a one-time code, then use slash commands directly from Telegram. Tier gates are enforced server-side, so the bot never exposes a feature your plan doesn’t cover.
            </p>
            <H3>How to connect</H3>
            <p>
              Go to <strong className="text-white">Profile → Telegram</strong>, tap <em>Generate code</em>, and you’ll get a 6-digit number valid for 10 minutes. Message <code className="text-[11px] bg-white/5 px-1.5 py-0.5 rounded">/link 123456</code> to <strong className="text-white">@Nakalabsbot</strong>. Done.
            </p>
            <H3>Commands</H3>
            <div className="space-y-2 my-5">
              {[
                { cmd: '/price <symbol>',  tier: 'Free',  desc: 'Live price and 24h change for any token.' },
                { cmd: '/watchlist',       tier: 'Free',  desc: 'Your watched wallets and tokens.' },
                { cmd: '/alerts',          tier: 'Free',  desc: 'List your active alerts.' },
                { cmd: '/vtx <question>',  tier: 'Free',  desc: 'Ask VTX anything — daily limits apply.' },
                { cmd: '/whale <address>', tier: 'Mini+', desc: 'Quick intel on a whale wallet.' },
                { cmd: '/portfolio',       tier: 'Mini+', desc: 'Your holdings across connected wallets.' },
                { cmd: '/copy <whale>',    tier: 'Pro+',  desc: 'Start or manage a copy-trade.' },
                { cmd: '/snipe <token>',   tier: 'Max',   desc: 'Configure or trigger a sniper entry.' },
                { cmd: '/status',          tier: 'Any',   desc: 'Confirm the bot is reachable and your account is linked.' },
                { cmd: '/unlink',          tier: 'Any',   desc: 'Disconnect your Telegram account from your Naka Labs account.' },
              ].map(r => (
                <div key={r.cmd} className="flex items-center justify-between bg-white/[0.02] border border-white/[0.06] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <code className="text-[12px] bg-white/5 px-2 py-1 rounded font-mono text-[#4D6BFF]">{r.cmd}</code>
                    <div className="text-[13px] text-gray-400 truncate">{r.desc}</div>
                  </div>
                  <Pill color={r.tier === 'Max' ? '#F59E0B' : r.tier === 'Pro+' ? '#8B5CF6' : r.tier === 'Mini+' ? '#0A1EFF' : '#10B981'}>{r.tier}</Pill>
                </div>
              ))}
            </div>
            <p>
              <Pill color="#F59E0B">Coming soon</Pill> Outbound event notifications — whale-activity and alert triggers delivered to your Telegram automatically, in addition to commands you initiate.
            </p>
          </WpSection>

          {/* 11 — Pricing */}
          <WpSection id="pricing" n="11" title="Pricing & Tiers" kicker="Clear, honest, cheap">
            <p>Four tiers. No hidden surcharges. Cancel or switch any time.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-6">
              {[
                {
                  name: 'Free', price: '$0', color: '#9CA3AF',
                  bullets: ['25 VTX messages / day', 'Basic wallet intelligence (EVM)', '3 price alerts', 'Standard swap (0.4% fee)', 'Market + charts access', 'Basic security scanner', '1 connected wallet'],
                },
                {
                  name: 'Mini', price: '$5 / mo', color: '#0A1EFF',
                  bullets: ['100 VTX messages / day', 'Full wallet intelligence (all chains)', '10 price alerts', 'Standard swap', 'Whale tracker (view only)', 'DNA Analyzer', '3 connected wallets'],
                },
                {
                  name: 'Pro', price: '$9 / mo', color: '#10B981',
                  bullets: ['Unlimited VTX', 'All features unlocked', '50 price alerts', 'Gasless swaps on EVM', 'One-click copy trading', 'Advanced security tools', 'Wallet clusters', 'Bubble Map', '10 connected wallets'],
                },
                {
                  name: 'Max', price: '$15 / mo', color: '#F59E0B',
                  bullets: ['Everything in Pro', 'Sniper Bot access', 'Real-time sniper alerts', 'Auto-copy trading', 'Unlimited connected wallets', 'Priority support', 'Early access to new features'],
                },
              ].map(t => (
                <div key={t.name} className="rounded-2xl p-5 bg-white/[0.02]" style={{ borderColor: t.color + '30', borderWidth: 1, borderStyle: 'solid' }}>
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="text-lg font-bold text-white">{t.name}</div>
                    <div className="text-sm font-mono" style={{ color: t.color }}>{t.price}</div>
                  </div>
                  <ul className="space-y-1.5">
                    {t.bullets.map(b => (
                      <li key={b} className="flex items-start gap-2 text-[13px] text-gray-400">
                        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: t.color }} />{b}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-gray-500">Payment in crypto. Fiat <Pill color="#F59E0B">Coming soon</Pill>. Enterprise tier (custom limits, white-label, dedicated support) available on request.</p>
          </WpSection>

          {/* 12 — Value */}
          <WpSection id="value" n="12" title="Why Naka Delivers More Value" kicker="Our pitch in plain English">
            <p>
              Everything listed so far exists elsewhere in some form. Where Naka Labs is different is the combination: the same real-time data feeding intelligence, security, execution, and analytics, delivered in a unified product at retail pricing. Specifically:
            </p>
            <div className="space-y-3 my-6">
              {[
                { title: 'One source of truth', desc: 'Feed, VTX, swap quote and risk score all read from the same pipeline. Competing tools stitch disparate APIs; we unified them so the numbers always agree.' },
                { title: 'Security at every entry point', desc: 'GoPlus sits beneath every swap, snipe, VTX query and bubble map — not as a separate tab, but as the default path. You cannot accidentally skip the scan.' },
                { title: 'AI that actually does the work', desc: 'VTX is tool-using Claude with direct on-chain access. It doesn’t just chat — it executes scans, renders token cards, and can complete a swap inside the chat. Not a demo, production.' },
                { title: 'Non-custodial by default', desc: 'We never hold your keys. Competitors that bundle "convenience custody" take control you should never give up.' },
                { title: 'Price', desc: 'Pro is $9/month. The nearest equivalent institutional tools run thousands per seat. We made the bet that breadth of users beats depth of pricing.' },
                { title: 'No vendor lock-in', desc: 'Every insight surfaces on-chain links. Every trade executes through standard DEX aggregators. You can leave and take everything with you — which is the right way to build a platform.' },
              ].map(v => (
                <div key={v.title} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5">
                  <div className="text-sm font-semibold text-white mb-1">{v.title}</div>
                  <div className="text-[13px] text-gray-400 leading-[1.7]">{v.desc}</div>
                </div>
              ))}
            </div>
          </WpSection>

          {/* 13 — Coming soon */}
          <WpSection id="coming-soon" n="13" title="Coming Soon" kicker="What we're building next (no roadmap dates)">
            <p>
              We’re deliberately not publishing timed roadmaps. Crypto punishes teams that promise dates and quietly miss them; we’d rather ship and then tell you. Here’s what’s actively in build:
            </p>
            <div className="space-y-2 my-6">
              {[
                { title: 'Mobile apps (iOS + Android)', desc: 'Full native apps with push notifications, biometric unlock, and a mobile-tuned swap experience.' },
                { title: 'DAO governance v1', desc: 'We’re just starting our governance framework. Early contributors and Max subscribers will get first access to proposals and voting weight. The token and rules are being designed now.' },
                { title: 'Outbound Telegram notifications', desc: 'Whale-activity, alert-triggered and security notifications delivered to your Telegram without opening the app.' },
                { title: 'VTX Wallet Access toggle', desc: 'Opt-in permission for VTX to see your wallet holdings, so it can answer personalised questions like "how is my portfolio doing".' },
                { title: 'Advanced order types', desc: 'Limit orders, DCA, trailing stops, bracket orders, scaled entries.' },
                { title: 'Full sniper mempool listener', desc: 'Pre-mint detection, cross-config sharing, and sniper-position stop-loss / take-profit automation.' },
                { title: 'Support tickets + attachments', desc: 'End-to-end ticket system with attachments, admin replies, status tracking, and Telegram notifications on reply.' },
                { title: 'Dark mode / light mode', desc: 'Full theming across landing and platform.' },
                { title: 'Additional chain support', desc: 'Ton and Sui native integrations at the intelligence + swap layer.' },
                { title: 'Social trading leaderboards', desc: 'Verified-P&L rankings, alpha sharing, and in-platform following. All on-chain-verified.' },
                { title: 'Expanded Launchpad', desc: 'Trust-scored token launches with built-in auditing and early-access gating for NFT holders.' },
                { title: 'NFT (pre-raise fund)', desc: 'A limited pre-raise NFT to support platform build-out. Holders get early access, feature gating and eventual revenue share. Details close to launch.' },
                { title: 'Platform API (public tier)', desc: 'Institutional read-API access for teams building on top of our intelligence pipeline.' },
                { title: 'AI-generated research reports', desc: 'On-demand deep dives from VTX, with citations, on a token, sector or wallet of your choice.' },
              ].map(i => (
                <div key={i.title} className="flex items-start gap-3 bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                  <Pill color="#F59E0B">Coming soon</Pill>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-white">{i.title}</div>
                    <div className="text-[13px] text-gray-400 mt-1 leading-[1.7]">{i.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </WpSection>

          {/* 14 — Company / Legal */}
          <WpSection id="company" n="14" title="Company & Legal" kicker="Who we are, what we promise">
            <H3>Company</H3>
            <p>
              Naka Labs is an early-stage, independent team building what we wish existed when we started trading on-chain ourselves. The product you see today is a genuine MVP — not a beta codeword for "unfinished" — but the foundation for a much larger platform. The roadmap in section 13 is what we are actively building; every feature there exists in design or prototype today.
            </p>
            <p>
              <strong className="text-white">We are registering the company formally, and that process is close to completion.</strong> Once finalised we will publish jurisdiction, registration number, and compliance contacts directly on this page. Until then, the entity operates as an unregistered team and all payments are processed through audited crypto rails. We consider this transparency non-negotiable — you deserve to know whether you’re paying a company or a team.
            </p>

            <H3>Governance <Pill color="#F59E0B">Coming soon</Pill></H3>
            <p>
              A DAO-based governance layer is in early design. Early contributors, Max-tier subscribers and pre-raise NFT holders will form the initial voting pool. Proposal types will cover product priorities, fee structures, and treasury allocations. Full governance rules will ship with the DAO launch and will be published in a separate governance document.
            </p>

            <H3>Disclaimer</H3>
            <p>
              Nothing in this whitepaper is financial, legal, investment, or tax advice. Crypto assets are highly volatile and speculative. The tools and data Naka Labs provides are advisory and educational. No feature — including security scanners, Trust Scores, AI recommendations, or copy trading — guarantees a profitable outcome or the absence of loss. Past performance is not indicative of future results. You are solely responsible for your financial decisions.
            </p>

            <H3>Terms & Privacy</H3>
            <p>
              Usage of the Naka Labs platform is governed by our <Link href="/terms" className="text-[#4D6BFF] hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-[#4D6BFF] hover:underline">Privacy Policy</Link>. By using the platform you acknowledge you have read, understood, and accepted both documents.
            </p>

            <H3>Contact</H3>
            <p>
              General: <a href="mailto:hello@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">hello@nakalabs.xyz</a>. Security disclosures: <a href="mailto:security@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">security@nakalabs.xyz</a>. Press: <a href="mailto:press@nakalabs.xyz" className="text-[#4D6BFF] hover:underline">press@nakalabs.xyz</a>. Please use Signature Insight or a similar tool if anything that claims to be from us asks you to sign a transaction. We will never DM you unprompted.
            </p>
          </WpSection>

          {/* Footer */}
          <div className="pt-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
              <span className="text-xs text-gray-600">&copy; 2026 Naka Labs. All rights reserved.</span>
              <div className="flex items-center gap-4">
                <Link href="/docs"     className="text-xs text-[#0A1EFF] hover:text-[#4D6BFF] transition-colors">Docs</Link>
                <Link href="/terms"    className="text-xs text-gray-400 hover:text-white transition-colors">Terms</Link>
                <Link href="/privacy"  className="text-xs text-gray-400 hover:text-white transition-colors">Privacy</Link>
                <Link href="/dashboard"className="text-xs text-gray-400 hover:text-white transition-colors">Open App</Link>
              </div>
            </div>
            <p className="text-[11px] text-gray-700 mt-5 leading-relaxed">
              This whitepaper is for informational purposes only. Nothing herein constitutes financial, legal, investment, or tax advice. Crypto assets are highly volatile and speculative. Past performance of platform tools does not guarantee future results. Use of Naka Labs is subject to our Terms of Service. Document version 1.0 — last updated April 2026.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
