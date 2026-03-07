'use client';

import { useState, useEffect } from 'react';
import { Building2, ArrowLeft, Search, Globe, Users, Code, Star, MessageSquare, Plus, Award, Loader2, ChevronRight, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/hooks/useWallet';
import Image from 'next/image';

interface Builder {
  id: string;
  name: string;
  role: string;
  skills: string[];
  bio: string;
  walletAddress: string;
  verified: boolean;
  reputationScore: number;
  completedProjects: number;
  endorsements: number;
  status: string;
  github: string;
  twitter: string;
  website: string;
  portfolio: string;
}

export default function BuilderNetworkPage() {
  const router = useRouter();
  const { address: walletAddress } = useWallet();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [selectedBuilder, setSelectedBuilder] = useState<Builder | null>(null);
  const [endorsed, setEndorsed] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: '', role: '', skills: '', bio: '', portfolio: '', github: '', twitter: '', website: '', experience: ''
  });

  useEffect(() => {
    fetchBuilders();
  }, []);

  const fetchBuilders = async () => {
    try {
      const res = await fetch('/api/builder-submissions?type=builders&status=approved');
      const data = await res.json();
      setBuilders(data.builders || []);
    } catch (err) {
      console.error('Failed to fetch builders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!form.name || !form.role || !form.bio) return;
    setApplying(true);
    try {
      const res = await fetch('/api/builder-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_builder',
          ...form,
          skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
          walletAddress: walletAddress || '',
        }),
      });
      if (res.ok) {
        setApplied(true);
        setShowApply(false);
      }
    } catch (err) {
      console.error('Application failed:', err);
    } finally {
      setApplying(false);
    }
  };

  const handleEndorse = async (builderId: string) => {
    if (endorsed.includes(builderId)) return;
    setEndorsed(prev => [...prev, builderId]);
    try {
      await fetch('/api/builder-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'endorse_builder', builderId }),
      });
      fetchBuilders();
    } catch {}
  };

  const filtered = builders.filter(b => {
    if (filter === 'Verified' && !b.verified) return false;
    if (filter === 'Available' && b.status !== 'approved') return false;
    if (filter === 'Developers' && !b.role.toLowerCase().includes('dev') && !b.role.toLowerCase().includes('engineer')) return false;
    if (filter === 'Auditors' && !b.role.toLowerCase().includes('audit')) return false;
    if (filter === 'Designers' && !b.role.toLowerCase().includes('design')) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.role.toLowerCase().includes(q) || b.skills.some(s => s.toLowerCase().includes(q));
    }
    return true;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 70) return '#00D4AA';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="min-h-screen bg-[#0B0D14] text-white pb-20">
      <div className="sticky top-0 z-40 glass backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Building2 className="w-5 h-5 text-[#00D4AA]" />
          <h1 className="text-sm font-heading font-bold">Builder Network</h1>
          <span className="ml-auto text-[10px] text-gray-500">{builders.length} builders</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#10B981]">{builders.filter(b => b.verified).length}</div>
            <div className="text-[10px] text-gray-500">Verified</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#00D4AA]">{builders.reduce((s, b) => s + b.completedProjects, 0)}</div>
            <div className="text-[10px] text-gray-500">Projects</div>
          </div>
          <div className="glass rounded-xl p-3 border border-white/10 text-center">
            <div className="text-lg font-bold text-[#6366F1]">{builders.reduce((s, b) => s + b.endorsements, 0)}</div>
            <div className="text-[10px] text-gray-500">Endorsements</div>
          </div>
        </div>

        {!applied && (
          <button
            onClick={() => setShowApply(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#6366F1] font-semibold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
          >
            <Plus className="w-4 h-4" /> Apply as Builder
          </button>
        )}
        {applied && (
          <div className="glass rounded-xl p-3 border border-[#10B981]/30 bg-[#10B981]/5 text-center">
            <p className="text-xs text-[#10B981] font-semibold">Application submitted! Under review (48h).</p>
          </div>
        )}

        <div className="flex items-center gap-2 bg-[#111827] border border-white/10 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search builders..." className="bg-transparent focus:outline-none text-xs w-full text-gray-300 placeholder-gray-500" />
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Verified', 'Available', 'Developers', 'Auditors', 'Designers'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap ${filter === f ? 'bg-gradient-to-r from-[#00D4AA] to-[#6366F1] text-white' : 'bg-[#111827] text-gray-400'}`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 text-[#00D4AA] mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-400">Loading builders...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((builder) => (
              <div key={builder.id} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all cursor-pointer" onClick={() => setSelectedBuilder(builder)}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#00D4AA]/20 to-[#6366F1]/20 rounded-full flex items-center justify-center text-xs font-bold relative">
                      {builder.name.split(' ').map(n => n[0]).join('')}
                      {builder.verified && (
                        <img src="/verified-badge.png" alt="Verified" className="absolute -bottom-1 -right-1 w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        {builder.name}
                      </div>
                      <div className="text-[10px] text-gray-500">{builder.role}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold" style={{ color: getScoreColor(builder.reputationScore) }}>
                      {builder.reputationScore}
                    </div>
                    <div className="text-[9px] text-gray-500">Rep Score</div>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-2 line-clamp-2">{builder.bio}</p>
                <div className="flex flex-wrap gap-1 mb-2">
                  {builder.skills.slice(0, 4).map((skill) => (
                    <span key={skill} className="px-1.5 py-0.5 bg-[#111827] rounded text-[9px] text-gray-400">{skill}</span>
                  ))}
                  {builder.skills.length > 4 && <span className="text-[9px] text-gray-500">+{builder.skills.length - 4}</span>}
                </div>
                <div className="flex items-center gap-4 text-[10px] text-gray-500">
                  <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-[#F59E0B]" /> {builder.endorsements} endorsements</span>
                  <span className="flex items-center gap-0.5"><Code className="w-3 h-3" /> {builder.completedProjects} projects</span>
                  <ChevronRight className="w-3 h-3 ml-auto text-gray-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showApply && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowApply(false)}>
          <div className="w-full max-w-md max-h-[85vh] bg-[#0B0D14] rounded-t-2xl sm:rounded-2xl border border-white/10 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0B0D14] border-b border-white/10 p-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Apply as Builder</h2>
              <button onClick={() => setShowApply(false)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Full Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00D4AA]/50" placeholder="Your full name" />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Role *</label>
                <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00D4AA]/50">
                  <option value="">Select role</option>
                  <option>Full-Stack Developer</option>
                  <option>Smart Contract Developer</option>
                  <option>Smart Contract Auditor</option>
                  <option>DeFi Protocol Engineer</option>
                  <option>Frontend Developer</option>
                  <option>Blockchain Architect</option>
                  <option>UI/UX Designer</option>
                  <option>DevOps Engineer</option>
                  <option>Security Researcher</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Skills (comma separated) *</label>
                <input value={form.skills} onChange={e => setForm(p => ({...p, skills: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00D4AA]/50" placeholder="Solidity, React, Rust..." />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Bio *</label>
                <textarea value={form.bio} onChange={e => setForm(p => ({...p, bio: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00D4AA]/50 min-h-[60px]" placeholder="Tell us about yourself and your experience..." />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Experience</label>
                <input value={form.experience} onChange={e => setForm(p => ({...p, experience: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00D4AA]/50" placeholder="3 years blockchain, 5 years total" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">GitHub</label>
                  <input value={form.github} onChange={e => setForm(p => ({...p, github: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00D4AA]/50" placeholder="username" />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">Twitter</label>
                  <input value={form.twitter} onChange={e => setForm(p => ({...p, twitter: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00D4AA]/50" placeholder="@handle" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-gray-500 mb-1 block">Portfolio URL</label>
                <input value={form.portfolio} onChange={e => setForm(p => ({...p, portfolio: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00D4AA]/50" placeholder="https://yoursite.com" />
              </div>
              {walletAddress && (
                <div className="glass rounded-lg p-2 border border-[#10B981]/20">
                  <p className="text-[10px] text-gray-500">Connected Wallet</p>
                  <p className="text-xs font-mono text-[#10B981]">{walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</p>
                </div>
              )}
              <button onClick={handleApply} disabled={applying || !form.name || !form.role || !form.bio} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#6366F1] font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
                {applying ? 'Submitting...' : 'Submit Application'}
              </button>
              <p className="text-center text-[10px] text-gray-600">Applications reviewed within 48 hours. Verification requires portfolio review and endorsements.</p>
            </div>
          </div>
        </div>
      )}

      {selectedBuilder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setSelectedBuilder(null)}>
          <div className="w-full max-w-md max-h-[85vh] bg-[#0B0D14] rounded-t-2xl sm:rounded-2xl border border-white/10 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-[#0B0D14] border-b border-white/10 p-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Builder Profile</h2>
              <button onClick={() => setSelectedBuilder(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-[#00D4AA]/20 to-[#6366F1]/20 rounded-full flex items-center justify-center text-lg font-bold relative">
                  {selectedBuilder.name.split(' ').map(n => n[0]).join('')}
                  {selectedBuilder.verified && (
                    <img src="/verified-badge.png" alt="Verified" className="absolute -bottom-1 -right-1 w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold">{selectedBuilder.name}</h3>
                  <p className="text-xs text-gray-400">{selectedBuilder.role}</p>
                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{selectedBuilder.walletAddress.slice(0, 10)}...{selectedBuilder.walletAddress.slice(-6)}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="glass rounded-lg p-2 border border-white/10 text-center">
                  <div className="text-sm font-bold" style={{ color: getScoreColor(selectedBuilder.reputationScore) }}>{selectedBuilder.reputationScore}</div>
                  <div className="text-[9px] text-gray-500">Reputation</div>
                </div>
                <div className="glass rounded-lg p-2 border border-white/10 text-center">
                  <div className="text-sm font-bold text-[#00D4AA]">{selectedBuilder.completedProjects}</div>
                  <div className="text-[9px] text-gray-500">Projects</div>
                </div>
                <div className="glass rounded-lg p-2 border border-white/10 text-center">
                  <div className="text-sm font-bold text-[#F59E0B]">{selectedBuilder.endorsements}</div>
                  <div className="text-[9px] text-gray-500">Endorsements</div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-1">About</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">{selectedBuilder.bio}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedBuilder.skills.map(skill => (
                    <span key={skill} className="px-2 py-1 bg-[#111827] rounded-lg text-[10px] text-gray-300">{skill}</span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[10px]">
                {selectedBuilder.github && (
                  <a href={`https://github.com/${selectedBuilder.github}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-[#111827] rounded text-gray-400 hover:text-white transition-colors">GitHub</a>
                )}
                {selectedBuilder.twitter && (
                  <a href={`https://twitter.com/${selectedBuilder.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-[#111827] rounded text-gray-400 hover:text-white transition-colors">Twitter</a>
                )}
                {selectedBuilder.website && (
                  <a href={selectedBuilder.website} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-[#111827] rounded text-gray-400 hover:text-white transition-colors">Website</a>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEndorse(selectedBuilder.id)}
                  disabled={endorsed.includes(selectedBuilder.id)}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    endorsed.includes(selectedBuilder.id)
                      ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
                      : 'border border-[#00D4AA]/30 text-[#00D4AA] hover:bg-[#00D4AA]/10'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  {endorsed.includes(selectedBuilder.id) ? 'Endorsed' : 'Endorse'}
                </button>
                <button className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00D4AA] to-[#6366F1] text-xs font-semibold flex items-center justify-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
