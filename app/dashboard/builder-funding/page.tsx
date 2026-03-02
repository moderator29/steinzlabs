'use client';

import { useState, useEffect } from 'react';
import { Rocket, CheckCircle, Lock, Loader, Loader2, Shield, ArrowLeft, RotateCcw, Info, X, DollarSign, Users, Clock, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useWallet } from '@/lib/hooks/useWallet';

interface Milestone {
  name: string;
  description: string;
  amount: number;
  deliverables: string;
  status: 'completed' | 'in_progress' | 'locked' | 'pending_review';
  proofUrl?: string;
  completedAt?: string;
}

interface FundingProject {
  id: string;
  name: string;
  description: string;
  category: string;
  chain: string;
  goal: number;
  raised: number;
  builder: string;
  builderName: string;
  verified: boolean;
  daysLeft: number;
  status: string;
  teamSize: number;
  website: string;
  whitepaper: string;
  milestones: Milestone[];
  investors: number;
  tags: string[];
}

interface Stats {
  totalRaised: number;
  totalProjects: number;
  totalInvestors: number;
  activeProjects: number;
}

const STEPS = [
  { title: 'Builder Applies', desc: 'Goes through STEINZ verification. Only verified, credible builders get through.' },
  { title: 'Builder Pitches', desc: 'Submits full project details visible to the community and investor network.' },
  { title: 'Funding Portal Opens', desc: 'Dedicated portal opens with transparent terms visible to all participants.' },
  { title: 'Funds Are Held', desc: 'Funds held in audited smart contracts — not released to builder immediately.' },
  { title: 'Milestone Release', desc: 'Builder hits milestones, submits proof. STEINZ releases corresponding tranches.' },
];

