'use client';

import { useState } from 'react';
import { Rocket, CheckCircle, Lock, Loader, Shield, ArrowLeft, RefreshCw, Info } from 'lucide-react';
import Link from 'next/link';

interface Milestone {
  name: string;
  amount: number;
  status: 'completed' | 'in_progress' | 'locked';
}

interface FundingProject {
  name: string;
  description: string;
  goal: number;
  raised: number;
  builder: string;
  verified: boolean;
  daysLeft: number;
  milestones: Milestone[];
}

const PROJECTS: FundingProject[] = [
  {
    name: 'DeFi Bridge Protocol',
    description: 'Cross-chain bridge with instant finality',
    goal: 150000,
    raised: 89000,
    builder: '0x7a2d...9f4e',
    verified: true,
    daysLeft: 15,
    milestones: [
      { name: 'Smart Contract Audit', amount: 30000, status: 'completed' },
      { name: 'Testnet Launch', amount: 35000, status: 'in_progress' },
      { name: 'Mainnet Integration', amount: 40000, status: 'locked' },
      { name: 'Security Hardening', amount: 25000, status: 'locked' },
      { name: 'Public Launch', amount: 20000, status: 'locked' },
    ],
  },
  {
    name: 'NFT Gaming Platform',
    description: 'Play-to-earn gaming ecosystem on Solana',
    goal: 200000,
    raised: 145000,
    builder: '0x3c8b...2a1f',
    verified: true,
    daysLeft: 8,
    milestones: [
      { name: 'Game Engine', amount: 40000, status: 'completed' },
      { name: 'NFT Marketplace', amount: 35000, status: 'completed' },
      { name: 'Beta Testing', amount: 45000, status: 'completed' },
      { name: 'Token Launch', amount: 40000, status: 'in_progress' },
      { name: 'Community Events', amount: 20000, status: 'locked' },
      { name: 'Mobile Launch', amount: 20000, status: 'locked' },
    ],
  },
  {
    name: 'DAO Governance Tool',
    description: 'No-code DAO creation and management',
    goal: 80000,
    raised: 12000,
    builder: '0x9e4f...7c3d',
    verified: false,
    daysLeft: 42,
    milestones: [
      { name: 'Smart Contracts', amount: 20000, status: 'locked' },
      { name: 'Frontend UI', amount: 25000, status: 'locked' },
      { name: 'Governance Module', amount: 20000, status: 'locked' },
      { name: 'Public Launch', amount: 15000, status: 'locked' },
    ],
  },
];

const STEPS = [
  'Builders submit project with milestone plan',
  'Investors fund into escrow smart contract',
  'Funds release ONLY when milestones are verified',
  'If project fails, investors get refunds',
  'Platform takes 2% fee only on successful releases',
];

