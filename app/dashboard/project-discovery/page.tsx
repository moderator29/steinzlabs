'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, TrendingUp, ExternalLink, ArrowLeft, RefreshCw, Zap, Plus, X, Send, Globe, MessageCircle, Star } from 'lucide-react';
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
  marketCapRaw: number;
  volume24h: string;
  liquidity: string;
  thumb: string;
  verified: boolean;
  pinned: boolean;
  source: string;
  chain: string;
  dexUrl: string;
}

const CHAINS = [
  { id: 'all', label: 'All Chains' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'solana', label: 'Solana' },
  { id: 'bsc', label: 'BSC' },
  { id: 'base', label: 'Base' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'avalanche', label: 'Avalanche' },
];

const FILTERS = ['All', 'Trending', 'DexScreener', 'Verified', 'Pinned'];

const CATEGORY_COLORS: Record<string, string> = {
  Trending: 'bg-[#F59E0B]/20 text-[#F59E0B]',
  DexScreener: 'bg-[#00E5FF]/20 text-[#00E5FF]',
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

export default function ProjectDiscoveryPage() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [activeChain, setActiveChain] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showListingForm, setShowListingForm] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/project-discovery?chain=${activeChain}`);
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }, [activeChain]);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(fetchProjects, 60000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const filtered = useMemo(() => {
    let result = projects;
    if (activeFilter === 'Verified') result = result.filter((p) => p.verified);
    else if (activeFilter === 'Trending') result = result.filter((p) => p.category === 'Trending');
    else if (activeFilter === 'DexScreener') result = result.filter((p) => p.category === 'DexScreener');
    else if (activeFilter === 'Pinned') result = result.filter((p) => p.pinned);
    if (searchQuery.trim())
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    const pinned = result.filter(p => p.pinned);
    const rest = result.filter(p => !p.pinned);
    return [...pinned, ...rest];
  }, [activeFilter, searchQuery, projects]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="px-4 pt-6 max-w-6xl mx-auto">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-[#00E5FF]" />
            </div>
            <div>
              <h1 className="text-xl font-heading font-bold">Project Discovery</h1>
              <p className="text-gray-400 text-[10px]">Real-time coins &gt;500K market cap across all chains</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowListingForm(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-lg text-[11px] font-bold flex items-center gap-1 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3 h-3" /> List Token
            </button>
            <button
              onClick={fetchProjects}
              disabled={loading}
              className="p-2 hover:bg-white/10 rounded-lg transition-all group"
            >
              <RefreshCw className={`w-4 h-4 text-[#00E5FF] transition-transform ${loading ? 'animate-spin' : 'group-hover:rotate-180 duration-500'}`} />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mt-4 mb-3 overflow-x-auto scrollbar-hide pb-1">
          {CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChain(c.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${
                activeChain === c.id
                  ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                  : 'bg-[#111827] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-2 mb-3">
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
            {filtered.map((project, i) => (
              <ProjectCard key={`${project.slug}-${i}`} project={project} />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">No projects found matching your search.</div>
        )}
      </div>

      {showListingForm && <ListingFormModal onClose={() => setShowListingForm(false)} />}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const changeNum = parseFloat(project.priceChange24h);
  const isPositive = changeNum > 0;

  return (
    <div className={`glass rounded-xl p-4 border transition-all hover:scale-[1.02] ${
      project.pinned
        ? 'border-[#FFD700]/30 bg-gradient-to-br from-[#FFD700]/5 to-transparent shadow-[0_0_20px_rgba(255,215,0,0.08)]'
        : 'border-white/10 hover:border-[#00E5FF]/30'
    }`}>
      {project.pinned && (
        <div className="flex items-center gap-1 mb-2">
          <Star className="w-3 h-3 text-[#FFD700] fill-[#FFD700]" />
          <span className="text-[9px] font-bold text-[#FFD700] uppercase tracking-wider">Featured Partner</span>
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-[#111827] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
          {project.thumb ? (
            <img src={project.thumb} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <Zap className="w-4 h-4 text-[#00E5FF]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold truncate">{project.name}</h3>
            <span className="text-[10px] text-gray-500">{project.symbol}</span>
            {project.verified && (
              <img src="/verified-badge-new.png" alt="Verified" className="w-4 h-4 flex-shrink-0" />
            )}
          </div>
          <p className="text-gray-400 text-[11px] leading-relaxed line-clamp-2">{project.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLORS[project.category] || 'bg-gray-500/20 text-gray-400'}`}>
            {project.category}
          </span>
          {project.chain && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${CHAIN_COLORS[project.chain] || 'bg-gray-500/20 text-gray-400'}`}>
              {project.chain}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gray-300 font-mono text-[11px]">{project.price}</span>
          {project.priceChange24h !== '0' && (
            <span className={`flex items-center gap-0.5 font-semibold text-[11px] ${isPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              <TrendingUp className={`w-3 h-3 ${!isPositive ? 'rotate-180' : ''}`} />
              {isPositive ? '+' : ''}{project.priceChange24h}%
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
        <div className="bg-[#111827]/50 rounded-lg px-2 py-1.5 text-center">
          <div className="text-gray-500">MCap</div>
          <div className="text-gray-300 font-semibold">{project.marketCap}</div>
        </div>
        <div className="bg-[#111827]/50 rounded-lg px-2 py-1.5 text-center">
          <div className="text-gray-500">Volume</div>
          <div className="text-gray-300 font-semibold">{project.volume24h}</div>
        </div>
        <div className="bg-[#111827]/50 rounded-lg px-2 py-1.5 text-center">
          <div className="text-gray-500">Liquidity</div>
          <div className="text-gray-300 font-semibold">{project.liquidity}</div>
        </div>
      </div>

      <a
        href={project.dexUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full py-1.5 rounded-lg border border-[#00E5FF]/30 text-[#00E5FF] text-[11px] font-semibold hover:bg-[#00E5FF]/10 transition-colors flex items-center justify-center gap-1"
      >
        <ExternalLink className="w-3 h-3" /> View Details
      </a>
    </div>
  );
}

function ListingFormModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    tokenName: '', symbol: '', contractAddress: '', chain: 'ethereum',
    website: '', telegram: '', twitter: '', description: '', logoUrl: '', email: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!form.tokenName || !form.symbol || !form.contractAddress || !form.email) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/project-listing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) setSubmitted(true);
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111827] border border-white/10 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-heading font-bold">List Your Token</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-[#10B981]" />
            </div>
            <h3 className="text-lg font-bold mb-2">Submitted!</h3>
            <p className="text-gray-400 text-sm">Your token listing has been submitted for review. You will receive an email at <span className="text-white">{form.email}</span> once verified.</p>
            <button onClick={onClose} className="mt-4 px-6 py-2 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-lg text-sm font-semibold">Close</button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-xs mb-2">Submit your token for listing on STEINZ Project Discovery. Our team will verify and list approved tokens. Some tokens may be manually listed by our team.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase mb-1 block">Token Name *</label>
                <input value={form.tokenName} onChange={e => setForm({...form, tokenName: e.target.value})} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="NAKA GO" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase mb-1 block">Symbol *</label>
                <input value={form.symbol} onChange={e => setForm({...form, symbol: e.target.value})} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="NAKAGO" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase mb-1 block">Contract Address *</label>
              <input value={form.contractAddress} onChange={e => setForm({...form, contractAddress: e.target.value})} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#00E5FF]/50" placeholder="0x..." />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase mb-1 block">Chain *</label>
              <select value={form.chain} onChange={e => setForm({...form, chain: e.target.value})} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50">
                <option value="ethereum">Ethereum</option>
                <option value="solana">Solana</option>
                <option value="bsc">BSC</option>
                <option value="base">Base</option>
                <option value="polygon">Polygon</option>
                <option value="avalanche">Avalanche</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase mb-1 flex items-center gap-1"><Globe className="w-2.5 h-2.5" /> Website</label>
                <input value={form.website} onChange={e => setForm({...form, website: e.target.value})} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="https://" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase mb-1 flex items-center gap-1"><MessageCircle className="w-2.5 h-2.5" /> Telegram</label>
                <input value={form.telegram} onChange={e => setForm({...form, telegram: e.target.value})} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="@group" />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase mb-1 block">Twitter</label>
                <input value={form.twitter} onChange={e => setForm({...form, twitter: e.target.value})} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="@handle" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-gray-400 uppercase mb-1 block">Description</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50 resize-none" placeholder="Brief description of your token project..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 uppercase mb-1 block">Logo URL</label>
                <input value={form.logoUrl} onChange={e => setForm({...form, logoUrl: e.target.value})} className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="https://..." />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 uppercase mb-1 block">Email *</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" className="w-full bg-[#0A0E1A] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="team@project.com" />
              </div>
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.tokenName || !form.symbol || !form.contractAddress || !form.email}
              className="w-full py-2.5 bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-lg text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
