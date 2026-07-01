'use client';

import Link from 'next/link';
import {
  Shield, Search, Globe, FileCode, FileSearch, KeyRound, Target,
  Gavel, Fingerprint, PieChart, Wallet, Plug, ArrowRight, type LucideIcon,
} from 'lucide-react';
import { SecurityHealthCard } from '@/components/security/SecurityHealthCard';
import { LiveThreatFeed } from '@/components/security/LiveThreatFeed';
import { HealthTrendCard } from '@/components/security/HealthTrendCard';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { securityCenterHowItWorks } from '@/lib/howItWorks/content/security';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { TiltCard } from '@/components/brand/TiltCard';

interface Tool {
  href: string;
  label: string;
  blurb: string;
  Icon: LucideIcon;
  /** Real data sources this tool wires to, shown as honest provenance chips. */
  sources: string[];
  accent: string;
}

/**
 * Security Center hub. Each card routes to a real, already-built tool backed by
 * live data. No fabricated status or numbers are rendered here; the cards are
 * pure navigation surfaces whose source chips name the actual upstream providers
 * each tool consults.
 */
const TOOLS: Tool[] = [
  {
    href: '/dashboard/security/token-scanner',
    label: 'Token Scanner',
    blurb: 'Full contract security scan: honeypot risk, taxes, ownership, mint and proxy flags.',
    Icon: Search,
    sources: ['GoPlus', 'DexScreener'],
    accent: '#0066FF',
  },
  {
    href: '/dashboard/security/clone-scan',
    label: 'Clone & Honeypot Scan',
    blurb: 'Bytecode similarity to known rugs, multi-source honeypot triangulation and deployer rug history.',
    Icon: Fingerprint,
    sources: ['Bytecode DB', 'GoPlus', 'Honeypot.is', 'RugCheck'],
    accent: '#8B7CFF',
  },
  {
    href: '/dashboard/security/sanctions',
    label: 'OFAC Sanctions Check',
    blurb: 'Screen any wallet or contract against the live Chainalysis OFAC sanctioned-address list.',
    Icon: Gavel,
    sources: ['Chainalysis OFAC'],
    accent: '#F59E0B',
  },
  {
    href: '/dashboard/domain-shield',
    label: 'Domain Shield',
    blurb: 'Multi-source phishing detection: threat intel, community blocklist and registration age.',
    Icon: Globe,
    sources: ['GoPlus', 'MetaMask list', 'RDAP'],
    accent: '#0066FF',
  },
  {
    href: '/dashboard/signature-insight',
    label: 'Signature Insight',
    blurb: 'Decode raw transaction calldata before you sign so you know exactly what it does.',
    Icon: FileCode,
    sources: ['GoPlus', '4byte', 'OpenChain'],
    accent: '#8B7CFF',
  },
  {
    href: '/dashboard/contract-analyzer',
    label: 'Contract Analyzer',
    blurb: 'Deep contract breakdown with related wallets and similar tokens for context.',
    Icon: FileSearch,
    sources: ['GoPlus', 'Anthropic', 'DexScreener'],
    accent: '#0066FF',
  },
  {
    href: '/dashboard/security/approvals',
    label: 'Approval Manager',
    blurb: 'See every token allowance you have granted and revoke risky spenders in batch.',
    Icon: KeyRound,
    sources: ['Alchemy', 'GoPlus', 'Permit2'],
    accent: '#10B981',
  },
  {
    href: '/dashboard/security/portfolio-risk',
    label: 'Portfolio Risk',
    blurb: 'Scan every token in your connected wallet for security risk in one pass.',
    Icon: PieChart,
    sources: ['GoPlus', 'Wallet balances'],
    accent: '#F97316',
  },
  {
    href: '/dashboard/security/wallet-analysis',
    label: 'Wallet Analysis',
    blurb: 'Reputation and threat profile for any wallet address before you interact.',
    Icon: Wallet,
    sources: ['GoPlus', 'On-chain history'],
    accent: '#8B7CFF',
  },
  {
    href: '/dashboard/security/connected-dapps',
    label: 'Connected Apps',
    blurb: 'Review the dApps your wallet is connected to and where active sessions exist.',
    Icon: Plug,
    sources: ['Session registry'],
    accent: '#0066FF',
  },
];

export default function SecurityPage() {
  return (
    <AuroraBackground fullHeight className="text-white">
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 nl-fade-up">
          <h1 className="text-base font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#0066FF]" aria-hidden="true" /> Security Center
          </h1>
          <HowItWorksButton content={securityCenterHowItWorks} className="ms-auto shrink-0" />
        </div>

        {/* Live composite health score, breach banner and 2FA CTA · real data. */}
        <SecurityHealthCard />

        {/* Live threat feed + health-score trend, both backed by real per-user
            rows with honest empty / single-snapshot states. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 nl-fade-up nl-fade-up-1">
          <LiveThreatFeed />
          <HealthTrendCard />
        </div>

        <div className="flex items-center justify-between nl-fade-up nl-fade-up-2">
          <div>
            <h2 className="text-sm font-bold">Security tools</h2>
            <p className="text-[11px] text-gray-500">Every tool is backed by live data. Nothing here is simulated.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 nl-fade-up nl-fade-up-3">
          {TOOLS.map((tool) => (
            <TiltCard key={tool.href} max={6}>
              <Link
                href={tool.href}
                className="nl-glass nl-glass--interactive rounded-2xl p-4 flex flex-col gap-3 h-full group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${tool.accent}1A` }}
                  >
                    <tool.Icon className="w-5 h-5" style={{ color: tool.accent }} aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold">{tool.label}</h3>
                      <ArrowRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed mt-0.5">{tool.blurb}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-auto">
                  {tool.sources.map((s) => (
                    <span
                      key={s}
                      className="text-[9px] font-medium text-gray-400 bg-white/[0.04] border border-white/5 rounded-md px-1.5 py-0.5"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </Link>
            </TiltCard>
          ))}
        </div>

        <Link
          href="/dashboard/risk-scanner"
          className="nl-glass nl-glass--interactive rounded-2xl p-4 flex items-center gap-3 nl-fade-up nl-fade-up-4 group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-[#EF4444]" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold">Risk Scanner</h3>
            <p className="text-[11px] text-gray-500">Run the full pre-trade risk pipeline on any token before you ape in.</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-white transition-colors" aria-hidden="true" />
        </Link>
      </div>
    </AuroraBackground>
  );
}
