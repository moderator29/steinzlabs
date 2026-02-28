'use client';

import { ArrowLeft, ArrowRight, Shield, Brain, Zap, Users, Target, BarChart3, Search, Compass, Globe, Lock, Layers, Cpu, TrendingUp, ExternalLink, CheckCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import ThemeToggle from '@/components/ThemeToggle';

function Section({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-20">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl font-heading font-bold text-[#00E5FF]/20">{number}</span>
        <h2 className="text-2xl md:text-3xl font-heading font-bold">{title}</h2>
      </div>
      <div className="text-gray-400 text-sm leading-relaxed space-y-4">{children}</div>
    </section>
  );
}

function FeatureBox({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] hover:border-[#00E5FF]/20 transition-all group">
      <div className="w-9 h-9 bg-gradient-to-br from-[#00E5FF]/10 to-[#7C3AED]/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
        <Icon className="w-4 h-4 text-[#00E5FF]" />
      </div>
      <h4 className="text-xs font-heading font-bold mb-1 text-white">{title}</h4>
      <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function ComparisonRow({ platform, ai, security, builder, launchpad, multichain, wallet, highlight }: { platform: string; ai: string; security: string; builder: string; launchpad: string; multichain: string; wallet: string; highlight?: boolean }) {
  const cls = highlight ? 'bg-gradient-to-r from-[#00E5FF]/5 to-[#7C3AED]/5 border-[#00E5FF]/20 font-semibold text-white' : 'border-white/5 text-gray-400';
  return (
    <tr className={`border-b ${cls}`}>
      <td className="py-2.5 px-3 text-xs">{platform}</td>
      <td className="py-2.5 px-2 text-xs text-center">{ai}</td>
      <td className="py-2.5 px-2 text-xs text-center">{security}</td>
      <td className="py-2.5 px-2 text-xs text-center">{builder}</td>
      <td className="py-2.5 px-2 text-xs text-center">{launchpad}</td>
      <td className="py-2.5 px-2 text-xs text-center">{multichain}</td>
      <td className="py-2.5 px-2 text-xs text-center">{wallet}</td>
    </tr>
  );
}

export default function WhitepaperPage() {
  const toc = [
    { id: 'executive-summary', label: 'Executive Summary' },
    { id: 'problem', label: 'The Problem We Solve' },
    { id: 'features', label: 'Full Feature Overview' },
    { id: 'architecture', label: 'Core Architecture' },
    { id: 'security', label: 'Security Center' },
    { id: 'swap', label: 'Multi-Chain Swap' },
    { id: 'builder', label: 'Builder Network' },
    { id: 'predictions', label: 'Prediction Markets' },
    { id: 'unique', label: 'Why STEINZ Is Unique' },
    { id: 'business', label: 'Business Model' },
    { id: 'roadmap', label: 'Upcoming Features' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-[#0A0E1A]/90 border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <SteinzLogo size={28} />
            <span className="text-sm font-heading font-bold">STEINZ</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/dashboard">
              <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-3 py-1.5 rounded-lg text-xs font-semibold hover:scale-105 transition-transform">
                Launch App
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4 relative">
        <div className="absolute inset-0 hero-mesh-enhanced pointer-events-none"></div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <p className="text-[#00E5FF] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Complete Platform Overview</p>
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 leading-tight">
            STEINZ LABS
          </h1>
          <p className="text-lg text-gray-400 mb-2 font-heading">The Intelligence Infrastructure Layer for the On-Chain Economy</p>
          <p className="text-sm text-[#00E5FF] italic mb-8">&quot;Cultivate Intelligence. Navigate Risk. Grow Without Fear.&quot;</p>
          <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
            <div className="glass rounded-lg p-3 border border-white/[0.06]">
              <div className="text-lg font-heading font-bold text-[#00E5FF]">12+</div>
              <div className="text-[9px] text-gray-500 uppercase">Chains</div>
            </div>
            <div className="glass rounded-lg p-3 border border-white/[0.06]">
              <div className="text-lg font-heading font-bold text-[#7C3AED]">AI</div>
              <div className="text-[9px] text-gray-500 uppercase">Powered</div>
            </div>
            <div className="glass rounded-lg p-3 border border-white/[0.06]">
              <div className="text-lg font-heading font-bold text-[#10B981]">0-100</div>
              <div className="text-[9px] text-gray-500 uppercase">Trust Score</div>
            </div>
            <div className="glass rounded-lg p-3 border border-white/[0.06]">
              <div className="text-lg font-heading font-bold text-[#F59E0B]">100%</div>
              <div className="text-[9px] text-gray-500 uppercase">Non-Custodial</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-20 flex gap-8">
        <aside className="hidden lg:block w-56 flex-shrink-0">
          <div className="sticky top-20 space-y-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Contents</p>
            {toc.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="block text-xs text-gray-500 hover:text-[#00E5FF] transition-colors py-1 border-l-2 border-transparent hover:border-[#00E5FF]/40 pl-3">
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <Section id="executive-summary" number="01" title="Executive Summary">
            <p>STEINZ Labs is building the most comprehensive intelligence infrastructure layer ever created for the on-chain economy. Not just another analytics dashboard or trading tool &mdash; the complete operating system for Web3 participants: traders, builders, investors, and communities.</p>
            <p>The platform combines real-time on-chain data aggregation, AI-powered analysis, comprehensive security scanning, multi-chain trading, builder reputation systems, milestone-gated funding, native social coordination, and prediction markets &mdash; all unified into a single seamless experience that no other platform in the ecosystem matches.</p>
            <div className="glass rounded-xl p-5 border border-[#00E5FF]/10 bg-gradient-to-b from-[#00E5FF]/[0.03] to-transparent mt-4">
              <p className="text-sm text-gray-300 font-medium">The STEINZ Difference</p>
              <p className="text-xs text-gray-400 mt-2">While other platforms give you data, STEINZ gives you <strong className="text-white">context</strong>. While others show you transactions, STEINZ shows you <strong className="text-white">intent</strong>. While others alert you to risks, STEINZ <strong className="text-white">protects you before you get hurt</strong>. While others charge institutions thousands per month, STEINZ makes that intelligence accessible to every level of participant.</p>
            </div>
          </Section>

          <Section id="problem" number="02" title="The Problem We Solve">
            <p>The modern DeFi participant faces an overwhelming crisis of information. Every day, millions of on-chain events occur across dozens of chains &mdash; yet almost zero contextual signal emerges from this noise.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <h4 className="text-xs font-heading font-bold text-[#EF4444] mb-2">Data Overload Without Context</h4>
                <p className="text-[11px] text-gray-500">Millions of transactions happen daily. Users see raw data but lack the narrative layer that explains what matters and why. A whale moving $10M means nothing without understanding the wallet&apos;s history, timing patterns, and market context.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <h4 className="text-xs font-heading font-bold text-[#F59E0B] mb-2">Fragmented Tooling</h4>
                <p className="text-[11px] text-gray-500">Traders split across 5&ndash;10 different dashboards: charts, on-chain data, portfolio tracking, security checks, social signals. None of these tools talk to each other. Context is lost at every transition.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <h4 className="text-xs font-heading font-bold text-[#EF4444] mb-2">Security Blind Spots</h4>
                <p className="text-[11px] text-gray-500">Rug pulls, honeypots, and phishing attacks cost users billions annually. Existing tools are too slow or require technical expertise. By the time you detect a scam, your funds are already gone.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <h4 className="text-xs font-heading font-bold text-[#7C3AED] mb-2">Builder Discovery Crisis</h4>
                <p className="text-[11px] text-gray-500">Talented builders go undiscovered. Promising projects never find the right team. Capital sits idle while worthy builders struggle to raise. The Web3 ecosystem loses billions in potential value every year.</p>
              </div>
            </div>
          </Section>

          <Section id="features" number="03" title="Full Feature Overview">
            <p>This is what sits inside one platform. One login. One dashboard.</p>
            <h3 className="text-base font-heading font-bold text-white mt-6 mb-3">Live on the Platform</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <FeatureBox icon={Zap} title="Real-Time Context Feed" desc="AI-curated on-chain intelligence stream. Every event tagged BULLISH, HYPE, BEAR, or NEUTRAL with Trust Score." />
              <FeatureBox icon={Brain} title="VTX AI Engine" desc="Ask anything. Get live data-backed answers in seconds. Your personal on-chain analyst powered by Anthropic Claude." />
              <FeatureBox icon={TrendingUp} title="Trading DNA Analyzer" desc="Drop any wallet and decode its complete behavioral and performance profile. Full Alpha Intelligence Report." />
              <FeatureBox icon={Globe} title="Wallet Intelligence" desc="Every active wallet classified: Whales, Smart Money, Retail, Bots, Dormant. Follow any cluster in real time." />
              <FeatureBox icon={Users} title="Smart Money Watchlist" desc="Curated feed of the consistently highest-performing on-chain wallets. Full transaction fingerprints." />
              <FeatureBox icon={Shield} title="Token Safety Scanner" desc="0-100 Trust Score on any contract. Verification, liquidity lock, holder concentration, tax, dev history." />
              <FeatureBox icon={Search} title="Contract Analyzer" desc="Paste any contract. VTX AI reads it and tells you exactly what it does in plain English. No jargon." />
              <FeatureBox icon={AlertTriangle} title="Rug Pull Detector" desc="Full deployer history. Serial rugger flagging. Liquidity removal patterns. Honeypot simulation." />
              <FeatureBox icon={Lock} title="Phishing Detector" desc="Every link checked in real time. Domain age, scam database cross reference, community reports." />
              <FeatureBox icon={Compass} title="Multi-Chain Swap" desc="Trade across 12+ chains inside the intelligence layer. Safety check runs before every swap." />
              <FeatureBox icon={BarChart3} title="Portfolio Tracker" desc="Connect wallet. Auto-sync all holdings, USD values, P&L, 24h change, historical chart. Zero manual input." />
              <FeatureBox icon={Target} title="Prediction Markets" desc="Create and participate in on-chain predictions. Stake positions, earn rewards, build your win rate." />
            </div>

            <h3 className="text-base font-heading font-bold text-white mt-8 mb-3">Coming Soon</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <FeatureBox icon={Layers} title="Full Trading Suite" desc="Spot, limit, DCA orders across multiple DEXs from inside the dashboard." />
              <FeatureBox icon={Users} title="Copy Trading Protocol" desc="Mirror any Smart Money wallet automatically. Set parameters, deploy capital, track in real time." />
              <FeatureBox icon={Cpu} title="STEINZ Earn Layer" desc="Yield optimization on idle assets. AI-managed allocation across protocols. Non-custodial." />
            </div>
          </Section>

          <Section id="architecture" number="04" title="Core Platform Architecture">
            <p>STEINZ is built as a modular intelligence suite where every component is a standalone product, and together they form an ecosystem that no single competitor matches.</p>

            <h3 className="text-base font-heading font-bold text-white mt-6 mb-3">4.1 Context Feed &amp; AI Intelligence</h3>
            <p>The Context Feed is the heartbeat of STEINZ &mdash; a real-time stream of AI-curated on-chain intelligence that transforms raw blockchain data into actionable insights.</p>
            <ol className="list-decimal list-inside space-y-1 text-xs text-gray-400 mt-3 ml-2">
              <li><strong className="text-gray-300">Data Ingestion:</strong> Helius and Alchemy APIs stream live transactions from Solana, Ethereum, BNB Chain, and 9+ additional chains in real time.</li>
              <li><strong className="text-gray-300">Event Detection:</strong> System identifies patterns: whale moves, liquidity changes, token launches, smart contract deployments.</li>
              <li><strong className="text-gray-300">AI Analysis:</strong> VTX AI generates plain-English summaries with sentiment classification for every significant event.</li>
              <li><strong className="text-gray-300">Trust Scoring:</strong> Each event receives a 0&ndash;100 Trust Score based on wallet history, contract verification, and pattern analysis.</li>
              <li><strong className="text-gray-300">Delivery:</strong> Events surface with badges &mdash; BULLISH (green), HYPE (cyan), BEAR (red), NEUTRAL (gray) &mdash; pushed instantly.</li>
            </ol>

            <div className="glass rounded-xl p-4 border border-[#10B981]/20 bg-[#10B981]/[0.03] mt-4">
              <p className="text-[10px] text-[#10B981] font-semibold uppercase tracking-wider mb-2">Context Feed Event Example</p>
              <p className="text-xs text-white font-semibold">BULLISH &middot; 5m ago</p>
              <p className="text-[11px] text-gray-400 mt-1">Large SOL to USDC swap detected. Whale wallet 0x742d...3a7f swapped 25,000 SOL ($4.46M) for USDC on Jupiter. Wallet has 87% historical accuracy on market timing.</p>
              <p className="text-[10px] text-gray-500 mt-2">Trust Score: 82/100 (TRUSTED) | Volume: $4.46M | Chain: Solana</p>
            </div>

            <h3 className="text-base font-heading font-bold text-white mt-8 mb-3">4.2 VTX AI Engine</h3>
            <p>VTX AI is the brain of STEINZ &mdash; a proprietary intelligence engine powered by Anthropic Claude for deep reasoning that continuously scans, classifies, and narrativizes on-chain events. This is not a chatbot bolted onto a dashboard. It is the core reasoning layer running everything.</p>
            <ul className="space-y-2 text-xs text-gray-400 mt-3 ml-2">
              <li><strong className="text-gray-300">Natural Language Queries:</strong> Ask anything about markets, signals, risk, or your portfolio in plain English.</li>
              <li><strong className="text-gray-300">Portfolio Risk Analysis:</strong> Analyzes your holdings and provides actionable recommendations.</li>
              <li><strong className="text-gray-300">Signal Interpretation:</strong> Explains whale moves with context, wallet history, and market implications.</li>
              <li><strong className="text-gray-300">Market Briefings:</strong> Daily and weekly summaries of significant on-chain events and trends.</li>
              <li><strong className="text-gray-300">Pattern Recognition:</strong> Identifies emerging trends before they become obvious to the market.</li>
            </ul>

            <h3 className="text-base font-heading font-bold text-white mt-8 mb-3">4.3 Trading DNA Analyzer</h3>
            <p>Drop any wallet address and STEINZ decodes the complete trading profile &mdash; every DEX swap, every entry and exit, every win and loss analyzed by VTX AI into a full Alpha Intelligence Report.</p>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {['Full P&L Breakdown', 'Win Rate Analysis', 'Average Hold Times', 'Position Sizing Patterns', 'Risk Profile Score', 'Gas Efficiency', 'Profit Factor', 'Behavioral Archetype'].map(item => (
                <div key={item} className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <h3 className="text-base font-heading font-bold text-white mt-8 mb-3">4.4 Wallet Intelligence &amp; Clusters</h3>
            <p>Every active wallet on chain is classified into behavioral archetypes:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {[
                { name: 'Whale Wallets', desc: 'High capital, low frequency. Early macro signal source.' },
                { name: 'Smart Money', desc: 'Moderate capital, high frequency. Primary alpha source.' },
                { name: 'Retail Traders', desc: 'Distributed participants. Sentiment indicator.' },
                { name: 'Bots / MEV', desc: 'High frequency. Identified and filtered from signal feed.' },
                { name: 'Dormant Wallets', desc: 'Re-activation triggers high-priority alerts.' },
              ].map(w => (
                <div key={w.name} className="glass rounded-lg p-3 border border-white/[0.06]">
                  <p className="text-xs font-semibold text-white">{w.name}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{w.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="security" number="05" title="Security Center">
            <p>The Security Center is the fortress of STEINZ &mdash; a comprehensive suite of AI-powered protection tools that scan, analyze, and alert on every potential threat before it can harm your funds. Security is not a feature. It is the foundation.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {[
                { title: 'Token Safety Scanner', desc: 'Enter any contract address. Receive instant Trust Score (0-100): contract verification, liquidity lock, holder distribution, buy/sell tax, developer history, honeypot simulation.' },
                { title: 'Contract Analyzer', desc: 'Paste any contract. VTX AI analyzes the ABI and bytecode, explains what the contract does in plain English. Flags owner functions, pause mechanisms, mint authority, blacklist functions.' },
                { title: 'Rug Detector', desc: 'Full deployer timeline, serial rugger identification with pattern matching, liquidity removal behavior analysis, historical success/failure rates, honeypot simulation.' },
                { title: 'Phishing Detector', desc: 'Domain age verification, registration info, cross-reference against known scam databases, community reports, clear SAFE/SUSPICIOUS/PHISHING verdict.' },
                { title: 'Wallet Approval Manager', desc: 'See every token approval ever granted. Risk-rated. One-click revoke. Bulk revoke dangerous approvals instantly.' },
                { title: 'MEV Protection', desc: 'Toggle ON to block sandwich attacks. Shows attacks blocked and USD saved in real time. Private RPC routing and gas optimization.' },
              ].map(item => (
                <div key={item.title} className="glass rounded-xl p-4 border border-white/[0.06]">
                  <h4 className="text-xs font-heading font-bold text-[#00E5FF] mb-2">{item.title}</h4>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="swap" number="06" title="Multi-Chain Swap Engine">
            <p>The built-in swap engine routes across 12+ chains through the best available liquidity, with safety checks running automatically before every execution.</p>
            <div className="glass rounded-xl p-5 border border-white/[0.06] mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-heading font-bold text-white mb-3">Supported Chains</p>
                  <p className="text-[11px] text-gray-400">Solana, Ethereum, BNB Chain, Polygon, Avalanche, Base, Arbitrum, Optimism, Fantom, Bitcoin, Tron, and all EVM-compatible chains.</p>
                  <div className="mt-3 space-y-1">
                    {['Best price routing across all DEXs', 'Token Safety Scanner before every swap', 'Smart slippage based on volatility', 'Gas cost estimation & optimization', 'Price impact warnings', 'Transparent 0.1-0.3% fee'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-[11px] text-gray-400">
                        <CheckCircle className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-heading font-bold text-white mb-3">Swap Flow</p>
                  <ol className="space-y-2">
                    {['Select input token and amount', 'Select output token', 'Token Safety Scanner runs automatically', 'Best route calculated across aggregators', 'Price impact and fees displayed', 'Confirm and execute with one click'].map((step, i) => (
                      <li key={step} className="flex items-start gap-2 text-[11px] text-gray-400">
                        <span className="text-[10px] font-bold text-[#00E5FF] mt-0.5">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </Section>

          <Section id="builder" number="07" title="Builder Network &amp; Funding Portal">
            <p>Beyond trading intelligence, STEINZ solves the structural problem costing Web3 billions: the best builders go undiscovered, and the best projects never find the right team.</p>

            <h3 className="text-sm font-heading font-bold text-white mt-6 mb-2">On-Chain Reputation Engine</h3>
            <p>Every builder accumulates a verifiable, tamper-proof reputation score derived from real on-chain activity. Reputation scoring measures quality outcomes, not activity volume. Reputation decays if projects fail or get abandoned.</p>

            <h3 className="text-sm font-heading font-bold text-white mt-6 mb-2">Milestone-Gated Launchpad</h3>
            <p>Every other launchpad is a fundraising page with no accountability. STEINZ is categorically different:</p>
            <div className="mt-3 space-y-2">
              {[
                { step: '1', title: 'Builder Applies', desc: 'Goes through STEINZ verification. Only verified, credible builders get through.' },
                { step: '2', title: 'Builder Pitches', desc: 'Full project details visible to the community and investor network.' },
                { step: '3', title: 'Funding Portal Opens', desc: 'Dedicated funding portal with completely transparent terms.' },
                { step: '4', title: 'Funds Are Held', desc: 'Raised funds held in audited smart contracts, not released immediately.' },
                { step: '5', title: 'Milestone Release', desc: 'As milestones are hit with proof of delivery, funding tranches release. No delivery, no release.' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3 glass rounded-lg p-3 border border-white/[0.06]">
                  <div className="w-6 h-6 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold">{s.step}</div>
                  <div>
                    <p className="text-xs font-semibold text-white">{s.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="predictions" number="08" title="Prediction Markets">
            <p>Users create prediction markets on any verifiable on-chain event. Stake tokens on Yes or No outcomes. Percentage bars update in real time. Markets resolve automatically when conditions are met. Correct predictions earn points and token rewards.</p>
            <div className="glass rounded-xl p-4 border border-[#7C3AED]/20 bg-[#7C3AED]/[0.03] mt-4">
              <p className="text-[10px] text-[#7C3AED] font-semibold uppercase tracking-wider mb-2">Example Market</p>
              <p className="text-sm text-white font-heading font-bold">Will SOL reach $200 in 7 days?</p>
              <p className="text-[11px] text-gray-400 mt-1">Current: $178.42 | Target: $200 | Volume: $1.2M</p>
              <div className="flex gap-2 mt-3">
                <div className="flex-1 bg-[#10B981]/20 rounded-lg p-2 text-center">
                  <span className="text-xs font-bold text-[#10B981]">Yes: 67%</span>
                </div>
                <div className="flex-1 bg-[#EF4444]/20 rounded-lg p-2 text-center">
                  <span className="text-xs font-bold text-[#EF4444]">No: 33%</span>
                </div>
              </div>
            </div>
          </Section>

          <Section id="unique" number="09" title="Why STEINZ Is Unique">
            <p>No existing platform combines all of these elements into one unified intelligence layer.</p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-2 px-3 text-[10px] font-semibold text-gray-500 uppercase">Platform</th>
                    <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase text-center">AI Intel</th>
                    <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase text-center">Security</th>
                    <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase text-center">Builder</th>
                    <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase text-center">Launchpad</th>
                    <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase text-center">Multi-Chain</th>
                    <th className="py-2 px-2 text-[10px] font-semibold text-gray-500 uppercase text-center">Wallet</th>
                  </tr>
                </thead>
                <tbody>
                  <ComparisonRow platform="Nansen" ai="Yes" security="Limited" builder="No" launchpad="No" multichain="Partial" wallet="No" />
                  <ComparisonRow platform="Arkham" ai="Yes" security="No" builder="No" launchpad="No" multichain="Partial" wallet="No" />
                  <ComparisonRow platform="Dune Analytics" ai="No" security="No" builder="No" launchpad="No" multichain="Yes" wallet="No" />
                  <ComparisonRow platform="DAO Maker" ai="No" security="No" builder="Partial" launchpad="Yes" multichain="No" wallet="No" />
                  <ComparisonRow platform="Revoke.cash" ai="No" security="Approvals" builder="No" launchpad="No" multichain="EVM" wallet="No" />
                  <ComparisonRow platform="STEINZ LABS" ai="Full" security="Full Suite" builder="Yes" launchpad="Milestone" multichain="12+" wallet="Yes" highlight />
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
              <div className="glass rounded-xl p-4 border border-[#00E5FF]/10">
                <h4 className="text-xs font-heading font-bold text-[#00E5FF] mb-2">Reputation Trading Flywheel</h4>
                <p className="text-[11px] text-gray-500">No other platform connects builder reputation with trading intelligence. When a high-reputation builder launches, Smart Money surfaces it to traders instantly.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-[#7C3AED]/10">
                <h4 className="text-xs font-heading font-bold text-[#7C3AED] mb-2">AI at Chain Speed</h4>
                <p className="text-[11px] text-gray-500">Anthropic&apos;s reasoning capabilities enable sub-second inference on live on-chain events &mdash; a genuine technical moat incumbents cannot easily replicate.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-[#10B981]/10">
                <h4 className="text-xs font-heading font-bold text-[#10B981] mb-2">Security-First Architecture</h4>
                <p className="text-[11px] text-gray-500">Every token scanned before interaction. Every contract analyzed before signing. Every approval monitored. Every swap checked. Security is the foundation.</p>
              </div>
            </div>
          </Section>

          <Section id="business" number="10" title="Business Model &amp; Revenue">
            <p>STEINZ generates revenue through multiple compounding streams:</p>
            <div className="space-y-3 mt-4">
              {[
                { title: 'Premium Subscriptions', desc: 'Free tier covers basic access. Pro unlocks full wallet intelligence, all security tools, unlimited alerts, advanced VTX AI, and Trading DNA Analyzer.' },
                { title: 'Project Listing Fees', desc: 'Verified projects pay to be discovered. Every submission goes through automated rug check first — only approved projects get listed.' },
                { title: 'Swap Fees', desc: 'Transparent 0.1–0.3% fee on every swap. Volume-based revenue that scales with platform adoption.' },
                { title: 'Launchpad Fees', desc: '2–3% platform fee on capital raised through the milestone-gated launchpad. Only charged on funded raises.' },
                { title: 'API Access', desc: 'Enterprise-grade data access for funds, protocols, and institutions. Custom feeds and white-label intelligence.' },
              ].map(item => (
                <div key={item.title} className="glass rounded-lg p-4 border border-white/[0.06]">
                  <h4 className="text-xs font-heading font-bold text-white mb-1">{item.title}</h4>
                  <p className="text-[11px] text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="roadmap" number="11" title="Upcoming Features">
            <div className="grid grid-cols-2 gap-2">
              {['Full Trading Suite', 'Copy Trading Protocol', 'Community Sentiment Dashboard', 'Insider Threat Alert System', 'Trading DNA Deep Reports', 'STEINZ Earn Layer', 'Cross-Chain Bridge', 'Institutional API'].map(item => (
                <div key={item} className="flex items-center gap-2 glass rounded-lg p-3 border border-white/[0.06]">
                  <div className="w-1.5 h-1.5 bg-[#F59E0B] rounded-full flex-shrink-0"></div>
                  <span className="text-xs text-gray-400">{item}</span>
                </div>
              ))}
            </div>
          </Section>

          <div className="glass rounded-2xl p-8 border border-[#00E5FF]/10 bg-gradient-to-b from-[#00E5FF]/[0.03] to-transparent text-center mt-8">
            <h3 className="text-xl font-heading font-bold mb-3">Ready to Experience the Future?</h3>
            <p className="text-sm text-gray-400 mb-6">STEINZ Labs &mdash; The intelligence infrastructure layer for the on-chain economy.</p>
            <Link href="/dashboard">
              <button className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-8 py-3 rounded-xl font-semibold text-sm hover:scale-[1.03] transition-all shimmer-btn shadow-xl shadow-[#00E5FF]/20 inline-flex items-center gap-2">
                Launch Platform <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          <div className="text-center mt-8 text-gray-600 text-[11px]">
            &copy; 2026 STEINZ Labs. Confidential. For Strategic Partners.
          </div>
        </div>
      </div>
    </div>
  );
}
