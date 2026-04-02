'use client';

import { Search, TrendingUp, ExternalLink, RotateCcw, Zap, Star, Plus } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Project {
  name: string;
  symbol: string;
  slug: string;
  description: string;
  category: string;
  price: string;
  priceChange24h: string;
  marketCap: string;
  volume24h: string;
  thumb: string;
  verified: boolean;
  pinned: boolean;
  source: string;
  chain: string;
  dexUrl: string;
}

const FILTERS = ['All', 'Trending', 'DexScreener', 'Verified'];

const CATEGORY_COLORS: Record<string, string> = {
  Trending: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  DexScreener: 'bg-[#0A1EFF]/20 text-[#0A1EFF]',
  Pinned: 'bg-gradient-to-r from-[#FFD700]/20 to-[#FF6B00]/20 text-[#FFD700]',
};

const CHAIN_COLORS: Record<string, string> = {
  ethereum: 'bg-[#627EEA]/20 text-[#627EEA]',
  solana: 'bg-[#9945FF]/20 text-[#9945FF]',
  bsc: 'bg-[#F3BA2F]/20 text-[#F3BA2F]',
  polygon: 'bg-[#8247E5]/20 text-[#8247E5]',
  avalanche: 'bg-[#E84142]/20 text-[#E84142]',
  base: 'bg-[#0052FF]/20 text-[#0052FF]',
};

export default function DiscoverTab() {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/project-discovery');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 60000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const filtered = useMemo(() => {
    let result = projects;
    if (filter === 'Verified') result = result.filter((p) => p.verified);
    else if (filter !== 'All') result = result.filter((p) => p.category === filter);
    if (search.trim()) result = result.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.symbol.toLowerCase().includes(search.toLowerCase()));
    const pinned = result.filter(p => p.pinned);
    const rest = result.filter(p => !p.pinned);
    return [...pinned, ...rest].slice(0, 15);
  }, [filter, search, projects]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-[#0A1EFF]" />
          </div>
          <div>
            <h2 className="text-sm font-heading font-bold">Project Discovery</h2>
            <p className="text-gray-500 text-[10px]">Live coins across all chains</p>
          </div>
        </div>
        <button onClick={fetchProjects} disabled={loading} className="p-1.5 hover:bg-white/10 rounded-lg transition-all group">
          <RotateCcw className={`w-3.5 h-3.5 text-[#0A1EFF] ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
        </button>
      </div>

      <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-2 mb-3">
        <Search className="w-4 h-4 text-gray-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tokens..." className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500" />
      </div>

      <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
            {f}
          </button>
        ))}
      </div>

      {loading && projects.length === 0 ? (
        <div className="text-center py-10">
          <RotateCcw className="w-6 h-6 text-[#0A1EFF] mx-auto mb-2 animate-spin" />
          <p className="text-xs text-gray-400">Loading live projects...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((project, i) => {
            const changeNum = parseFloat(project.priceChange24h);
            const isPositive = changeNum > 0;
            return (
              <div key={`${project.slug}-${i}`} className={`glass rounded-xl p-3 border transition-all ${
                project.pinned ? 'border-[#FFD700]/30 bg-gradient-to-r from-[#FFD700]/5 to-transparent' : 'border-white/10 hover:border-[#0A1EFF]/20'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {project.thumb ? (
                      <img src={project.thumb} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-[#0A1EFF]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {project.pinned && <Star className="w-2.5 h-2.5 text-[#FFD700] fill-[#FFD700] flex-shrink-0" />}
                      <span className="text-xs font-bold truncate">{project.name}</span>
                      <span className="text-[9px] text-gray-500">{project.symbol}</span>
                      {project.verified && <img src="/verified-badge-new.png" alt="Verified" className="w-3.5 h-3.5 flex-shrink-0" />}
                    </div>
                    <p className="text-[10px] text-gray-500 line-clamp-1 mb-1">{project.description}</p>
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${CATEGORY_COLORS[project.category] || 'bg-gray-500/20 text-gray-400'}`}>{project.category}</span>
                      {project.chain && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${CHAIN_COLORS[project.chain] || 'bg-gray-500/20 text-gray-400'}`}>{project.chain}</span>
                      )}
                      <span className="text-gray-400 font-mono">{project.price}</span>
                      {project.priceChange24h !== '0' && (
                        <span className={`flex items-center gap-0.5 font-semibold ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          <TrendingUp className={`w-2.5 h-2.5 ${!isPositive ? 'rotate-180' : ''}`} />
                          {isPositive ? '+' : ''}{project.priceChange24h}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => router.push('/dashboard/project-discovery')}
          className="flex-1 py-2 rounded-lg border border-white/10 text-xs font-semibold text-[#0A1EFF] hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
        >
          View All <ExternalLink className="w-3 h-3" />
        </button>
        <button
          onClick={() => router.push('/dashboard/project-discovery')}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#0A1EFF] to-[#7C3AED] text-xs font-semibold flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> List Token
        </button>
      </div>
    </div>
  );
}
