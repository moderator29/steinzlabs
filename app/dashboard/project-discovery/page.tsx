'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, CheckCircle, TrendingUp, ExternalLink, ArrowLeft, RefreshCw, Zap } from 'lucide-react';
import Link from 'next/link';

interface Project {
  name: string;
  symbol: string;
  slug: string;
  description: string;
  category: string;
  price: string;
  priceChange24h: string;
  marketCap: string;
  thumb: string;
  verified: boolean;
  source: string;
  url?: string;
}

const FILTERS = ['All', 'Trending', 'DexScreener', 'Verified'];

const CATEGORY_COLORS: Record<string, string> = {
  Trending: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  DexScreener: 'bg-[#00E5FF]/20 text-[#00E5FF]',
};

export default function ProjectDiscoveryPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/project-discovery');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    let result = projects;
    if (activeFilter === 'Verified') result = result.filter((p) => p.verified);
    else if (activeFilter === 'Trending') result = result.filter((p) => p.category === 'Trending');
    else if (activeFilter === 'DexScreener') result = result.filter((p) => p.category === 'DexScreener');
    if (searchQuery.trim())
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    return result;
  }, [activeFilter, searchQuery, projects]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="px-4 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-[#00E5FF]" />
            <h1 className="text-xl font-heading font-bold">Project Discovery</h1>
          </div>
          <button
            onClick={fetchProjects}
            disabled={loading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-gray-400 text-xs mb-4">Live trending tokens from CoinGecko & DexScreener</p>

        <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-2 mb-4">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tokens, projects..."
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

        {loading && projects.length === 0 ? (
          <div className="text-center py-20">
            <RefreshCw className="w-8 h-8 text-[#00E5FF] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-400">Loading live projects...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((project, i) => {
              const changeNum = parseFloat(project.priceChange24h);
              const isPositive = changeNum > 0;
              return (
                <div
                  key={`${project.slug}-${i}`}
                  className="glass rounded-xl p-4 border border-white/10 hover:border-[#00E5FF]/30 transition-all hover:scale-[1.02] glow-card"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#111827] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {project.thumb ? (
                        <img src={project.thumb} alt="" className="w-7 h-7 rounded-full" />
                      ) : (
                        <Zap className="w-4 h-4 text-[#00E5FF]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold truncate">{project.name}</h3>
                        <span className="text-[10px] text-gray-500">{project.symbol}</span>
                        {project.verified && <CheckCircle className="w-3.5 h-3.5 text-[#00E5FF] flex-shrink-0" />}
                      </div>
                      <p className="text-gray-400 text-[11px] leading-relaxed line-clamp-2">{project.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLORS[project.category] || 'bg-gray-500/20 text-gray-400'}`}>
                      {project.category}
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-300 font-mono">{project.price}</span>
                      {project.priceChange24h !== '0' && (
                        <span className={`flex items-center gap-0.5 font-semibold ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          <TrendingUp className={`w-3 h-3 ${!isPositive ? 'rotate-180' : ''}`} />
                          {isPositive ? '+' : ''}{project.priceChange24h}%
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {project.url ? (
                      <a
                        href={project.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 rounded-lg border border-[#00E5FF]/30 text-[#00E5FF] text-[11px] font-semibold hover:bg-[#00E5FF]/10 transition-colors flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> View
                      </a>
                    ) : (
                      <a
                        href={`https://www.coingecko.com/en/coins/${project.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-1.5 rounded-lg border border-[#00E5FF]/30 text-[#00E5FF] text-[11px] font-semibold hover:bg-[#00E5FF]/10 transition-colors flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Details
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">No projects found matching your search.</div>
        )}
      </div>
    </div>
  );
}
