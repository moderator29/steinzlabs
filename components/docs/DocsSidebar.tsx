'use client';

import Link from 'next/link';
import { BookOpen, ChevronRight, FileText } from 'lucide-react';

export interface DocSection {
  id: string;
  number: string;
  label: string;
  subsections?: { id: string; label: string }[];
}

export const DOC_SECTIONS: DocSection[] = [
  { id: 'getting-started', number: '01', label: 'Getting Started' },
  { id: 'platform-overview', number: '02', label: 'Platform Overview', subsections: [
    { id: 'overview-features', label: 'Feature Categories' },
    { id: 'overview-chains', label: 'Supported Chains' },
  ]},
  { id: 'context-feed', number: '03', label: 'Context Feed', subsections: [
    { id: 'context-signals', label: 'Signal Types' },
    { id: 'context-trust', label: 'Trust Score' },
  ]},
  { id: 'vtx-ai', number: '04', label: 'VTX AI Engine', subsections: [
    { id: 'vtx-capabilities', label: 'Capabilities' },
    { id: 'vtx-usage', label: 'How to Use It' },
  ]},
  { id: 'wallet-intelligence', number: '05', label: 'Wallet Intelligence', subsections: [
    { id: 'dna-analyzer', label: 'DNA Analyzer' },
    { id: 'wallet-clusters', label: 'Wallet Clusters' },
    { id: 'network-graph', label: 'Network Graph' },
  ]},
  { id: 'security-center', number: '06', label: 'Security Center', subsections: [
    { id: 'trust-score', label: 'Token Trust Score' },
    { id: 'shadow-guardian', label: 'Shadow Guardian' },
    { id: 'domain-shield', label: 'Domain Shield' },
  ]},
  { id: 'trading-suite', number: '07', label: 'Trading Suite', subsections: [
    { id: 'swap-engine', label: 'Multi-Chain Swap' },
    { id: 'copy-trading', label: 'Copy Trading' },
    { id: 'sniper-bot', label: 'Sniper Bot' },
  ]},
  { id: 'smart-money', number: '08', label: 'Smart Money & Whales', subsections: [
    { id: 'smart-money-tracking', label: 'Smart Money Tracking' },
    { id: 'whale-tracker', label: 'Whale Tracker' },
  ]},
  { id: 'portfolio', number: '09', label: 'Portfolio & Analytics', subsections: [
    { id: 'portfolio-tracker', label: 'Portfolio Tracker' },
    { id: 'predictions', label: 'Predictions' },
  ]},
  { id: 'alerts-notifications', number: '10', label: 'Alerts & Notifications', subsections: [
    { id: 'price-alerts', label: 'Price Alerts' },
    { id: 'push-notifications', label: 'Push Notifications' },
  ]},
  { id: 'telegram-bot', number: '11', label: 'Telegram Bot', subsections: [
    { id: 'bot-connect', label: 'Connecting Your Account' },
    { id: 'bot-commands', label: 'Commands by Tier' },
    { id: 'bot-notifications', label: 'Automatic Notifications' },
  ]},
  { id: 'coming-soon', number: '12', label: 'Coming Soon', subsections: [
    { id: 'roadmap-wallet', label: 'Naka Wallet upgrades' },
    { id: 'roadmap-trading', label: 'Advanced trading' },
    { id: 'roadmap-social', label: 'Social & sharing' },
  ]},
  { id: 'about', number: '13', label: 'About & Support', subsections: [
    { id: 'about-mission', label: 'Our mission' },
    { id: 'about-what-we-do', label: 'What Naka Labs does' },
    { id: 'about-wallet', label: 'Naka Wallet' },
    { id: 'about-help', label: 'Help Center' },
  ]},
];

interface DocsSidebarProps {
  activeSection: string;
  onSectionClick?: () => void;
}

export function DocsSidebar({ activeSection, onSectionClick }: DocsSidebarProps) {
  return (
    <nav>
      <ul className="space-y-0.5">
        {DOC_SECTIONS.map(section => {
          const isActive = activeSection === section.id ||
            section.subsections?.some(s => s.id === activeSection);
          const isExact = activeSection === section.id;

          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={onSectionClick}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all group ${
                  isExact
                    ? 'bg-[#0A1EFF]/15 text-[#4D6BFF] font-semibold'
                    : isActive
                    ? 'text-gray-200'
                    : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'
                }`}
              >
                <span className="text-[10px] font-mono text-gray-600 w-5 flex-shrink-0">{section.number}</span>
                <span className="flex-1 text-sm">{section.label}</span>
                {isExact && <ChevronRight className="w-3 h-3 text-[#4D6BFF] flex-shrink-0" />}
              </a>
              {isActive && section.subsections && (
                <ul className="ml-7 mt-0.5 space-y-0.5 mb-1">
                  {section.subsections.map(sub => (
                    <li key={sub.id}>
                      <a
                        href={`#${sub.id}`}
                        onClick={onSectionClick}
                        className={`block px-3 py-1.5 rounded-lg text-xs transition-all ${
                          activeSection === sub.id
                            ? 'text-[#4D6BFF] font-medium'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                        }`}
                      >
                        {sub.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-6 pt-5 border-t border-white/[0.06]">
        <Link
          href="/whitepaper"
          onClick={onSectionClick}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.04]"
        >
          <FileText className="w-3.5 h-3.5" />
          View Whitepaper
        </Link>
      </div>
    </nav>
  );
}
