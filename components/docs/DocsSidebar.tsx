'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

export interface DocSection {
  id: string;
  number: string;
  label: string;
  subsections?: { id: string; label: string }[];
}

export const DOC_SECTIONS: DocSection[] = [
  { id: 'getting-started', number: '01', label: 'Getting Started' },
  { id: 'platform-overview', number: '02', label: 'Platform Overview' },
  { id: 'context-feed', number: '03', label: 'Context Feed', subsections: [
    { id: 'context-feed-signals', label: 'Signal Types' },
    { id: 'context-feed-filters', label: 'Filters & Sorting' },
  ]},
  { id: 'vtx-ai-engine', number: '04', label: 'VTX AI Engine', subsections: [
    { id: 'vtx-predictions', label: 'Price Predictions' },
    { id: 'vtx-pattern', label: 'Pattern Recognition' },
  ]},
  { id: 'wallet-intelligence', number: '05', label: 'Wallet Intelligence', subsections: [
    { id: 'wallet-dna', label: 'Trading DNA' },
    { id: 'wallet-clusters', label: 'Cluster Detection' },
  ]},
  { id: 'security-center', number: '06', label: 'Security Center', subsections: [
    { id: 'shadow-guardian', label: 'Shadow Guardian' },
    { id: 'rug-detection', label: 'Rug Detection' },
  ]},
  { id: 'multi-chain-swap', number: '07', label: 'Multi-Chain Swap', subsections: [
    { id: 'swap-routing', label: 'Routing Engine' },
    { id: 'mev-protection', label: 'MEV Protection' },
  ]},
  { id: 'smart-money', number: '08', label: 'Smart Money Tracking' },
  { id: 'portfolio', number: '09', label: 'Portfolio & Analytics' },
  { id: 'api-reference', number: '10', label: 'API Reference', subsections: [
    { id: 'api-auth', label: 'Authentication' },
    { id: 'api-endpoints', label: 'Endpoints' },
    { id: 'api-rate-limits', label: 'Rate Limits' },
  ]},
];

interface DocsSidebarProps {
  activeSection: string;
}

export function DocsSidebar({ activeSection }: DocsSidebarProps) {
  return (
    <nav className="w-64 flex-shrink-0">
      <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 scrollbar-thin">
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-[#1E2433]">
          <BookOpen className="w-4 h-4 text-[#0A1EFF]" />
          <span className="text-sm font-bold text-white">Documentation</span>
        </div>
        <ul className="space-y-0.5">
          {DOC_SECTIONS.map(section => {
            const isActive = activeSection === section.id ||
              section.subsections?.some(s => s.id === activeSection);
            return (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all group ${
                    activeSection === section.id
                      ? 'bg-[#0A1EFF]/15 text-[#0A1EFF] font-medium'
                      : 'text-gray-400 hover:text-white hover:bg-[#1E2433]'
                  }`}
                >
                  <span className="text-xs font-mono text-gray-600 group-hover:text-gray-400 w-5">{section.number}</span>
                  <span className="flex-1">{section.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 text-[#0A1EFF]" />}
                </a>
                {isActive && section.subsections && (
                  <ul className="ml-8 mt-0.5 space-y-0.5">
                    {section.subsections.map(sub => (
                      <li key={sub.id}>
                        <a
                          href={`#${sub.id}`}
                          className={`block px-3 py-1.5 rounded-lg text-xs transition-all ${
                            activeSection === sub.id
                              ? 'text-[#0A1EFF] font-medium'
                              : 'text-gray-500 hover:text-gray-300'
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
        <div className="mt-6 pt-4 border-t border-[#1E2433]">
          <Link href="/whitepaper" className="flex items-center gap-2 text-xs text-gray-500 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-[#1E2433]">
            <BookOpen className="w-3.5 h-3.5" />
            View Whitepaper
          </Link>
        </div>
      </div>
    </nav>
  );
}
