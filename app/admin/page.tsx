'use client';

import { useState } from 'react';
import { Shield, LogOut, Eye, CheckCircle, XCircle, MessageSquare, AlertTriangle, ChevronRight, Clock, Users, FileText, Code, Globe, Activity, Lock, ChevronDown, BarChart3 } from 'lucide-react';

interface Submission {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  chain: string;
  fundingGoal: number;
  status: 'pending' | 'approved' | 'rejected' | 'needs_info';
  submittedAt: string;
  aiRiskScore: number;
  aiRiskLevel: string;
  aiRecommendation: string;
  founder: string;
  founderWallet: string;
  twitter: string;
  twitterFollowers: string;
  linkedin: string;
  github: string;
  website: string;
  contractAddress: string;
  contractVerified: boolean;
  auditReport: boolean;
  demoUrl: string;
  whitepaperUrl: string;
  isAnonymous: boolean;
  checks: { label: string; status: 'pass' | 'warn' | 'fail' }[];
  aiStrengths: string[];
  aiConcerns: string[];
  teamHistory: { project: string; rating: string; status: string }[];
  milestones: { name: string; amount: number; days: number }[];
}

const SUBMISSIONS: Submission[] = [
  {
    id: 'sub_abc123',
    name: 'DeFi Lending Protocol',
    tagline: 'Next-gen money market on Ethereum',
    description: 'A decentralized lending and borrowing protocol with novel interest rate models, flash loan capabilities, and cross-chain collateral support. Built on Ethereum with plans for Solana and Arbitrum expansion.',
    category: 'DeFi',
    chain: 'Ethereum',
    fundingGoal: 50000,
    status: 'pending',
    submittedAt: '2 hours ago',
    aiRiskScore: 24,
    aiRiskLevel: 'LOW',
    aiRecommendation: 'APPROVE',
    founder: 'John Smith',
    founderWallet: '0x742d35a7f8c9e3b2...',
    twitter: '@DeFiLending',
    twitterFollowers: '5.2K',
    linkedin: 'linkedin.com/in/johnsmith',
    github: 'github.com/defilending',
    website: 'defilending.io',
    contractAddress: '0x9abc...def',
    contractVerified: false,
    auditReport: false,
    demoUrl: 'https://demo.defilending.io',
    whitepaperUrl: 'https://docs.defilending.io/whitepaper.pdf',
    isAnonymous: false,
    checks: [
      { label: 'No contract duplicates', status: 'pass' },
      { label: 'No logo duplicates', status: 'pass' },
      { label: 'Team has verified Twitter (5.2K)', status: 'pass' },
      { label: 'Whitepaper provided', status: 'pass' },
      { label: 'No audit yet', status: 'warn' },
      { label: 'Contract not verified on Etherscan', status: 'warn' },
    ],
    aiStrengths: ['Experienced team with track record', 'Clear use case and market fit', 'Realistic funding goals', 'Professional presentation'],
    aiConcerns: ['Contract not yet audited', 'Low holder count (early stage)'],
    teamHistory: [
      { project: 'DeFi Swap', rating: '4.5/5', status: 'Completed' },
      { project: 'NFT Platform', rating: '4.2/5', status: 'Completed' },
    ],
    milestones: [
      { name: 'Smart Contract', amount: 20000, days: 21 },
      { name: 'Security Audit', amount: 15000, days: 14 },
      { name: 'Frontend', amount: 15000, days: 14 },
    ],
  },
  {
    id: 'sub_def456',
    name: '$SCAM Token',
    tagline: 'The next 1000x gem',
    description: 'Revolutionary meme token with unique tokenomics. To the moon!',
    category: 'Meme',
    chain: 'Solana',
    fundingGoal: 0,
    status: 'pending',
    submittedAt: '4 hours ago',
    aiRiskScore: 91,
    aiRiskLevel: 'VERY HIGH',
    aiRecommendation: 'REJECT',
    founder: 'Anonymous',
    founderWallet: '0x1234...5678',
    twitter: '@scamtoken',
    twitterFollowers: '127',
    linkedin: '',
    github: '',
    website: '',
    contractAddress: '0xdead...beef',
    contractVerified: false,
    auditReport: false,
    demoUrl: '',
    whitepaperUrl: '',
    isAnonymous: true,
    checks: [
      { label: 'Anonymous team (no doxxing)', status: 'fail' },
      { label: 'No whitepaper', status: 'fail' },
      { label: 'Contract not verified', status: 'fail' },
      { label: 'Logo similar to known scam (87%)', status: 'fail' },
      { label: 'Twitter account < 1 week old', status: 'fail' },
      { label: 'GoPlus: Honeypot detected', status: 'fail' },
    ],
    aiStrengths: [],
    aiConcerns: ['Anonymous team', 'Honeypot detected', 'No documentation', 'Suspicious logo', 'New social accounts'],
    teamHistory: [],
    milestones: [],
  },
  {
    id: 'sub_ghi789',
    name: 'Cross-Chain Oracle',
    tagline: 'Decentralized price feeds for DeFi',
    description: 'A cross-chain oracle network providing reliable price feeds with sub-second latency.',
    category: 'Infrastructure',
    chain: 'Multi-chain',
    fundingGoal: 75000,
    status: 'pending',
    submittedAt: '6 hours ago',
    aiRiskScore: 42,
    aiRiskLevel: 'MEDIUM',
    aiRecommendation: 'MANUAL_REVIEW',
    founder: 'Sarah Chen',
    founderWallet: '0x5e6f...7a8b',
    twitter: '@crosschainoracle',
    twitterFollowers: '2.1K',
    linkedin: 'linkedin.com/in/sarahchen',
    github: 'github.com/crosschain-oracle',
    website: 'crosschainoracle.io',
    contractAddress: '0xabcd...1234',
    contractVerified: true,
    auditReport: false,
    demoUrl: '',
    whitepaperUrl: 'https://crosschainoracle.io/whitepaper',
    isAnonymous: false,
    checks: [
      { label: 'No contract duplicates', status: 'pass' },
      { label: 'No logo duplicates', status: 'pass' },
      { label: 'Name similarity check passed', status: 'pass' },
      { label: 'Contract verified on Etherscan', status: 'pass' },
      { label: 'No audit report', status: 'warn' },
      { label: 'No demo available', status: 'warn' },
    ],
    aiStrengths: ['Contract verified', 'Whitepaper provided', 'Doxxed team'],
    aiConcerns: ['No audit', 'No demo', 'Medium Twitter following'],
    teamHistory: [],
    milestones: [
      { name: 'Core Oracle', amount: 25000, days: 28 },
      { name: 'Multi-chain Deploy', amount: 25000, days: 21 },
      { name: 'Dashboard & API', amount: 25000, days: 21 },
    ],
  },
];

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [submissions, setSubmissions] = useState(SUBMISSIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState('Project Info');
  const [adminNotes, setAdminNotes] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = () => {
    if (password === '195656') {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const pending = submissions.filter((s) => s.status === 'pending');
  const approved = submissions.filter((s) => s.status === 'approved');
  const rejected = submissions.filter((s) => s.status === 'rejected');

  const handleAction = (id: string, action: 'approved' | 'rejected' | 'needs_info') => {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: action } : s))
    );
    setSelectedId(null);
    setAdminNotes('');
  };

  const selected = submissions.find((s) => s.id === selectedId);

  const riskColor = (level: string) => {
    if (level === 'LOW') return 'text-[#10B981]';
    if (level === 'MEDIUM') return 'text-[#F59E0B]';
    if (level === 'HIGH') return 'text-[#EF4444]';
    return 'text-[#EF4444]';
  };

  const riskBg = (level: string) => {
    if (level === 'LOW') return 'bg-[#10B981]/10';
    if (level === 'MEDIUM') return 'bg-[#F59E0B]/10';
    return 'bg-[#EF4444]/10';
  };

  const checkIcon = (status: string) => {
    if (status === 'pass') return '✅';
    if (status === 'warn') return '⚠️';
    return '❌';
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="glass rounded-2xl p-8 border border-white/10 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-heading font-bold text-white">STEINZ Admin</h1>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Admin Password"
              className="w-full bg-[#111827] border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#00E5FF]/50 text-white"
            />
            {loginError && <p className="text-[#EF4444] text-xs">{loginError}</p>}
            <button onClick={handleLogin} className="w-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] py-3 rounded-lg font-semibold text-sm">
              Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selected) {
    const DETAIL_TABS = ['Project Info', 'Team', 'Technical', 'Checks', 'AI Analysis', 'Actions'];
    return (
      <div className="min-h-screen bg-[#0A0E1A] text-white">
        <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div>
            <button onClick={() => setSelectedId(null)} className="text-gray-400 text-xs hover:text-white transition-colors mb-1 flex items-center gap-1">
              ← Back to Dashboard
            </button>
            <h1 className="text-lg font-heading font-bold">Reviewing: {selected.name}</h1>
            <p className="text-[10px] text-gray-500">Submitted: {selected.submittedAt} · ID: {selected.id}</p>
          </div>
          <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${riskBg(selected.aiRiskLevel)} ${riskColor(selected.aiRiskLevel)}`}>
            Risk: {selected.aiRiskScore}/100 {selected.aiRiskLevel}
          </div>
        </div>

        <div className="flex gap-1 px-4 pt-3 overflow-x-auto scrollbar-hide">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveDetailTab(tab)}
              className={`px-3 py-1.5 rounded-t-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
                activeDetailTab === tab ? 'bg-[#111827] text-white border border-white/10 border-b-0' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="px-4 py-4">
          {activeDetailTab === 'Project Info' && (
            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
              <Row label="Name" value={selected.name} />
              <Row label="Tagline" value={selected.tagline} />
              <Row label="Category" value={selected.category} />
              <Row label="Chain" value={selected.chain} />
              <div>
                <div className="text-[10px] text-gray-500 mb-1">Description</div>
                <p className="text-xs text-gray-300 leading-relaxed">{selected.description}</p>
              </div>
              {selected.fundingGoal > 0 && (
                <>
                  <Row label="Funding Goal" value={`$${selected.fundingGoal.toLocaleString()}`} />
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">Milestones</div>
                    {selected.milestones.map((m, i) => (
                      <div key={i} className="text-xs text-gray-300">{i + 1}. {m.name} (${(m.amount / 1000).toFixed(0)}K) - {m.days} days</div>
                    ))}
                  </div>
                </>
              )}
              {selected.whitepaperUrl && <Row label="Whitepaper" value={selected.whitepaperUrl} link />}
              {selected.website && <Row label="Website" value={selected.website} />}
              {selected.twitter && <Row label="Twitter" value={`${selected.twitter} (${selected.twitterFollowers} followers)`} />}
              {selected.github && <Row label="GitHub" value={selected.github} />}
            </div>
          )}

          {activeDetailTab === 'Team' && (
            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
              <Row label="Founder" value={selected.founder} />
              <Row label="Wallet" value={selected.founderWallet} />
              {selected.twitter && <Row label="Twitter" value={`${selected.twitter} ${selected.isAnonymous ? '' : '(verified ✅)'}`} />}
              {selected.linkedin && <Row label="LinkedIn" value={selected.linkedin} />}
              <Row label="Anonymous" value={selected.isAnonymous ? 'Yes ⚠️' : 'No (Doxxed) ✅'} />
              {selected.teamHistory.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 mb-1 mt-3">Wallet History</div>
                  {selected.teamHistory.map((h, i) => (
                    <div key={i} className="text-xs text-gray-300">✅ &quot;{h.project}&quot; - {h.rating} rating ({h.status})</div>
                  ))}
                  <div className="text-xs text-[#10B981] mt-2 font-semibold">Verdict: Experienced, trusted team</div>
                </div>
              )}
              {selected.teamHistory.length === 0 && (
                <div className="text-xs text-gray-500">No previous projects on STEINZ</div>
              )}
            </div>
          )}

          {activeDetailTab === 'Technical' && (
            <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
              <Row label="Contract" value={selected.contractAddress} />
              <Row label="Contract Status" value={selected.contractVerified ? '✅ Verified on Etherscan' : '⚠️ Not verified on Etherscan'} />
              <Row label="GitHub" value={selected.github || '❌ Not provided'} />
              <Row label="Audit Report" value={selected.auditReport ? '✅ Provided' : '❌ Not provided'} />
              <Row label="Demo" value={selected.demoUrl || '❌ Not provided'} link={!!selected.demoUrl} />
            </div>
          )}

          {activeDetailTab === 'Checks' && (
            <div className="glass rounded-xl p-5 border border-white/10 space-y-2">
              <div className="text-xs font-bold mb-2">Automated Checks</div>
              {selected.checks.map((check, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span>{checkIcon(check.status)}</span>
                  <span className={check.status === 'fail' ? 'text-[#EF4444]' : check.status === 'warn' ? 'text-[#F59E0B]' : 'text-gray-300'}>{check.label}</span>
                </div>
              ))}
            </div>
          )}

          {activeDetailTab === 'AI Analysis' && (
            <div className="glass rounded-xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <div className={`text-2xl font-bold ${riskColor(selected.aiRiskLevel)}`}>{selected.aiRiskScore}/100</div>
                <div className={`px-2 py-1 rounded text-xs font-semibold ${riskBg(selected.aiRiskLevel)} ${riskColor(selected.aiRiskLevel)}`}>
                  {selected.aiRiskLevel} RISK
                </div>
              </div>

              {selected.aiStrengths.length > 0 && (
                <div>
                  <div className="text-xs font-bold mb-1 text-[#10B981]">Strengths</div>
                  {selected.aiStrengths.map((s, i) => (
                    <div key={i} className="text-xs text-gray-300">✅ {s}</div>
                  ))}
                </div>
              )}

              {selected.aiConcerns.length > 0 && (
                <div>
                  <div className="text-xs font-bold mb-1 text-[#F59E0B]">Concerns</div>
                  {selected.aiConcerns.map((c, i) => (
                    <div key={i} className="text-xs text-gray-300">⚠️ {c}</div>
                  ))}
                </div>
              )}

              <div className="border-t border-white/10 pt-3">
                <div className="text-xs font-bold mb-1">Recommendation</div>
                <div className={`text-sm font-bold ${selected.aiRecommendation === 'APPROVE' ? 'text-[#10B981]' : selected.aiRecommendation === 'REJECT' ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`}>
                  {selected.aiRecommendation === 'APPROVE' && '✅ APPROVE'}
                  {selected.aiRecommendation === 'REJECT' && '❌ AUTO-REJECT'}
                  {selected.aiRecommendation === 'MANUAL_REVIEW' && '⚠️ MANUAL REVIEW REQUIRED'}
                </div>
              </div>
            </div>
          )}

          {activeDetailTab === 'Actions' && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-5 border border-white/10 space-y-3">
                <div className="text-xs font-bold mb-2">Admin Notes (private)</div>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add your review notes here..."
                  className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50 min-h-[80px] text-white"
                />
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleAction(selected.id, 'approved')}
                  className="w-full py-3 rounded-xl bg-[#10B981] font-semibold text-sm hover:bg-[#10B981]/80 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> APPROVE
                </button>
                <button
                  onClick={() => handleAction(selected.id, 'needs_info')}
                  className="w-full py-3 rounded-xl bg-[#F59E0B] font-semibold text-sm hover:bg-[#F59E0B]/80 transition-colors flex items-center justify-center gap-2 text-black"
                >
                  <MessageSquare className="w-4 h-4" /> REQUEST MORE INFO
                </button>
                <button
                  onClick={() => handleAction(selected.id, 'rejected')}
                  className="w-full py-3 rounded-xl bg-[#EF4444] font-semibold text-sm hover:bg-[#EF4444]/80 transition-colors flex items-center justify-center gap-2"
                >
                  <XCircle className="w-4 h-4" /> REJECT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <div className="border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4" />
          </div>
          <h1 className="text-lg font-heading font-bold">STEINZ Admin Panel</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Logged in as: Admin</span>
          <button onClick={() => setIsLoggedIn(false)} className="text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-3">Overview</div>
        <div className="grid grid-cols-4 gap-2 mb-6">
          <StatCard label="Pending" value={pending.length.toString()} color="text-[#F59E0B]" />
          <StatCard label="Approved" value={approved.length.toString()} color="text-[#10B981]" />
          <StatCard label="Rejected" value={rejected.length.toString()} color="text-[#EF4444]" />
          <StatCard label="Active" value={(SUBMISSIONS.length).toString()} color="text-[#00E5FF]" />
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold">Pending Submissions ({pending.length})</div>
          <div className="text-[10px] text-gray-500">Sort: Newest ▼</div>
        </div>

        <div className="space-y-3">
          {submissions.map((sub) => (
            <div key={sub.id} className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {sub.status === 'pending' && <span className="w-2 h-2 bg-[#EF4444] rounded-full animate-pulse"></span>}
                  {sub.status === 'approved' && <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />}
                  {sub.status === 'rejected' && <XCircle className="w-3.5 h-3.5 text-[#EF4444]" />}
                  {sub.status === 'needs_info' && <MessageSquare className="w-3.5 h-3.5 text-[#F59E0B]" />}
                  <span className="text-[10px] font-semibold uppercase text-gray-500">{sub.status === 'pending' ? 'NEW' : sub.status.replace('_', ' ')}</span>
                  <span className="text-sm font-bold">{sub.name}</span>
                </div>
                <span className="text-[10px] text-gray-500">{sub.submittedAt}</span>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <div className={`px-2 py-0.5 rounded text-[10px] font-semibold ${riskBg(sub.aiRiskLevel)} ${riskColor(sub.aiRiskLevel)}`}>
                  AI Risk: {sub.aiRiskScore}/100 {sub.aiRiskLevel}
                </div>
                <span className="text-[10px] text-gray-500">{sub.category} | {sub.chain}</span>
                {sub.fundingGoal > 0 && <span className="text-[10px] text-gray-500">Goal: ${sub.fundingGoal.toLocaleString()}</span>}
              </div>

              <div className="space-y-1 mb-3">
                {sub.checks.slice(0, 4).map((check, i) => (
                  <div key={i} className="text-[10px] text-gray-400 flex items-center gap-1.5">
                    <span>{checkIcon(check.status)}</span>
                    <span>{check.label}</span>
                  </div>
                ))}
                {sub.checks.length > 4 && <div className="text-[10px] text-gray-600">+{sub.checks.length - 4} more checks...</div>}
              </div>

              {sub.aiRecommendation === 'REJECT' && (
                <div className="text-[10px] font-semibold text-[#EF4444] mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> RECOMMENDATION: AUTO-REJECT
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedId(sub.id); setActiveDetailTab('Project Info'); }}
                  className="flex-1 py-1.5 rounded-lg border border-white/10 text-[11px] font-semibold hover:bg-white/5 transition-colors flex items-center justify-center gap-1"
                >
                  <Eye className="w-3 h-3" /> Review Full Details
                </button>
                {sub.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAction(sub.id, 'approved')}
                      className="py-1.5 px-3 rounded-lg bg-[#10B981]/20 text-[#10B981] text-[11px] font-semibold hover:bg-[#10B981]/30 transition-colors"
                    >
                      Quick Approve
                    </button>
                    <button
                      onClick={() => handleAction(sub.id, 'rejected')}
                      className="py-1.5 px-3 rounded-lg bg-[#EF4444]/20 text-[#EF4444] text-[11px] font-semibold hover:bg-[#EF4444]/30 transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-lg p-3 text-center border border-white/10">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}

function Row({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500">{label}</div>
      {link ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00E5FF] hover:underline break-all">{value} ↗</a>
      ) : (
        <div className="text-xs text-gray-300 break-all">{value}</div>
      )}
    </div>
  );
}
