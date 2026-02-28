'use client';

import { Compass, Search, CheckCircle, Users, DollarSign, Rocket, ArrowRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface Project {
  name: string;
  description: string;
  category: string;
  teamSize: number;
  funding: string;
  stage: string;
  verified: boolean;
}

const PROJECTS: Project[] = [
  { name: 'SolSwap Pro', description: 'Next-gen DEX with AI-powered routing on Solana', category: 'DeFi', teamSize: 8, funding: '$1.2M', stage: 'Mainnet', verified: true },
  { name: 'MetaRealm', description: 'MMORPG with player-owned economies and NFT items', category: 'Gaming', teamSize: 15, funding: '$3.5M', stage: 'Beta', verified: true },
  { name: 'ChainGuard', description: 'Real-time smart contract monitoring and exploit detection', category: 'Security', teamSize: 6, funding: '$800K', stage: 'Live', verified: true },
  { name: 'SocialFi Hub', description: 'Web3 social network with token-gated communities', category: 'Social', teamSize: 10, funding: '$2M', stage: 'Alpha', verified: false },
  { name: 'NFT Marketplace X', description: 'Multi-chain NFT marketplace with AI pricing', category: 'NFT', teamSize: 7, funding: '$1.5M', stage: 'Mainnet', verified: true },
  { name: 'DeFi Pulse', description: 'Advanced DeFi analytics and portfolio tracking', category: 'Analytics', teamSize: 4, funding: '$500K', stage: 'Beta', verified: false },
];

const FILTERS = ['All', 'Verified', 'DeFi', 'Gaming', 'NFT'];

const CAT_COLORS: Record<string, string> = {
  DeFi: 'bg-[#7C3AED]/20 text-[#7C3AED]', Gaming: 'bg-[#EF4444]/20 text-[#EF4444]',
  Security: 'bg-[#10B981]/20 text-[#10B981]', Social: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  NFT: 'bg-[#00E5FF]/20 text-[#00E5FF]', Analytics: 'bg-[#8B5CF6]/20 text-[#8B5CF6]',
};

export default function DiscoverTab() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const router = useRouter();

  const filtered = useMemo(() => {
    let result = PROJECTS;
    if (filter === 'Verified') result = result.filter((p) => p.verified);
    else if (filter !== 'All') result = result.filter((p) => p.category === filter);
    if (search.trim()) result = result.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase()));
    return result;
  }, [filter, search]);

  return (
    <div>
      <div className="text-center mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-xl flex items-center justify-center mx-auto mb-2">
          <Compass className="w-6 h-6 text-[#00E5FF]" />
        </div>
        <h2 className="text-lg font-heading font-bold mb-0.5">Project Discovery</h2>
        <p className="text-gray-400 text-xs">Find verified Web3 projects and talent</p>
      </div>

      <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-2 mb-3">
        <Search className="w-4 h-4 text-gray-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500" />
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((project) => (
          <div key={project.name} className="glass rounded-xl p-3 border border-white/10 hover:border-[#00E5FF]/20 transition-all">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold">{project.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-bold truncate">{project.name}</span>
                  {project.verified && <CheckCircle className="w-3 h-3 text-[#00E5FF] flex-shrink-0" />}
                </div>
                <p className="text-[10px] text-gray-500 line-clamp-1 mb-1.5">{project.description}</p>
                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${CAT_COLORS[project.category] || 'bg-gray-500/20 text-gray-400'}`}>{project.category}</span>
                  <span className="flex items-center gap-0.5"><Users className="w-2.5 h-2.5" /> {project.teamSize}</span>
                  <span className="flex items-center gap-0.5"><DollarSign className="w-2.5 h-2.5" /> {project.funding}</span>
                  <span className="flex items-center gap-0.5"><Rocket className="w-2.5 h-2.5" /> {project.stage}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/dashboard/project-discovery')}
        className="w-full mt-3 py-2.5 rounded-lg border border-white/10 text-xs font-semibold text-[#00E5FF] hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
      >
        View All Projects <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