export default function BuilderFundingPage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'submit'>('browse');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showInfo, setShowInfo] = useState(true);

  const milestoneIcon = (status: string) => {
    if (status === 'completed') return <CheckCircle className="w-4 h-4 text-[#10B981]" />;
    if (status === 'in_progress') return <Loader className="w-4 h-4 text-[#00E5FF] animate-spin" />;
    return <Lock className="w-4 h-4 text-gray-600" />;
  };

  const milestoneColor = (status: string) => {
    if (status === 'completed') return 'text-[#10B981]';
    if (status === 'in_progress') return 'text-[#00E5FF]';
    return 'text-gray-500';
  };

  const milestoneLabel = (status: string) => {
    if (status === 'completed') return 'COMPLETED';
    if (status === 'in_progress') return 'IN PROGRESS';
    return 'LOCKED';
  };

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
        <p className="text-gray-400 text-xs mb-4">Verified builders meet capital with milestone releases</p>

        <div className="flex gap-1 mb-4 bg-[#111827] p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('browse')}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${activeTab === 'browse' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'text-gray-400'}`}
          >
            Browse Projects
          </button>
          <button
            onClick={() => setActiveTab('submit')}
            className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all ${activeTab === 'submit' ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white' : 'text-gray-400'}`}
          >
            Submit Project
          </button>
        </div>

        {activeTab === 'browse' && (
          <>
            {showInfo && (
              <div className="glass rounded-xl p-4 border border-[#00E5FF]/20 mb-4 bg-gradient-to-r from-[#00E5FF]/5 to-transparent">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-[#00E5FF]" />
                    <span className="text-xs font-bold">How It Works</span>
                  </div>
                  <button onClick={() => setShowInfo(false)} className="text-gray-500 text-[10px]">Dismiss</button>
                </div>
                <div className="space-y-1.5">
                  {STEPS.map((step, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-gray-300">
                      <span className="text-[#00E5FF] font-bold flex-shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
              {['All', 'Active', 'Completed', 'Gaming', 'DeFi', 'Infrastructure'].map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                    activeFilter === f
                      ? 'bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-white'
                      : 'bg-[#111827] text-gray-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {PROJECTS.map((project) => {
                const pct = Math.round((project.raised / project.goal) * 100);
                const completedCount = project.milestones.filter((m) => m.status === 'completed').length;
                return (
                  <div key={project.name} className="glass rounded-xl border border-white/10 overflow-hidden">
                    <div className="h-32 bg-gradient-to-br from-[#00E5FF]/10 via-[#7C3AED]/10 to-[#0A0E1A] flex items-center justify-center">
                      <span className="text-3xl font-heading font-bold text-white/20">{project.name.charAt(0)}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold">{project.name}</h3>
                        {project.verified && <CheckCircle className="w-3.5 h-3.5 text-[#00E5FF]" />}
                      </div>
                      <p className="text-gray-400 text-xs mb-3">{project.description}</p>

                      <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-3">
                        {project.verified && (
                          <span className="flex items-center gap-1 text-[#10B981]">
                            <CheckCircle className="w-3 h-3" /> Verified Builder
                          </span>
                        )}
                        <span>Builder: {project.builder}</span>
                      </div>

                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">${project.raised.toLocaleString()} raised of ${project.goal.toLocaleString()}</span>
                          <span className="font-semibold text-[#00E5FF]">{pct}%</span>
                        </div>
                        <div className="w-full bg-[#111827] rounded-full h-2">
                          <div className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-1">{project.daysLeft} days left</div>
                      </div>

                      <div className="mb-3">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
                          Milestones ({completedCount}/{project.milestones.length})
                        </div>
                        <div className="space-y-1.5">
                          {project.milestones.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              {milestoneIcon(m.status)}
                              <span className={`flex-1 ${milestoneColor(m.status)}`}>{m.name}</span>
                              <span className={`text-[10px] font-semibold ${milestoneColor(m.status)}`}>
                                {milestoneLabel(m.status)}
                              </span>
                              <span className="text-gray-600 text-[10px]">${(m.amount / 1000).toFixed(0)}K</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 mb-3">
                        <span className="px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded text-[9px] font-semibold flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" /> Escrow Protected
                        </span>
                        <span className="px-2 py-0.5 bg-[#00E5FF]/10 text-[#00E5FF] rounded text-[9px] font-semibold flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5" /> Milestone-Based
                        </span>
                        <span className="px-2 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] rounded text-[9px] font-semibold flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5" /> Refund Available
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <button className="flex-1 py-2 rounded-lg border border-white/10 text-xs font-semibold hover:bg-white/5 transition-colors">
                          View Full Details
                        </button>
                        <button className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-xs font-semibold hover:scale-105 transition-transform">
                          Fund This Project
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'submit' && (
          <div className="space-y-4">
            <div className="glass rounded-xl p-4 border border-white/10">
              <label className="text-xs text-gray-400 mb-1 block">Project Name</label>
              <input className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="Enter project name" />
            </div>
            <div className="glass rounded-xl p-4 border border-white/10">
              <label className="text-xs text-gray-400 mb-1 block">Description</label>
              <textarea className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50 min-h-[80px]" placeholder="Describe your project..." />
            </div>
            <div className="glass rounded-xl p-4 border border-white/10">
              <label className="text-xs text-gray-400 mb-1 block">Funding Goal ($)</label>
              <input type="number" className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50" placeholder="50000" />
            </div>
            <div className="glass rounded-xl p-4 border border-white/10">
              <label className="text-xs text-gray-400 mb-1 block">Number of Milestones</label>
              <select className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#00E5FF]/50">
                <option value="3">3 Milestones</option>
                <option value="4">4 Milestones</option>
                <option value="5">5 Milestones</option>
                <option value="6">6 Milestones</option>
              </select>
            </div>

            {[1, 2, 3].map((n) => (
              <div key={n} className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-2 text-[#00E5FF]">Milestone {n}</div>
                <div className="space-y-2">
                  <input className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50" placeholder="Milestone name" />
                  <textarea className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50 min-h-[50px]" placeholder="Description & deliverables" />
                  <input type="number" className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50" placeholder="Amount ($)" />
                </div>
              </div>
            ))}

            <button className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] font-semibold text-sm hover:scale-105 transition-transform">
              Submit for Review
            </button>
            <p className="text-center text-gray-500 text-[10px]">Requires wallet connection. Reviewed within 48 hours.</p>
          </div>
        )}
      </div>
    </div>
  );
}