export default function BuilderFundingPage() {
  const { address: walletAddress } = useWallet();
  const [activeTab, setActiveTab] = useState<'browse' | 'submit'>('browse');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showInfo, setShowInfo] = useState(true);
  const [projects, setProjects] = useState<FundingProject[]>([]);
  const [stats, setStats] = useState<Stats>({ totalRaised: 0, totalProjects: 0, totalInvestors: 0, activeProjects: 0 });
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [fundingModal, setFundingModal] = useState<FundingProject | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    name: '', description: '', category: 'DeFi', chain: 'Ethereum', goal: '',
    teamSize: '1', website: '', whitepaper: '', contractAddress: '', builderName: '',
    tags: '',
    milestones: [
      { name: '', description: '', amount: '', deliverables: '' },
      { name: '', description: '', amount: '', deliverables: '' },
      { name: '', description: '', amount: '', deliverables: '' },
    ]
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/builder-submissions?type=projects&status=active');
      const data = await res.json();
      setProjects(data.projects || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFund = async () => {
    if (!fundingModal || !fundAmount) return;
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) return;
    setFunding(true);
    try {
      const res = await fetch('/api/builder-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fund_project', projectId: fundingModal.id, amount }),
      });
      if (res.ok) {
        fetchProjects();
        setFundingModal(null);
        setFundAmount('');
      }
    } catch (err) {
      console.error('Funding failed:', err);
    } finally {
      setFunding(false);
    }
  };

  const handleSubmitProject = async () => {
    if (!form.name || !form.description || !form.goal) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/builder-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_project',
          ...form,
          goal: parseFloat(form.goal),
          teamSize: parseInt(form.teamSize),
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          walletAddress: walletAddress || '',
          milestones: form.milestones.filter(m => m.name).map(m => ({
            name: m.name,
            description: m.description,
            amount: parseFloat(m.amount) || 0,
            deliverables: m.deliverables,
            status: 'locked',
          })),
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setActiveTab('browse');
        fetchProjects();
      }
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const milestoneIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-[#10B981]" />;
    if (status === 'in_progress') return <Loader className="w-4 h-4 text-[#00E5FF] animate-spin" />;
    if (status === 'pending_review') return <Clock className="w-4 h-4 text-[#F59E0B]" />;
    return <Lock className="w-4 h-4 text-gray-600" />;
  };

  const milestoneColor = (status: string) => {
    if (status === 'completed') return 'text-[#10B981]';
    if (status === 'in_progress') return 'text-[#00E5FF]';
    if (status === 'pending_review') return 'text-[#F59E0B]';
    return 'text-gray-500';
  };

  const filteredProjects = projects.filter(p => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Active') return p.status === 'active';
    if (activeFilter === 'Funded') return p.status === 'funded' || p.status === 'completed';
    return p.category === activeFilter || p.tags.includes(activeFilter);
  });

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="px-4 pt-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-gray-400 text-xs mb-4 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Rocket className="w-5 h-5 text-[#00E5FF]" />
          <h1 className="text-xl font-heading font-bold">Builder Funding Portal</h1>
        </div>
        <p className="text-gray-400 text-xs mb-4">Milestone-gated funding. Verified builders only. Investor-protected.</p>

        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="glass rounded-xl p-2.5 border border-white/10 text-center">
            <div className="text-sm font-bold text-[#10B981]">${(stats.totalRaised / 1000).toFixed(0)}K</div>
            <div className="text-[9px] text-gray-500">Raised</div>
          </div>
          <div className="glass rounded-xl p-2.5 border border-white/10 text-center">
            <div className="text-sm font-bold text-[#00E5FF]">{stats.totalProjects}</div>
            <div className="text-[9px] text-gray-500">Projects</div>
          </div>
          <div className="glass rounded-xl p-2.5 border border-white/10 text-center">
            <div className="text-sm font-bold text-[#7C3AED]">{stats.activeProjects}</div>
            <div className="text-[9px] text-gray-500">Active</div>
          </div>
          <div className="glass rounded-xl p-2.5 border border-white/10 text-center">
            <div className="text-sm font-bold text-[#F59E0B]">{stats.totalInvestors}</div>
            <div className="text-[9px] text-gray-500">Investors</div>
          </div>
        </div>

        {submitted && (
          <div className="glass rounded-xl p-3 border border-[#10B981]/30 bg-[#10B981]/5 text-center mb-4">
            <p className="text-xs text-[#10B981] font-semibold">Project submitted for review! You&apos;ll be notified within 48 hours.</p>
          </div>
        )}

        <div className="flex gap-1 mb-4 bg-[#111827] p-1 rounded-lg">
          <button onClick={() => setActiveTab('browse')} className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${activeTab === 'browse' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'text-gray-400'}`}>
            Browse Projects
          </button>
          <button onClick={() => setActiveTab('submit')} className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${activeTab === 'submit' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'text-gray-400'}`}>
            Submit Project
          </button>
        </div>

        {activeTab === 'browse' && (
          <>
            {showInfo && (
              <div className="glass rounded-xl p-4 border border-[#00E5FF]/20 mb-4 bg-gradient-to-r from-[#00E5FF]/5 to-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#00E5FF]" />
                    <span className="text-xs font-bold">How Milestone-Gated Funding Works</span>
                  </div>
                  <button onClick={() => setShowInfo(false)} className="text-gray-500 text-[10px]">Dismiss</button>
                </div>
                <div className="space-y-3">
                  {STEPS.map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</div>
                      <div>
                        <div className="text-[11px] font-semibold text-white">{step.title}</div>
                        <div className="text-[10px] text-gray-400">{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {['All', 'Active', 'Funded', 'DeFi', 'Security', 'Infrastructure', 'Governance'].map((f) => (
                <button key={f} onClick={() => setActiveFilter(f)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${activeFilter === f ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'bg-[#111827] text-gray-400'}`}>
                  {f}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 text-[#00E5FF] mx-auto mb-3 animate-spin" />
                <p className="text-sm text-gray-400">Loading projects...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProjects.map((project) => {
                  const pct = Math.round((project.raised / project.goal) * 100);
                  const completedCount = project.milestones.filter(m => m.status === 'completed').length;
                  const isExpanded = expandedProject === project.id;

                  return (
                    <div key={project.id} className="glass rounded-xl border border-white/10 overflow-hidden">
                      <div className="h-24 bg-gradient-to-br from-[#00E5FF]/10 via-[#7C3AED]/10 to-[#0A0E1A] flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center">
                            <span className="text-lg font-heading font-bold text-white/30">{project.name.charAt(0)}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <h3 className="text-sm font-bold">{project.name}</h3>
                              {project.verified && <img src="/verified-badge.png" alt="Verified" className="w-4 h-4" />}
                            </div>
                            <div className="text-[10px] text-gray-400">{project.category} · {project.chain}</div>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${project.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981]' : project.status === 'funded' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#F59E0B]/20 text-[#F59E0B]'}`}>
                          {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                        </span>
                      </div>

                      <div className="p-4">
                        <p className="text-gray-400 text-xs mb-3">{project.description}</p>

                        <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-3">
                          {project.verified && (
                            <span className="flex items-center gap-1 text-[#10B981]">
                              <img src="/verified-badge.png" alt="" className="w-3 h-3" /> Verified Builder
                            </span>
                          )}
                          <span>by {project.builderName}</span>
                          <span>· {project.teamSize} team</span>
                          {project.daysLeft > 0 && <span>· {project.daysLeft}d left</span>}
                        </div>

                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">${project.raised.toLocaleString()} of ${project.goal.toLocaleString()}</span>
                            <span className="font-semibold text-[#00E5FF]">{pct}%</span>
                          </div>
                          <div className="w-full bg-[#111827] rounded-full h-2.5">
                            <div className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] h-2.5 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }}></div>
                          </div>
                          <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                            <span>{project.investors} investors</span>
                            <span>Goal: ${project.goal.toLocaleString()}</span>
                          </div>
                        </div>

                        <div className="mb-3">
                          <button onClick={() => setExpandedProject(isExpanded ? null : project.id)} className="flex items-center gap-1 text-[10px] text-gray-500 uppercase tracking-wider mb-2 hover:text-white transition-colors">
                            Milestones ({completedCount}/{project.milestones.length})
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {(isExpanded ? project.milestones : project.milestones.slice(0, 3)).map((m, i) => (
                            <div key={i} className="flex items-start gap-2 text-[11px] mb-1.5">
                              {milestoneIcon(m.status)}
                              <div className="flex-1">
                                <span className={milestoneColor(m.status)}>{m.name}</span>
                                {isExpanded && m.description && (
                                  <p className="text-[10px] text-gray-600 mt-0.5">{m.description}</p>
                                )}
                                {isExpanded && m.deliverables && (
                                  <p className="text-[10px] text-gray-600">Deliverables: {m.deliverables}</p>
                                )}
                              </div>
                              <span className="text-gray-600 text-[10px]">${(m.amount / 1000).toFixed(0)}K</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          <span className="px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded text-[9px] font-semibold flex items-center gap-1">
                            <Shield className="w-2.5 h-2.5" /> Escrow Protected
                          </span>
                          <span className="px-2 py-0.5 bg-[#00E5FF]/10 text-[#00E5FF] rounded text-[9px] font-semibold flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> Milestone-Gated
                          </span>
                          {project.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-[#111827] text-gray-400 rounded text-[9px]">{tag}</span>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          {project.website && (
                            <a href={project.website} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-lg border border-white/10 text-xs font-semibold hover:bg-white/5 transition-colors text-center flex items-center justify-center gap-1">
                              <ExternalLink className="w-3 h-3" /> View Project
                            </a>
                          )}
                          {project.status === 'active' && (
                            <button onClick={() => setFundingModal(project)} className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-xs font-semibold hover:scale-105 transition-transform flex items-center justify-center gap-1">
                              <DollarSign className="w-3 h-3" /> Fund This Project
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {activeTab === 'submit' && (
          <div className="space-y-3">
            <div className="glass rounded-xl p-4 border border-[#00E5FF]/20 bg-gradient-to-r from-[#00E5FF]/5 to-transparent mb-2">
              <p className="text-[11px] text-gray-300 leading-relaxed">Projects undergo review before listing. Only verified builders with credible track records are approved. Funds are held in escrow and released upon milestone completion.</p>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <label className="text-[10px] text-gray-500 mb-1 block">Project Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="Enter project name" />
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <label className="text-[10px] text-gray-500 mb-1 block">Description *</label>
              <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50 min-h-[80px]" placeholder="Describe your project, problem it solves, and technical approach..." />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4 border border-white/10">
                <label className="text-[10px] text-gray-500 mb-1 block">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({...p, category: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50">
                  {['DeFi', 'Infrastructure', 'Security', 'Gaming', 'NFT', 'DAO', 'Social', 'Privacy', 'Analytics'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="glass rounded-xl p-4 border border-white/10">
                <label className="text-[10px] text-gray-500 mb-1 block">Chain</label>
                <select value={form.chain} onChange={e => setForm(p => ({...p, chain: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50">
                  {['Ethereum', 'Solana', 'BSC', 'Polygon', 'Arbitrum', 'Base', 'Optimism', 'Avalanche'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4 border border-white/10">
                <label className="text-[10px] text-gray-500 mb-1 block">Funding Goal ($) *</label>
                <input type="number" value={form.goal} onChange={e => setForm(p => ({...p, goal: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="100000" />
              </div>
              <div className="glass rounded-xl p-4 border border-white/10">
                <label className="text-[10px] text-gray-500 mb-1 block">Team Size</label>
                <input type="number" value={form.teamSize} onChange={e => setForm(p => ({...p, teamSize: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="3" />
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <label className="text-[10px] text-gray-500 mb-1 block">Your Name / Team Name</label>
              <input value={form.builderName} onChange={e => setForm(p => ({...p, builderName: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50" placeholder="Builder or team name" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4 border border-white/10">
                <label className="text-[10px] text-gray-500 mb-1 block">Website</label>
                <input value={form.website} onChange={e => setForm(p => ({...p, website: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50" placeholder="https://..." />
              </div>
              <div className="glass rounded-xl p-4 border border-white/10">
                <label className="text-[10px] text-gray-500 mb-1 block">Whitepaper</label>
                <input value={form.whitepaper} onChange={e => setForm(p => ({...p, whitepaper: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50" placeholder="https://..." />
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <label className="text-[10px] text-gray-500 mb-1 block">Tags (comma separated)</label>
              <input value={form.tags} onChange={e => setForm(p => ({...p, tags: e.target.value}))} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50" placeholder="DeFi, Cross-chain, MEV Protection" />
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <h3 className="text-xs font-bold mb-3 text-[#00E5FF]">Milestone Plan</h3>
              {form.milestones.map((m, i) => (
                <div key={i} className="mb-3 pb-3 border-b border-white/5 last:border-0 last:mb-0 last:pb-0">
                  <div className="text-[10px] font-semibold text-gray-400 mb-1.5">Milestone {i + 1}</div>
                  <div className="space-y-1.5">
                    <input value={m.name} onChange={e => {
                      const ms = [...form.milestones];
                      ms[i] = {...ms[i], name: e.target.value};
                      setForm(p => ({...p, milestones: ms}));
                    }} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#00E5FF]/50" placeholder="Milestone name" />
                    <textarea value={m.description} onChange={e => {
                      const ms = [...form.milestones];
                      ms[i] = {...ms[i], description: e.target.value};
                      setForm(p => ({...p, milestones: ms}));
                    }} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#00E5FF]/50 min-h-[40px]" placeholder="Description & deliverables" />
                    <input type="number" value={m.amount} onChange={e => {
                      const ms = [...form.milestones];
                      ms[i] = {...ms[i], amount: e.target.value};
                      setForm(p => ({...p, milestones: ms}));
                    }} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#00E5FF]/50" placeholder="Amount ($)" />
                  </div>
                </div>
              ))}
              <button onClick={() => setForm(p => ({...p, milestones: [...p.milestones, { name: '', description: '', amount: '', deliverables: '' }]}))} className="w-full py-1.5 rounded-lg border border-dashed border-white/10 text-[10px] text-gray-500 hover:border-white/20 hover:text-gray-300 transition-colors mt-2">
                + Add Milestone
              </button>
            </div>

            <button onClick={handleSubmitProject} disabled={submitting || !form.name || !form.description || !form.goal} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] font-semibold text-sm hover:scale-105 transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {submitting ? 'Submitting...' : 'Submit for Review'}
            </button>
            <p className="text-center text-gray-500 text-[10px]">Requires wallet connection. Reviewed within 48 hours. 2% platform fee on successful releases.</p>
          </div>
        )}
      </div>

      {fundingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setFundingModal(null)}>
          <div className="w-full max-w-sm bg-[#0A0E1A] rounded-2xl border border-white/10 p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold">Fund {fundingModal.name}</h3>
              <button onClick={() => setFundingModal(null)} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-400">${fundingModal.raised.toLocaleString()} raised</span>
                <span className="text-[#00E5FF]">{Math.round((fundingModal.raised / fundingModal.goal) * 100)}%</span>
              </div>
              <div className="w-full bg-[#111827] rounded-full h-2">
                <div className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] h-2 rounded-full" style={{ width: `${Math.min((fundingModal.raised / fundingModal.goal) * 100, 100)}%` }}></div>
              </div>
              <div className="text-[10px] text-gray-500 mt-1">Remaining: ${(fundingModal.goal - fundingModal.raised).toLocaleString()}</div>
            </div>

            <div className="mb-4">
              <label className="text-xs text-gray-400 mb-1 block">Investment Amount ($)</label>
              <input type="number" value={fundAmount} onChange={e => setFundAmount(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="1000" />
              <div className="flex gap-2 mt-2">
                {[100, 500, 1000, 5000].map(amt => (
                  <button key={amt} onClick={() => setFundAmount(String(amt))} className="flex-1 py-1 rounded bg-[#111827] text-[10px] text-gray-400 hover:bg-white/10 transition-colors">
                    ${amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass rounded-lg p-2 border border-white/5 mb-4 space-y-1 text-[10px] text-gray-500">
              <div className="flex justify-between"><span>Funds held in escrow</span><span className="text-[#10B981]">Yes</span></div>
              <div className="flex justify-between"><span>Milestone-gated release</span><span className="text-[#10B981]">Yes</span></div>
              <div className="flex justify-between"><span>Platform fee</span><span>2%</span></div>
              <div className="flex justify-between"><span>Refund if project fails</span><span className="text-[#10B981]">Yes</span></div>
            </div>

            <button onClick={handleFund} disabled={funding || !fundAmount || parseFloat(fundAmount) <= 0} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {funding ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              {funding ? 'Processing...' : `Fund $${fundAmount || '0'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
