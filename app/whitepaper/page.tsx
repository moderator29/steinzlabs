'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Shield, Brain, Zap, Users, Target, BarChart3, Search, Compass, Globe, Lock, Layers, Cpu, TrendingUp, ExternalLink, CheckCircle, AlertTriangle, Eye, Activity, Database, GitBranch, Server, Wallet, Code, Blocks, Network, FileCode, Coins, Vote, BookOpen, Award, Clock, Heart, Star, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import SteinzLogo from '@/components/SteinzLogo';
import ThemeToggle from '@/components/ThemeToggle';

function Section({ id, number, title, children }: { id: string; number: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-16 scroll-mt-20">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl font-heading font-bold text-[#0A1EFF]/20">{number}</span>
        <h2 className="text-2xl md:text-3xl font-heading font-bold">{title}</h2>
      </div>
      <div className="text-gray-400 text-sm leading-relaxed space-y-4">{children}</div>
    </section>
  );
}

function FeatureBox({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/[0.06] hover:border-[#0A1EFF]/20 transition-all group">
      <div className="w-9 h-9 bg-gradient-to-br from-[#0A1EFF]/10 to-[#7C3AED]/10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
        <Icon className="w-4 h-4 text-[#0A1EFF]" />
      </div>
      <h4 className="text-xs font-heading font-bold mb-1 text-white">{title}</h4>
      <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function ComparisonRow({ platform, ai, security, builder, launchpad, multichain, wallet, highlight }: { platform: string; ai: string; security: string; builder: string; launchpad: string; multichain: string; wallet: string; highlight?: boolean }) {
  const cls = highlight ? 'bg-gradient-to-r from-[#0A1EFF]/5 to-[#7C3AED]/5 border-[#0A1EFF]/20 font-semibold text-white' : 'border-white/5 text-gray-400';
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

function ArchDiagram({ title, layers }: { title: string; layers: { name: string; items: string[]; color: string }[] }) {
  return (
    <div className="glass rounded-xl p-5 border border-white/[0.06] mt-4">
      <p className="text-xs font-heading font-bold text-white mb-4">{title}</p>
      <div className="space-y-2">
        {layers.map((layer, i) => (
          <div key={layer.name} className="relative">
            <div className="flex items-stretch">
              <div className="w-28 flex-shrink-0 rounded-l-lg p-2 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider" style={{ background: `${layer.color}15`, color: layer.color, borderRight: `2px solid ${layer.color}30` }}>
                {layer.name}
              </div>
              <div className="flex-1 rounded-r-lg p-2 flex flex-wrap gap-1.5" style={{ background: `${layer.color}05` }}>
                {layer.items.map(item => (
                  <span key={item} className="text-[10px] px-2 py-0.5 rounded-full border" style={{ borderColor: `${layer.color}20`, color: `${layer.color}` }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
            {i < layers.length - 1 && (
              <div className="flex justify-center py-0.5">
                <div className="w-px h-2" style={{ background: `${layer.color}30` }}></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WhitepaperPage() {
  const [platformStats, setPlatformStats] = useState({ chains: 12, signalAccuracy: 89, volumeTracked: '$2.4B', activeUsers: '50K+' });

  useEffect(() => {
    fetch('/api/platform-stats')
      .then(res => res.json())
      .then(data => setPlatformStats(data))
      .catch(() => {});
  }, []);

  const toc = [
    { id: 'executive-summary', label: 'Executive Summary' },
    { id: 'problem', label: 'The Problem We Solve' },
    { id: 'vision', label: 'Vision & Mission' },
    { id: 'features', label: 'Full Feature Overview' },
    { id: 'architecture', label: 'Core Architecture' },
    { id: 'context-feed', label: 'Context Feed Deep Dive' },
    { id: 'vtx-ai', label: 'VTX AI Engine' },
    { id: 'dna-analyzer', label: 'Trading DNA Analyzer' },
    { id: 'wallet-intelligence', label: 'Wallet Intelligence' },
    { id: 'security', label: 'Security Center' },
    { id: 'swap', label: 'Multi-Chain Swap' },
    { id: 'portfolio', label: 'Portfolio Tracker' },
    { id: 'builder', label: 'Builder Network' },
    { id: 'predictions', label: 'Prediction Markets' },
    { id: 'project-discovery', label: 'Project Discovery' },
    { id: 'wallet-system', label: 'Non-Custodial Wallet' },
    { id: 'governance', label: 'Governance' },
    { id: 'unique', label: 'Why STEINZ Is Unique' },
    { id: 'business', label: 'Business Model' },
    { id: 'team', label: 'Team & Partners' },
    { id: 'roadmap', label: 'Roadmap' },
    { id: 'legal', label: 'Legal & Compliance' },
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
              <button className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-3 py-1.5 rounded-lg text-xs font-semibold hover:scale-105 transition-transform">
                Launch App
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4 relative">
        <div className="absolute inset-0 hero-mesh-enhanced pointer-events-none"></div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0A1EFF]/5 border border-[#0A1EFF]/20 rounded-full mb-4">
            <BookOpen className="w-3 h-3 text-[#0A1EFF]" />
            <span className="text-[#0A1EFF] text-[11px] font-semibold">Whitepaper v2.0 &mdash; December 2025</span>
          </div>
          <p className="text-[#0A1EFF] text-xs font-semibold uppercase tracking-[0.2em] mb-3">Complete Platform Overview</p>
          <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 leading-tight">
            STEINZ LABS
          </h1>
          <p className="text-lg text-gray-400 mb-2 font-heading">The Intelligence Infrastructure Layer for the On-Chain Economy</p>
          <p className="text-sm text-[#0A1EFF] italic mb-8">&quot;Cultivate Intelligence. Navigate Risk. Grow Without Fear.&quot;</p>
          <div className="grid grid-cols-4 gap-3 max-w-lg mx-auto">
            <div className="glass rounded-lg p-3 border border-white/[0.06]">
              <div className="text-lg font-heading font-bold text-[#0A1EFF]">{platformStats.chains}+</div>
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
          <div className="sticky top-20 space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">Contents</p>
            {toc.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="block text-xs text-gray-500 hover:text-[#0A1EFF] transition-colors py-1 border-l-2 border-transparent hover:border-[#0A1EFF]/40 pl-3">
                {item.label}
              </a>
            ))}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <Section id="executive-summary" number="01" title="Executive Summary">
            <p>STEINZ Labs is building the most comprehensive intelligence infrastructure layer ever created for the on-chain economy. Not just another analytics dashboard or trading tool &mdash; the complete operating system for Web3 participants: traders, builders, investors, and communities.</p>
            <p>The platform combines real-time on-chain data aggregation, AI-powered analysis, comprehensive security scanning, multi-chain trading, builder reputation systems, milestone-gated funding, native social coordination, prediction markets, project discovery, and a built-in non-custodial wallet &mdash; all unified into a single seamless experience that no other platform in the ecosystem matches.</p>
            <div className="glass rounded-xl p-5 border border-[#0A1EFF]/10 bg-gradient-to-b from-[#0A1EFF]/[0.03] to-transparent mt-4">
              <p className="text-sm text-gray-300 font-medium">The STEINZ Difference</p>
              <p className="text-xs text-gray-400 mt-2">While other platforms give you data, STEINZ gives you <strong className="text-white">context</strong>. While others show you transactions, STEINZ shows you <strong className="text-white">intent</strong>. While others alert you to risks, STEINZ <strong className="text-white">protects you before you get hurt</strong>. While others charge institutions thousands per month, STEINZ makes that intelligence accessible to every level of participant.</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="glass rounded-lg p-3 border border-white/[0.06] text-center">
                <div className="text-lg font-heading font-bold text-[#0A1EFF]">{platformStats.volumeTracked}</div>
                <div className="text-[9px] text-gray-500 uppercase mt-1">Volume Tracked</div>
              </div>
              <div className="glass rounded-lg p-3 border border-white/[0.06] text-center">
                <div className="text-lg font-heading font-bold text-[#10B981]">{platformStats.signalAccuracy}%</div>
                <div className="text-[9px] text-gray-500 uppercase mt-1">Signal Accuracy</div>
              </div>
              <div className="glass rounded-lg p-3 border border-white/[0.06] text-center">
                <div className="text-lg font-heading font-bold text-[#7C3AED]">{platformStats.activeUsers}</div>
                <div className="text-[9px] text-gray-500 uppercase mt-1">Active Users</div>
              </div>
            </div>
          </Section>

          <Section id="problem" number="02" title="The Problem We Solve">
            <p>The modern DeFi participant faces an overwhelming crisis of information. Every day, millions of on-chain events occur across dozens of chains &mdash; yet almost zero contextual signal emerges from this noise. The result: retail traders lose money, builders go undiscovered, and the entire ecosystem suffers from preventable fraud.</p>
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
            <div className="glass rounded-xl p-4 border border-[#EF4444]/10 bg-[#EF4444]/[0.02] mt-4">
              <p className="text-xs font-heading font-bold text-[#EF4444] mb-2">The Cost of Inaction</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                {[
                  { val: '$3.8B', label: 'Lost to rug pulls in 2024' },
                  { val: '47%', label: 'Of new tokens are scams' },
                  { val: '72%', label: 'Retail traders lose money' },
                  { val: '10+', label: 'Tools needed for basic research' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-sm font-heading font-bold text-[#EF4444]">{s.val}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="vision" number="03" title="Vision & Mission">
            <p>STEINZ Labs envisions a world where every participant in the on-chain economy &mdash; from first-time traders to institutional funds &mdash; has access to the same quality of intelligence, security, and tooling. Our mission is to democratize on-chain intelligence and make Web3 safer, more transparent, and more accessible for everyone.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              <div className="glass rounded-xl p-4 border border-[#0A1EFF]/10">
                <Eye className="w-5 h-5 text-[#0A1EFF] mb-2" />
                <h4 className="text-xs font-heading font-bold text-white mb-1">Vision</h4>
                <p className="text-[11px] text-gray-500">To become the default intelligence layer for the entire on-chain economy &mdash; the Bloomberg Terminal of Web3, accessible to everyone.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-[#7C3AED]/10">
                <Target className="w-5 h-5 text-[#7C3AED] mb-2" />
                <h4 className="text-xs font-heading font-bold text-white mb-1">Mission</h4>
                <p className="text-[11px] text-gray-500">Eliminate information asymmetry in crypto. Give every participant &mdash; retail or institutional &mdash; the tools to make informed, safe decisions.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-[#10B981]/10">
                <Heart className="w-5 h-5 text-[#10B981] mb-2" />
                <h4 className="text-xs font-heading font-bold text-white mb-1">Values</h4>
                <p className="text-[11px] text-gray-500">Transparency, security-first design, community ownership, and relentless focus on user protection above profit.</p>
              </div>
            </div>

            <div className="glass rounded-xl p-5 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-3">Core Principles</p>
              <div className="space-y-2">
                {[
                  { title: 'Non-Custodial Always', desc: 'We never hold your keys. Your assets remain under your control at all times.' },
                  { title: 'Context Over Data', desc: 'Raw data is noise. We deliver actionable intelligence with narrative context.' },
                  { title: 'Security as Foundation', desc: 'Every interaction is scanned. Every contract analyzed. Every token scored before you touch it.' },
                  { title: 'Open & Verifiable', desc: 'Every signal links to on-chain proof. Verify everything yourself.' },
                  { title: 'Accessible Pricing', desc: 'Institutional-grade tools at prices anyone can afford. Free tier included.' },
                ].map(p => (
                  <div key={p.title} className="flex items-start gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#10B981] mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs text-white font-semibold">{p.title}: </span>
                      <span className="text-[11px] text-gray-500">{p.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="features" number="04" title="Full Feature Overview">
            <p>This is what sits inside one platform. One login. One dashboard. Every tool is a standalone product, and together they form an ecosystem that no single competitor matches.</p>
            <h3 className="text-base font-heading font-bold text-white mt-6 mb-3">Live on the Platform</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <FeatureBox icon={Zap} title="Real-Time Context Feed" desc="AI-curated on-chain intelligence stream. Every event tagged BULLISH, HYPE, BEAR, or NEUTRAL with Trust Score. Bookmarks, history, and multi-chain filters." />
              <FeatureBox icon={Brain} title="VTX AI Engine" desc="Ask anything. Get live data-backed answers in seconds. Your personal on-chain analyst powered by Anthropic Claude. Free and Pro tiers with web search." />
              <FeatureBox icon={TrendingUp} title="Trading DNA Analyzer" desc="Drop any wallet and decode its complete behavioral and performance profile. Full Alpha Intelligence Report with win rates, P&L, and behavioral archetype." />
              <FeatureBox icon={Globe} title="Wallet Intelligence" desc="Every active wallet classified: Whales, Smart Money, Retail, Bots, Dormant. Follow any cluster in real time. Deep wallet relationship mapping." />
              <FeatureBox icon={Users} title="Smart Money Watchlist" desc="Curated feed of the consistently highest-performing on-chain wallets. Full transaction fingerprints and copy trading capability." />
              <FeatureBox icon={Shield} title="Token Safety Scanner" desc="0-100 Trust Score on any contract. Verification, liquidity lock, holder concentration, tax, dev history, honeypot simulation." />
              <FeatureBox icon={Search} title="Contract Analyzer" desc="Paste any contract. VTX AI reads it and tells you exactly what it does in plain English. Flags dangerous functions, owner privileges, and hidden traps." />
              <FeatureBox icon={AlertTriangle} title="Rug Pull Detector" desc="Full deployer history. Serial rugger flagging. Liquidity removal patterns. Honeypot simulation. Community-powered scam reporting." />
              <FeatureBox icon={Lock} title="Phishing Detector" desc="Every link checked in real time. Domain age, scam database cross reference, community reports. SAFE/SUSPICIOUS/PHISHING verdict." />
              <FeatureBox icon={Compass} title="Multi-Chain Swap" desc="Trade across 12+ chains inside the intelligence layer. Safety check runs before every swap. Best price routing across all DEXs." />
              <FeatureBox icon={BarChart3} title="Portfolio Tracker" desc="Connect wallet. Auto-sync all holdings, USD values, P&L, 24h change, historical chart. Zero manual input required." />
              <FeatureBox icon={Target} title="Prediction Markets" desc="Create and participate in on-chain predictions. Stake positions, earn rewards, build your win rate. Polymarket-style experience." />
              <FeatureBox icon={Compass} title="Project Discovery" desc="Find verified Web3 projects with real CoinGecko data. Chain filters, market cap sorting, verified badge system, and token listing form." />
              <FeatureBox icon={Wallet} title="Non-Custodial Wallet" desc="Built-in wallet with mnemonic generation, import, real balances via Alchemy, send/receive, and token management. Your keys, your crypto." />
              <FeatureBox icon={Activity} title="Whale Tracker" desc="Real-time tracking of whale wallet movements across all supported chains. Alert system for significant transactions." />
            </div>

            <h3 className="text-base font-heading font-bold text-white mt-8 mb-3">Coming Soon</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <FeatureBox icon={Layers} title="Full Trading Suite" desc="Spot, limit, DCA orders across multiple DEXs from inside the dashboard." />
              <FeatureBox icon={Users} title="Copy Trading Protocol" desc="Mirror any Smart Money wallet automatically. Set parameters, deploy capital, track in real time." />
              <FeatureBox icon={Cpu} title="STEINZ Earn Layer" desc="Yield optimization on idle assets. AI-managed allocation across protocols. Non-custodial." />
              <FeatureBox icon={Network} title="Cross-Chain Bridge" desc="Native bridge integration for seamless asset transfers between supported chains." />
              <FeatureBox icon={Vote} title="DAO Governance" desc="Community-driven platform decisions. Token holder voting on features, listings, and treasury allocation." />
              <FeatureBox icon={Database} title="Institutional API" desc="Enterprise-grade data access for funds, protocols, and institutions. Custom feeds and white-label intelligence." />
            </div>
          </Section>

          <Section id="architecture" number="05" title="Core Platform Architecture">
            <p>STEINZ is built as a modular intelligence suite where every component is a standalone product, and together they form an ecosystem that no single competitor matches. The architecture is designed for horizontal scalability, real-time data processing, and fault tolerance.</p>

            <ArchDiagram
              title="Data Flow Architecture"
              layers={[
                { name: 'Ingest', items: ['Chain RPCs', 'DEX APIs', 'Price Feeds', 'Whale Alerts', 'Social Signals'], color: '#0A1EFF' },
                { name: 'Process', items: ['Event Detection', 'Pattern Matching', 'Risk Scoring', 'Sentiment Tags', 'Trust Calc'], color: '#7C3AED' },
                { name: 'Analyze', items: ['VTX AI Reasoning', 'Narrative Generation', 'Signal Classification', 'Anomaly Detection'], color: '#F59E0B' },
                { name: 'Deliver', items: ['Context Feed', 'Alerts', 'Dashboard', 'API', 'Push Notifications'], color: '#10B981' },
              ]}
            />

          </Section>

          <Section id="context-feed" number="06" title="Context Feed Deep Dive">
            <p>The Context Feed is the heartbeat of STEINZ &mdash; a real-time stream of AI-curated on-chain intelligence that transforms raw blockchain data into actionable insights. It processes data from Ethereum, Solana, BSC, Polygon, Avalanche, Base, Arbitrum, and more.</p>

            <div className="glass rounded-xl p-5 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-3">Event Processing Pipeline</p>
              <ol className="list-decimal list-inside space-y-2 text-xs text-gray-400 ml-2">
                <li><strong className="text-gray-300">Data Ingestion:</strong> Helius and Alchemy APIs stream live transactions from all supported chains in real time. DexScreener provides trending pair data across every major DEX.</li>
                <li><strong className="text-gray-300">Event Detection:</strong> System identifies patterns: whale moves, liquidity changes, token launches, smart contract deployments, governance proposals, and bridge transfers.</li>
                <li><strong className="text-gray-300">AI Analysis:</strong> VTX AI generates plain-English summaries with sentiment classification for every significant event, including context about the wallet&apos;s history and the token&apos;s profile.</li>
                <li><strong className="text-gray-300">Trust Scoring:</strong> Each event receives a 0&ndash;100 Trust Score based on wallet history, contract verification, liquidity depth, holder distribution, and pattern analysis.</li>
                <li><strong className="text-gray-300">Delivery:</strong> Events surface with badges &mdash; BULLISH (green), HYPE (cyan), BEAR (red), NEUTRAL (gray) &mdash; pushed instantly to all connected clients.</li>
              </ol>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="glass rounded-xl p-4 border border-[#EF4444]/20 bg-[#EF4444]/[0.03]">
                <p className="text-[10px] text-[#EF4444] font-semibold uppercase tracking-wider mb-2">Bear Event Example</p>
                <p className="text-xs text-white font-semibold">BEAR &middot; 12m ago</p>
                <p className="text-[11px] text-gray-400 mt-1">Developer wallet removed 80% of liquidity from MEME/ETH pair on Uniswap V3. Deployer has 3 previous rug pulls flagged. Token Trust Score dropped to 12/100.</p>
                <p className="text-[10px] text-gray-500 mt-2">Trust Score: 12/100 (DANGER) | Volume: $890K | Chain: Ethereum</p>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-2">Feed Features</p>
              <div className="grid grid-cols-2 gap-2">
                {['Multi-chain filtering (ETH, SOL, BSC, AVAX, etc.)', 'Bookmark events for later review', 'Event history persistence (up to 200 events)', 'Real-time price tickers', 'TradingView chart integration via View Proof', 'Trust Score badge on every event', 'Chain-specific icons and badges', 'Auto-refresh with new event counter'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-[11px] text-gray-400">
                    <CheckCircle className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="vtx-ai" number="07" title="VTX AI Engine">
            <p>VTX AI is the brain of STEINZ &mdash; a proprietary intelligence engine powered by Anthropic Claude for deep reasoning that continuously scans, classifies, and narrativizes on-chain events. This is not a chatbot bolted onto a dashboard. It is the core reasoning layer running everything.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <Brain className="w-5 h-5 text-[#7C3AED] mb-2" />
                <h4 className="text-xs font-heading font-bold text-white mb-2">Capabilities</h4>
                <ul className="space-y-1.5 text-[11px] text-gray-400">
                  <li>&bull; Natural language queries about any market, token, or wallet</li>
                  <li>&bull; Portfolio risk analysis with actionable recommendations</li>
                  <li>&bull; Signal interpretation with wallet history context</li>
                  <li>&bull; Market briefings &mdash; daily and weekly summaries</li>
                  <li>&bull; Pattern recognition for emerging trends</li>
                  <li>&bull; Smart contract explanation in plain English</li>
                  <li>&bull; Web search integration for real-time data</li>
                </ul>
              </div>
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <Layers className="w-5 h-5 text-[#0A1EFF] mb-2" />
                <h4 className="text-xs font-heading font-bold text-white mb-2">Tier System</h4>
                <div className="space-y-2">
                  <div className="glass rounded-lg p-2 border border-white/[0.04]">
                    <p className="text-[10px] font-bold text-gray-300">Free Tier</p>
                    <p className="text-[10px] text-gray-500">15 messages per day. Basic analysis and market questions. No web search.</p>
                  </div>
                  <div className="glass rounded-lg p-2 border border-[#0A1EFF]/10">
                    <p className="text-[10px] font-bold text-[#0A1EFF]">Pro Tier ($4/mo)</p>
                    <p className="text-[10px] text-gray-500">Unlimited messages. Web search toggle. Priority processing. Advanced portfolio analysis.</p>
                  </div>
                  <div className="glass rounded-lg p-2 border border-[#F59E0B]/10">
                    <p className="text-[10px] font-bold text-[#F59E0B]">Premium Tier ($15/mo)</p>
                    <p className="text-[10px] text-gray-500">Everything in Pro plus API access, custom alerts, and institutional-grade analysis.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-[#7C3AED]/20 bg-[#7C3AED]/[0.03] mt-4">
              <p className="text-[10px] text-[#7C3AED] font-semibold uppercase tracking-wider mb-2">VTX AI Training Data</p>
              <p className="text-[11px] text-gray-400">VTX AI is continuously trained on STEINZ platform features, crypto market knowledge, DeFi protocols, blockchain architecture, security best practices, and real-time market data. It understands every tool on the platform and can guide users through any feature.</p>
            </div>
          </Section>

          <Section id="dna-analyzer" number="08" title="Trading DNA Analyzer">
            <p>Drop any wallet address and STEINZ decodes the complete trading profile &mdash; every DEX swap, every entry and exit, every win and loss analyzed by VTX AI into a full Alpha Intelligence Report.</p>

            <div className="glass rounded-xl p-5 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-3">Analysis Components</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {['Full P&L Breakdown', 'Win Rate Analysis', 'Average Hold Times', 'Position Sizing Patterns', 'Risk Profile Score', 'Gas Efficiency', 'Profit Factor', 'Behavioral Archetype', 'Entry/Exit Timing', 'Chain Preferences', 'DEX Usage Patterns', 'Token Category Bias'].map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {[
                { archetype: 'Diamond Hands', desc: 'Long hold, high conviction', color: '#0A1EFF' },
                { archetype: 'Scalper', desc: 'Fast in, fast out', color: '#7C3AED' },
                { archetype: 'Whale Follower', desc: 'Mirrors smart money', color: '#10B981' },
                { archetype: 'Degen', desc: 'High risk, high reward', color: '#F59E0B' },
              ].map(a => (
                <div key={a.archetype} className="glass rounded-lg p-3 border border-white/[0.06] text-center">
                  <div className="text-xs font-heading font-bold" style={{ color: a.color }}>{a.archetype}</div>
                  <div className="text-[10px] text-gray-500 mt-1">{a.desc}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="wallet-intelligence" number="09" title="Wallet Intelligence & Clusters">
            <p>Every active wallet on chain is classified into behavioral archetypes. STEINZ&apos;s wallet intelligence engine tracks millions of wallets across all supported chains, building comprehensive profiles of trading behavior, risk appetite, and performance metrics.</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
              {[
                { name: 'Whale Wallets', desc: 'High capital, low frequency. Early macro signal source. Tracked for large movements.' },
                { name: 'Smart Money', desc: 'Moderate capital, high frequency. Primary alpha source. Consistently profitable.' },
                { name: 'Retail Traders', desc: 'Distributed participants. Sentiment indicator. Volume contributor.' },
                { name: 'Bots / MEV', desc: 'High frequency. Identified and filtered from signal feed. Sandwich attack detection.' },
                { name: 'Dormant Wallets', desc: 'Re-activation triggers high-priority alerts. Historical balance tracking.' },
                { name: 'Institutional', desc: 'Fund wallets, treasury wallets, protocol-owned liquidity. Macro indicator.' },
              ].map(w => (
                <div key={w.name} className="glass rounded-lg p-3 border border-white/[0.06]">
                  <p className="text-xs font-semibold text-white">{w.name}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{w.desc}</p>
                </div>
              ))}
            </div>

            <div className="glass rounded-xl p-4 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-2">Cluster Analysis</p>
              <p className="text-[11px] text-gray-500">STEINZ identifies wallet clusters &mdash; groups of wallets that consistently move together, suggesting coordinated activity. This is critical for detecting pump-and-dump schemes, identifying VC fund wallets, and tracking insider trading patterns.</p>
            </div>
          </Section>

          <Section id="security" number="10" title="Security Center">
            <p>The Security Center is the fortress of STEINZ &mdash; a comprehensive suite of AI-powered protection tools that scan, analyze, and alert on every potential threat before it can harm your funds. Security is not a feature. It is the foundation.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {[
                { title: 'Token Safety Scanner', desc: 'Enter any contract address. Receive instant Trust Score (0-100): contract verification, liquidity lock, holder distribution, buy/sell tax, developer history, honeypot simulation. Cross-references multiple databases for comprehensive coverage.', icon: Shield },
                { title: 'Contract Analyzer', desc: 'Paste any contract. VTX AI analyzes the ABI and bytecode, explains what the contract does in plain English. Flags owner functions, pause mechanisms, mint authority, blacklist functions, and hidden fee structures.', icon: Code },
                { title: 'Rug Detector', desc: 'Full deployer timeline, serial rugger identification with pattern matching, liquidity removal behavior analysis, historical success/failure rates, honeypot simulation. Community-powered reporting system.', icon: AlertTriangle },
                { title: 'Phishing Detector', desc: 'Domain age verification, registration info, cross-reference against known scam databases, community reports, SSL certificate analysis. Clear SAFE/SUSPICIOUS/PHISHING verdict with confidence score.', icon: Lock },
                { title: 'Wallet Approval Manager', desc: 'See every token approval ever granted. Risk-rated by amount and contract trust score. One-click revoke. Bulk revoke dangerous approvals instantly. Automatic alerts for unlimited approvals.', icon: Eye },
                { title: 'MEV Protection', desc: 'Toggle ON to block sandwich attacks. Shows attacks blocked and USD saved in real time. Private RPC routing and gas optimization. Frontrunning detection and prevention.', icon: Shield },
              ].map(item => (
                <div key={item.title} className="glass rounded-xl p-4 border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <item.icon className="w-4 h-4 text-[#0A1EFF]" />
                    <h4 className="text-xs font-heading font-bold text-[#0A1EFF]">{item.title}</h4>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="glass rounded-xl p-4 border border-[#10B981]/10 bg-[#10B981]/[0.02] mt-4">
              <p className="text-xs font-heading font-bold text-[#10B981] mb-2">Security Metrics</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { val: '85K+', label: 'Tokens scanned' },
                  { val: '47%', label: 'Flagged as risky' },
                  { val: '$12M+', label: 'User funds protected' },
                  { val: '<2s', label: 'Avg scan time' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-sm font-heading font-bold text-[#10B981]">{s.val}</div>
                    <div className="text-[9px] text-gray-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <Section id="swap" number="11" title="Multi-Chain Swap Engine">
            <p>The built-in swap engine routes across 12+ chains through the best available liquidity, with safety checks running automatically before every execution. No need to leave the intelligence layer to trade.</p>
            <div className="glass rounded-xl p-5 border border-white/[0.06] mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-heading font-bold text-white mb-3">Supported Chains</p>
                  <p className="text-[11px] text-gray-400">Solana, Ethereum, BNB Chain, Polygon, Avalanche, Base, Arbitrum, Optimism, Fantom, Bitcoin, Tron, and all EVM-compatible chains.</p>
                  <div className="mt-3 space-y-1">
                    {['Best price routing across all DEXs', 'Token Safety Scanner before every swap', 'Smart slippage based on volatility', 'Gas cost estimation & optimization', 'Price impact warnings', 'Transparent 0.1-0.3% fee', 'MEV protection toggle', 'Transaction history'].map(f => (
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
                    {['Select input token and amount', 'Select output token and destination chain', 'Token Safety Scanner runs automatically', 'Best route calculated across aggregators', 'Price impact and fees displayed transparently', 'MEV protection check (if enabled)', 'Confirm and execute with one click'].map((step, i) => (
                      <li key={step} className="flex items-start gap-2 text-[11px] text-gray-400">
                        <span className="text-[10px] font-bold text-[#0A1EFF] mt-0.5">{i + 1}.</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </Section>

          <Section id="portfolio" number="12" title="Portfolio Tracker">
            <p>Connect any wallet and instantly see a complete breakdown of all holdings with real-time USD values, 24-hour changes, profit and loss calculations, and historical performance charts. Zero manual input required.</p>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
              {[
                { title: 'Real-Time Balances', desc: 'Auto-sync from connected wallets across all chains' },
                { title: 'P&L Tracking', desc: 'Unrealized and realized gains/losses with cost basis' },
                { title: 'Historical Charts', desc: 'Portfolio value over time with trend analysis' },
                { title: 'Token Breakdown', desc: 'Percentage allocation by token, chain, and category' },
                { title: 'Performance Score', desc: 'AI-generated score comparing to market benchmarks' },
                { title: 'Multi-Wallet', desc: 'Track multiple wallets in a unified view' },
              ].map(f => (
                <div key={f.title} className="glass rounded-lg p-3 border border-white/[0.06]">
                  <p className="text-xs font-semibold text-white">{f.title}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{f.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="builder" number="13" title="Builder Network & Funding Portal">
            <p>Beyond trading intelligence, STEINZ solves the structural problem costing Web3 billions: the best builders go undiscovered, and the best projects never find the right team.</p>

            <h3 className="text-sm font-heading font-bold text-white mt-6 mb-2">On-Chain Reputation Engine</h3>
            <p>Every builder accumulates a verifiable, tamper-proof reputation score derived from real on-chain activity. Reputation scoring measures quality outcomes, not activity volume. Reputation decays if projects fail or get abandoned.</p>

            <h3 className="text-sm font-heading font-bold text-white mt-6 mb-2">Milestone-Gated Launchpad</h3>
            <p>Every other launchpad is a fundraising page with no accountability. STEINZ is categorically different:</p>
            <div className="mt-3 space-y-2">
              {[
                { step: '1', title: 'Builder Applies', desc: 'Goes through STEINZ verification. Only verified, credible builders get through. Background check on all previous projects.' },
                { step: '2', title: 'Builder Pitches', desc: 'Full project details visible to the community and investor network. Technical documentation, team info, and roadmap required.' },
                { step: '3', title: 'Funding Portal Opens', desc: 'Dedicated funding portal with completely transparent terms. Smart contract escrow holds all funds securely.' },
                { step: '4', title: 'Funds Are Held', desc: 'Raised funds held in audited smart contracts, not released immediately. Multi-sig governance on fund release.' },
                { step: '5', title: 'Milestone Release', desc: 'As milestones are hit with proof of delivery, funding tranches release. No delivery, no release. Community verification.' },
              ].map(s => (
                <div key={s.step} className="flex items-start gap-3 glass rounded-lg p-3 border border-white/[0.06]">
                  <div className="w-6 h-6 bg-gradient-to-br from-[#0A1EFF] to-[#7C3AED] rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold">{s.step}</div>
                  <div>
                    <p className="text-xs font-semibold text-white">{s.title}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass rounded-xl p-4 border border-[#F59E0B]/10 bg-[#F59E0B]/[0.02] mt-4">
              <p className="text-xs font-heading font-bold text-[#F59E0B] mb-2">Builder Protection Guarantee</p>
              <p className="text-[11px] text-gray-500">If a builder fails to deliver on milestones, remaining funds are returned to investors automatically. No disputes, no legal battles &mdash; the smart contract enforces accountability trustlessly. STEINZ takes a 2-3% fee only on successfully funded and delivered milestones.</p>
            </div>
          </Section>

          <Section id="predictions" number="14" title="Prediction Markets">
            <p>Users create prediction markets on any verifiable on-chain event. Stake tokens on Yes or No outcomes. Percentage bars update in real time. Markets resolve automatically when conditions are met. Correct predictions earn points and token rewards. Inspired by Polymarket but built natively for the on-chain ecosystem.</p>
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

            <div className="grid grid-cols-2 gap-2 mt-4">
              {[
                'Price target predictions',
                'Token listing predictions',
                'Governance vote outcomes',
                'TVL milestone predictions',
                'Chain adoption metrics',
                'Market cap predictions',
                'Leaderboard & rankings',
                'Reward distribution',
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-[11px] text-gray-400">
                  <CheckCircle className="w-3 h-3 text-[#7C3AED] flex-shrink-0" />
                  {f}
                </div>
              ))}
            </div>
          </Section>

          <Section id="project-discovery" number="15" title="Project Discovery">
            <p>STEINZ Project Discovery surfaces real, verified Web3 projects with live market data. Projects are pulled from CoinGecko with a minimum market cap threshold, ensuring quality.</p>

            <div className="glass rounded-xl p-4 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-3">Discovery Features</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'Real-time CoinGecko market data',
                  'Chain-specific filtering (ETH, SOL, BSC, etc.)',
                  'Market cap, volume, and price data',
                  'Verified badge system (gold wavy checkmark)',
                  'Featured projects section',
                  'Token listing submission form',
                  'Category-based browsing',
                  'Price change indicators (24h)',
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-[11px] text-gray-400">
                    <CheckCircle className="w-3 h-3 text-[#10B981] flex-shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-[#0A1EFF]/10 bg-[#0A1EFF]/[0.02] mt-4">
              <p className="text-xs font-heading font-bold text-[#0A1EFF] mb-2">Token Listing Process</p>
              <p className="text-[11px] text-gray-500">Any project can submit a listing request through the built-in form. Submissions include token details, contract address, team info, and social links. All submissions go through STEINZ verification before being listed. Verified projects receive the gold wavy checkmark badge.</p>
            </div>
          </Section>

          <Section id="wallet-system" number="16" title="Non-Custodial Wallet">
            <p>STEINZ includes a built-in non-custodial wallet that gives users full control over their private keys. Create a new wallet with a mnemonic seed phrase, or import an existing wallet. View real balances, send and receive tokens, and manage your assets without leaving the platform.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <Wallet className="w-5 h-5 text-[#0A1EFF] mb-2" />
                <h4 className="text-xs font-heading font-bold text-white mb-2">Create Wallet</h4>
                <ul className="space-y-1 text-[11px] text-gray-500">
                  <li>&bull; Generate BIP-39 mnemonic phrase (12/24 words)</li>
                  <li>&bull; Secure backup confirmation flow</li>
                  <li>&bull; Password-encrypted local storage (AES-256)</li>
                  <li>&bull; Automatic derivation path selection</li>
                </ul>
              </div>
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <Lock className="w-5 h-5 text-[#7C3AED] mb-2" />
                <h4 className="text-xs font-heading font-bold text-white mb-2">Import Wallet</h4>
                <ul className="space-y-1 text-[11px] text-gray-500">
                  <li>&bull; Import via mnemonic phrase or private key</li>
                  <li>&bull; Support for ETH and EVM-compatible chains</li>
                  <li>&bull; Multi-wallet management</li>
                  <li>&bull; Connect to portfolio automatically</li>
                </ul>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-[#10B981]/10 bg-[#10B981]/[0.02] mt-4">
              <p className="text-xs font-heading font-bold text-[#10B981] mb-2">Security Guarantee</p>
              <p className="text-[11px] text-gray-500">Private keys are NEVER transmitted to our servers. All wallet data is encrypted locally on your device with AES-256 encryption. We use the ethers.js library for all cryptographic operations, ensuring industry-standard security. Your keys, your crypto.</p>
            </div>
          </Section>

          <Section id="governance" number="17" title="Governance">
            <p>STEINZ is designed for progressive decentralization. Token holders govern platform decisions through a transparent on-chain voting mechanism.</p>

            <div className="glass rounded-xl p-5 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-3">Governance Scope</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  'New feature prioritization',
                  'Token listing approvals',
                  'Fee structure changes',
                  'Treasury allocation',
                  'Partnership decisions',
                  'Protocol upgrades',
                  'Builder verification standards',
                  'Community initiatives',
                ].map(item => (
                  <div key={item} className="flex items-center gap-2 text-[11px] text-gray-400">
                    <Vote className="w-3 h-3 text-[#7C3AED] flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-2">Governance Process</p>
              <div className="flex items-center gap-2 text-[11px] text-gray-400 flex-wrap">
                <span className="px-2 py-0.5 rounded-full bg-[#0A1EFF]/10 text-[#0A1EFF] text-[10px] font-semibold">Proposal</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="px-2 py-0.5 rounded-full bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] font-semibold">Discussion (7 days)</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="px-2 py-0.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-[10px] font-semibold">Voting (5 days)</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="px-2 py-0.5 rounded-full bg-[#10B981]/10 text-[#10B981] text-[10px] font-semibold">Execution</span>
              </div>
            </div>
          </Section>

          <Section id="unique" number="18" title="Why STEINZ Is Unique">
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
                  <ComparisonRow platform="DeBank" ai="No" security="Limited" builder="No" launchpad="No" multichain="Yes" wallet="Yes" />
                  <ComparisonRow platform="Zapper" ai="No" security="No" builder="No" launchpad="No" multichain="Yes" wallet="No" />
                  <ComparisonRow platform="STEINZ LABS" ai="Full" security="Full Suite" builder="Yes" launchpad="Milestone" multichain="12+" wallet="Yes" highlight />
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
              <div className="glass rounded-xl p-4 border border-[#0A1EFF]/10">
                <h4 className="text-xs font-heading font-bold text-[#0A1EFF] mb-2">Reputation Trading Flywheel</h4>
                <p className="text-[11px] text-gray-500">No other platform connects builder reputation with trading intelligence. When a high-reputation builder launches, Smart Money surfaces it to traders instantly.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-[#7C3AED]/10">
                <h4 className="text-xs font-heading font-bold text-[#7C3AED] mb-2">AI at Chain Speed</h4>
                <p className="text-[11px] text-gray-500">Anthropic&apos;s reasoning capabilities enable sub-second inference on live on-chain events &mdash; a genuine technical moat incumbents cannot easily replicate.</p>
              </div>
              <div className="glass rounded-xl p-4 border border-[#10B981]/10">
                <h4 className="text-xs font-heading font-bold text-[#10B981] mb-2">Security-First Architecture</h4>
                <p className="text-[11px] text-gray-500">Every token scanned before interaction. Every contract analyzed before signing. Every approval monitored. Every swap checked. Security is the foundation, not an add-on.</p>
              </div>
            </div>
          </Section>

          <Section id="business" number="19" title="Business Model & Revenue">
            <p>STEINZ generates revenue through multiple compounding streams, designed to scale with platform adoption:</p>
            <div className="space-y-3 mt-4">
              {[
                { title: 'Premium Subscriptions', desc: 'Free tier covers basic access. Pro ($4/mo) unlocks full wallet intelligence, all security tools, unlimited alerts, advanced VTX AI with web search, and Trading DNA Analyzer. Premium ($15/mo) adds API access and institutional features.', revenue: '~60% of revenue' },
                { title: 'Project Listing Fees', desc: 'Verified projects pay to be discovered. Every submission goes through automated rug check first — only approved projects get listed. Includes featured placement and verified badge.', revenue: '~10% of revenue' },
                { title: 'Swap Fees', desc: 'Transparent 0.1–0.3% fee on every swap. Volume-based revenue that scales with platform adoption. Best price routing ensures users still get optimal execution.', revenue: '~15% of revenue' },
                { title: 'Launchpad Fees', desc: '2–3% platform fee on capital raised through the milestone-gated launchpad. Only charged on funded raises. Aligned with builder success.', revenue: '~10% of revenue' },
                { title: 'API Access', desc: 'Enterprise-grade data access for funds, protocols, and institutions. Custom feeds and white-label intelligence. Usage-based pricing.', revenue: '~5% of revenue' },
              ].map(item => (
                <div key={item.title} className="glass rounded-lg p-4 border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-heading font-bold text-white">{item.title}</h4>
                    <span className="text-[9px] text-[#0A1EFF] font-semibold">{item.revenue}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="team" number="20" title="Team & Partners">
            <p>STEINZ Labs is built by a team of experienced blockchain developers, AI engineers, and security researchers with deep roots in the Web3 ecosystem.</p>

            <div className="glass rounded-xl p-5 border border-white/[0.06] mt-4">
              <p className="text-xs font-heading font-bold text-white mb-3">Core Competencies</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { area: 'Blockchain Engineering', desc: 'Multi-chain smart contract development, DeFi protocol design' },
                  { area: 'AI & Machine Learning', desc: 'NLP, pattern recognition, real-time inference systems' },
                  { area: 'Security Research', desc: 'Smart contract auditing, vulnerability analysis, threat modeling' },
                  { area: 'Product Design', desc: 'UX/UI for complex financial tools, mobile-first design' },
                  { area: 'Data Engineering', desc: 'Real-time data pipelines, blockchain indexing, analytics' },
                  { area: 'Community Building', desc: 'Crypto-native growth, social coordination, governance design' },
                ].map(t => (
                  <div key={t.area} className="glass rounded-lg p-3 border border-white/[0.04]">
                    <p className="text-[10px] font-bold text-[#0A1EFF]">{t.area}</p>
                    <p className="text-[9px] text-gray-500 mt-1">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-[#0A1EFF]/10 bg-[#0A1EFF]/[0.02] mt-4">
              <p className="text-xs font-heading font-bold text-[#0A1EFF] mb-2">Platform Roadmap</p>
              <p className="text-[11px] text-gray-500">STEINZ LABS is continuously evolving. Upcoming features include expanded chain support, institutional-grade analytics, and advanced AI-driven trading signals. Stay tuned for updates.</p>
            </div>
          </Section>

          <Section id="roadmap" number="21" title="Roadmap">
            <div className="space-y-4 mt-4">
              {[
                {
                  phase: 'Phase 1 &mdash; Foundation (Complete)',
                  color: '#10B981',
                  items: ['Context Feed with multi-chain support', 'VTX AI Engine integration', 'Security Center (6 tools)', 'Portfolio Tracker', 'Multi-Chain Swap', 'Trading DNA Analyzer', 'Wallet Intelligence', 'Builder Network & Funding Portal', 'Prediction Markets', 'Project Discovery with real data'],
                },
                {
                  phase: 'Phase 2 &mdash; Growth (In Progress)',
                  color: '#0A1EFF',
                  items: ['Non-Custodial Wallet', 'VTX AI Pro tiers with web search', 'Avalanche chain support', 'Context Feed bookmarks & history', 'TradingView chart integration', 'Token listing submission system', 'Enhanced whitepaper & documentation'],
                },
                {
                  phase: 'Phase 3 &mdash; Expansion (Q1 2026)',
                  color: '#7C3AED',
                  items: ['Full Trading Suite (spot, limit, DCA)', 'Copy Trading Protocol', 'Mobile app (iOS & Android)', 'STEINZ Token launch', 'DAO Governance implementation', 'Institutional API release'],
                },
                {
                  phase: 'Phase 4 &mdash; Ecosystem (Q2-Q3 2026)',
                  color: '#F59E0B',
                  items: ['STEINZ Earn Layer', 'Cross-Chain Bridge', 'Community Sentiment Dashboard', 'Insider Threat Alert System', 'White-label solutions', 'Global expansion'],
                },
              ].map(p => (
                <div key={p.phase} className="glass rounded-xl p-4 border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full" style={{ background: p.color }}></div>
                    <p className="text-xs font-heading font-bold" style={{ color: p.color }} dangerouslySetInnerHTML={{ __html: p.phase }}></p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {p.items.map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: p.color }} />
                        <span className="text-[10px] text-gray-400">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section id="legal" number="22" title="Legal & Compliance">
            <p>STEINZ Labs operates with full transparency regarding regulatory obligations and user protections.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <h4 className="text-xs font-heading font-bold text-white mb-2">User Protections</h4>
                <ul className="space-y-1 text-[10px] text-gray-500">
                  <li>&bull; Non-custodial architecture &mdash; we never hold user funds</li>
                  <li>&bull; No KYC required for basic features</li>
                  <li>&bull; GDPR-compliant data handling</li>
                  <li>&bull; Right to data deletion</li>
                  <li>&bull; Transparent fee structure with no hidden charges</li>
                </ul>
              </div>
              <div className="glass rounded-xl p-4 border border-white/[0.06]">
                <h4 className="text-xs font-heading font-bold text-white mb-2">Disclaimers</h4>
                <ul className="space-y-1 text-[10px] text-gray-500">
                  <li>&bull; STEINZ does not provide financial advice</li>
                  <li>&bull; AI signals are informational, not recommendations</li>
                  <li>&bull; Past performance does not indicate future results</li>
                  <li>&bull; Users are responsible for their own trading decisions</li>
                  <li>&bull; Cryptocurrency investments carry inherent risk</li>
                </ul>
              </div>
            </div>
          </Section>

          <div className="glass rounded-2xl p-8 border border-[#0A1EFF]/10 bg-gradient-to-b from-[#0A1EFF]/[0.03] to-transparent text-center mt-8">
            <h3 className="text-xl font-heading font-bold mb-3">Ready to Experience the Future?</h3>
            <p className="text-sm text-gray-400 mb-6">STEINZ Labs &mdash; The intelligence infrastructure layer for the on-chain economy.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <Link href="/dashboard">
                <button className="bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] px-8 py-3 rounded-xl font-semibold text-sm hover:scale-[1.03] transition-all shimmer-btn shadow-xl shadow-[#0A1EFF]/20 inline-flex items-center gap-2">
                  Launch Platform <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link href="/dashboard/pricing">
                <button className="glass px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/10 transition-all border border-white/10 inline-flex items-center gap-2">
                  View Pricing
                </button>
              </Link>
            </div>
          </div>

          <div className="text-center mt-8 text-gray-600 text-[11px]">
            &copy; 2026 STEINZ LABS. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
