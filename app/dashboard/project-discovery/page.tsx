'use client';

import { useState, useMemo } from 'react';
import { Search, CheckCircle, Users, DollarSign, Rocket, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Project {
  name: string;
  slug: string;
  description: string;
  category: string;
  teamSize: number;
  funding: string;
  stage: string;
  verified: boolean;
}

const PROJECTS: Project[] = [
  { name: 'SolSwap Pro', slug: 'solswap-pro', description: 'Next-gen DEX with AI-powered routing on Solana', category: 'DeFi', teamSize: 8, funding: '$1.2M', stage: 'Mainnet', verified: true },
  { name: 'MetaRealm', slug: 'metarealm', description: 'MMORPG with player-owned economies and NFT items', category: 'Gaming', teamSize: 15, funding: '$3.5M', stage: 'Beta', verified: true },
  { name: 'ChainGuard', slug: 'chainguard', description: 'Real-time smart contract monitoring and exploit detection', category: 'Security', teamSize: 6, funding: '$800K', stage: 'Live', verified: true },
  { name: 'SocialFi Hub', slug: 'socialfi-hub', description: 'Web3 social network with token-gated communities', category: 'Social', teamSize: 10, funding: '$2M', stage: 'Alpha', verified: false },
  { name: 'NFT Marketplace X', slug: 'nft-marketplace-x', description: 'Multi-chain NFT marketplace with AI pricing', category: 'NFT', teamSize: 7, funding: '$1.5M', stage: 'Mainnet', verified: true },
  { name: 'DeFi Pulse', slug: 'defi-pulse', description: 'Advanced DeFi analytics and portfolio tracking', category: 'Analytics', teamSize: 4, funding: '$500K', stage: 'Beta', verified: false },
];

const FILTERS = ['All', 'Verified', 'Trending', 'New', 'Gaming', 'DeFi', 'NFT', 'AI'];

const CATEGORY_COLORS: Record<string, string> = {
  DeFi: 'bg-[#7C3AED]/20 text-[#7C3AED]',
  Gaming: 'bg-[#EF4444]/20 text-[#EF4444]',
  Security: 'bg-[#10B981]/20 text-[#10B981]',
  Social: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  NFT: 'bg-[#00E5FF]/20 text-[#00E5FF]',
  Analytics: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
  AI: 'bg-[#06B6D4]/20 text-[#06B6D4]',
};

export default function ProjectDiscoveryPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let result = PROJECTS;
    if (activeFilter === 'Verified') result = result.filter((p) => p.verified);
    else if (activeFilter !== 'All' && activeFilter !== 'Trending' && activeFilter !== 'New')
      result = result.filter((p) => p.category === activeFilter);
    if (searchQuery.trim())
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return result;
  }, [activeFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="px-4 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Search className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-xl font-heading font-bold">Project Discovery</h1>
        </div>
        <p className="text-gray-400 text-xs mb-4">Find verified Web3 projects and talent</p>

        <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-2 mb-4">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects, builders, skills..."
            className="bg-transparent focus:outline-none text-sm w-full text-gray-300 placeholder-gray-500"
          />
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeFilter === f
                  ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                  : 'bg-[#111827] text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((project) => (
            <div
              key={project.slug}
              className="glass rounded-xl p-4 border border-white/10 hover:border-[#00E5FF]/30 transition-all hover:scale-[1.02] glow-card"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-bold">{project.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold truncate">{project.name}</h3>
                    {project.verified && <CheckCircle className="w-3.5 h-3.5 text-[#00E5FF] flex-shrink-0" />}
                  </div>
                  <p className="text-gray-400 text-[11px] leading-relaxed line-clamp-2">{project.description}</p>
                </div>
              </div>

              <div className="mb-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLORS[project.category] || 'bg-gray-500/20 text-gray-400'}`}>
                  {project.category}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {project.teamSize} members</span>
                <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {project.funding}</span>
                <span className="flex items-center gap-1"><Rocket className="w-3 h-3" /> {project.stage}</span>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-1.5 rounded-lg border border-[#00E5FF]/30 text-[#00E5FF] text-[11px] font-semibold hover:bg-[#00E5FF]/10 transition-colors">
                  View Details
                </button>
                <button className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-[11px] font-semibold hover:scale-105 transition-transform">
                  Contact Team
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">No projects found matching your search.</div>
        )}
      </div>
    </div>
  );
}
