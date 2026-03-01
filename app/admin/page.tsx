'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, LogOut, Eye, CheckCircle, XCircle, MessageSquare, AlertTriangle,
  ChevronRight, Clock, Users, FileText, Code, Globe, Activity, Lock,
  ChevronDown, BarChart3, TrendingUp, TrendingDown, Zap, RefreshCw,
  DollarSign, Layers, Target, Bell, Settings, Database, Wifi, WifiOff,
  ArrowUpRight, ArrowDownRight, Coins, PieChart, Send, Trash2, Ban,
  UserCheck, Shield as ShieldIcon
} from 'lucide-react';

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

interface PlatformStats {
  totalUsers: number;
  activeToday: number;
  totalPredictions: number;
  totalFeedPosts: number;
  totalBuilderProjects: number;
  totalFundingRaised: number;
  apiCalls24h: number;
  uptime: number;
}

interface TopToken {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap: number;
}

interface RecentActivityItem {
  id: string;
  type: 'prediction' | 'feed' | 'funding' | 'user' | 'alert';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'success' | 'error';
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

const ADMIN_TABS = ['Overview', 'Context Feed', 'Predictions', 'Builder Funding', 'Top Tokens', 'Activity', 'Quick Actions'];

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [submissions, setSubmissions] = useState(SUBMISSIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState('Project Info');
  const [activeTab, setActiveTab] = useState('Overview');
  const [adminNotes, setAdminNotes] = useState('');
  const [loginError, setLoginError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalUsers: 12847,
    activeToday: 1293,
    totalPredictions: 4521,
    totalFeedPosts: 18743,
    totalBuilderProjects: 47,
    totalFundingRaised: 385000,
    apiCalls24h: 284012,
    uptime: 99.97,
  });

  const [feedStats, setFeedStats] = useState({
    postsToday: 342,
    postsThisWeek: 2187,
    avgEngagement: 4.7,
    topHashtags: ['#BTC', '#SOL', '#ETH', '#DeFi', '#WhaleAlert'],
    reportedPosts: 12,
    flaggedSpam: 5,
    activeDiscussions: 89,
    totalLikes: 45892,
    totalShares: 8921,
  });

  const [predictionStats, setPredictionStats] = useState({
    activePredictions: 156,
    resolvedToday: 23,
    avgAccuracy: 67.3,
    totalStaked: 892450,
    topPredictors: [
      { name: 'CryptoWhale_42', accuracy: 89, predictions: 124 },
      { name: 'DeFiMaster', accuracy: 84, predictions: 98 },
      { name: 'SolanaAlpha', accuracy: 81, predictions: 87 },
      { name: 'ChainLinkBull', accuracy: 79, predictions: 156 },
      { name: 'ETHMaxi2024', accuracy: 76, predictions: 201 },
    ],
    bullishCount: 98,
    bearishCount: 58,
    pendingResolution: 34,
  });

  const [topTokens, setTopTokens] = useState<TopToken[]>([
    { symbol: 'BTC', name: 'Bitcoin', price: 104250, change24h: 2.4, volume: 38200000000, marketCap: 2050000000000 },
    { symbol: 'ETH', name: 'Ethereum', price: 3285, change24h: -0.8, volume: 18500000000, marketCap: 395000000000 },
    { symbol: 'SOL', name: 'Solana', price: 172.5, change24h: 5.2, volume: 4200000000, marketCap: 78000000000 },
    { symbol: 'BNB', name: 'BNB', price: 645, change24h: 1.1, volume: 1800000000, marketCap: 94000000000 },
    { symbol: 'XRP', name: 'XRP', price: 2.38, change24h: -1.3, volume: 3100000000, marketCap: 137000000000 },
    { symbol: 'DOGE', name: 'Dogecoin', price: 0.412, change24h: 8.7, volume: 2900000000, marketCap: 59000000000 },
    { symbol: 'ADA', name: 'Cardano', price: 1.12, change24h: 3.4, volume: 1200000000, marketCap: 39000000000 },
    { symbol: 'AVAX', name: 'Avalanche', price: 42.8, change24h: -2.1, volume: 890000000, marketCap: 17000000000 },
    { symbol: 'LINK', name: 'Chainlink', price: 18.45, change24h: 1.8, volume: 760000000, marketCap: 11000000000 },
    { symbol: 'PEPE', name: 'Pepe', price: 0.0000182, change24h: 12.4, volume: 1500000000, marketCap: 7600000000 },
  ]);

  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([
    { id: '1', type: 'alert', message: 'Whale moved 5,000 BTC ($520M) from Binance', timestamp: '2 min ago', severity: 'warning' },
    { id: '2', type: 'prediction', message: 'New prediction: BTC to $120K by March 2025', timestamp: '5 min ago', severity: 'info' },
    { id: '3', type: 'funding', message: 'DeFi Lending Protocol submitted for review', timestamp: '12 min ago', severity: 'info' },
    { id: '4', type: 'user', message: '15 new user registrations in the last hour', timestamp: '18 min ago', severity: 'success' },
    { id: '5', type: 'alert', message: 'SOL price spiked 5.2% in 30 minutes', timestamp: '25 min ago', severity: 'warning' },
    { id: '6', type: 'feed', message: 'Flagged post: potential spam detected by AI', timestamp: '32 min ago', severity: 'error' },
    { id: '7', type: 'prediction', message: '23 predictions resolved today (67% accuracy)', timestamp: '45 min ago', severity: 'success' },
    { id: '8', type: 'funding', message: '$SCAM Token flagged as high risk (91/100)', timestamp: '1 hour ago', severity: 'error' },
    { id: '9', type: 'user', message: 'User CryptoWhale_42 reached 89% prediction accuracy', timestamp: '1.5 hours ago', severity: 'success' },
    { id: '10', type: 'alert', message: 'API rate limit warning: 284K calls in 24h', timestamp: '2 hours ago', severity: 'warning' },
  ]);

  const refreshData = useCallback(() => {
    setIsRefreshing(true);
    setPlatformStats(prev => ({
      ...prev,
      activeToday: prev.activeToday + Math.floor(Math.random() * 10 - 3),
      apiCalls24h: prev.apiCalls24h + Math.floor(Math.random() * 500),
    }));
    setFeedStats(prev => ({
      ...prev,
      postsToday: prev.postsToday + Math.floor(Math.random() * 3),
    }));
    setTopTokens(prev => prev.map(t => ({
      ...t,
      price: t.price * (1 + (Math.random() * 0.004 - 0.002)),
      change24h: t.change24h + (Math.random() * 0.4 - 0.2),
    })));
    setLastRefresh(new Date());
    setTimeout(() => setIsRefreshing(false), 500);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(refreshData, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, refreshData]);

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

  const formatNumber = (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  const formatPrice = (p: number) => {
    if (p < 0.001) return `$${p.toFixed(7)}`;
    if (p < 1) return `$${p.toFixed(4)}`;
    if (p < 100) return `$${p.toFixed(2)}`;
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const severityColor = (s: string) => {
    if (s === 'success') return 'text-[#10B981]';
    if (s === 'warning') return 'text-[#F59E0B]';
    if (s === 'error') return 'text-[#EF4444]';
    return 'text-[#00E5FF]';
  };

  const severityBg = (s: string) => {
    if (s === 'success') return 'bg-[#10B981]/10';
    if (s === 'warning') return 'bg-[#F59E0B]/10';
    if (s === 'error') return 'bg-[#EF4444]/10';
    return 'bg-[#00E5FF]/10';
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
          <div>
            <h1 className="text-lg font-heading font-bold">STEINZ Admin Panel</h1>
            <div className="flex items-center gap-2 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><Wifi className="w-2.5 h-2.5 text-[#10B981]" /> Live</span>
              <span>·</span>
              <span>Last refresh: {lastRefresh.toLocaleTimeString()}</span>
              <button onClick={refreshData} className={`ml-1 hover:text-white transition-colors ${isRefreshing ? 'animate-spin' : ''}`}>
                <RefreshCw className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Admin</span>
          <button onClick={() => setIsLoggedIn(false)} className="text-gray-400 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-4 pt-3 overflow-x-auto scrollbar-hide border-b border-white/5 pb-2">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-gradient-to-r from-[#00E5FF]/20 to-[#7C3AED]/20 text-white border border-[#00E5FF]/30'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">

        {activeTab === 'Overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <OverviewCard icon={<Users className="w-4 h-4" />} label="Total Users" value={platformStats.totalUsers.toLocaleString()} sub={`${platformStats.activeToday.toLocaleString()} active today`} color="text-[#00E5FF]" />
              <OverviewCard icon={<Target className="w-4 h-4" />} label="Predictions" value={platformStats.totalPredictions.toLocaleString()} sub="Active market" color="text-[#7C3AED]" />
              <OverviewCard icon={<FileText className="w-4 h-4" />} label="Feed Posts" value={platformStats.totalFeedPosts.toLocaleString()} sub="Total content" color="text-[#10B981]" />
              <OverviewCard icon={<Layers className="w-4 h-4" />} label="Builder Projects" value={platformStats.totalBuilderProjects.toString()} sub={`$${(platformStats.totalFundingRaised / 1000).toFixed(0)}K raised`} color="text-[#F59E0B]" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <OverviewCard icon={<Activity className="w-4 h-4" />} label="API Calls (24h)" value={(platformStats.apiCalls24h / 1000).toFixed(0) + 'K'} sub="Requests processed" color="text-[#00E5FF]" />
              <OverviewCard icon={<Zap className="w-4 h-4" />} label="Uptime" value={platformStats.uptime + '%'} sub="Last 30 days" color="text-[#10B981]" />
              <OverviewCard icon={<AlertTriangle className="w-4 h-4" />} label="Pending Reviews" value={pending.length.toString()} sub="Builder submissions" color="text-[#F59E0B]" />
              <OverviewCard icon={<Bell className="w-4 h-4" />} label="Alerts" value={recentActivity.filter(a => a.severity === 'warning' || a.severity === 'error').length.toString()} sub="Require attention" color="text-[#EF4444]" />
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="text-xs font-bold mb-3 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#00E5FF]" />
                System Health
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] text-gray-500 mb-1">Database</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                    <span className="text-xs text-[#10B981] font-semibold">Healthy</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 mb-1">API Gateway</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                    <span className="text-xs text-[#10B981] font-semibold">Operational</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 mb-1">WebSocket</div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                    <span className="text-xs text-[#10B981] font-semibold">Connected</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-white/10">
              <div className="text-xs font-bold mb-3 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                Latest Activity
              </div>
              <div className="space-y-2">
                {recentActivity.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-xs">
                    <div className={`w-1.5 h-1.5 rounded-full ${item.severity === 'error' ? 'bg-[#EF4444]' : item.severity === 'warning' ? 'bg-[#F59E0B]' : item.severity === 'success' ? 'bg-[#10B981]' : 'bg-[#00E5FF]'}`}></div>
                    <span className="text-gray-300 flex-1">{item.message}</span>
                    <span className="text-gray-600 text-[10px]">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Context Feed' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <OverviewCard icon={<FileText className="w-4 h-4" />} label="Posts Today" value={feedStats.postsToday.toString()} sub={`${feedStats.postsThisWeek.toLocaleString()} this week`} color="text-[#00E5FF]" />
              <OverviewCard icon={<TrendingUp className="w-4 h-4" />} label="Avg Engagement" value={feedStats.avgEngagement.toString()} sub="Interactions per post" color="text-[#10B981]" />
              <OverviewCard icon={<MessageSquare className="w-4 h-4" />} label="Active Discussions" value={feedStats.activeDiscussions.toString()} sub="Ongoing threads" color="text-[#7C3AED]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3">Engagement Metrics</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Total Likes</span>
                    <span className="text-white font-semibold">{feedStats.totalLikes.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Total Shares</span>
                    <span className="text-white font-semibold">{feedStats.totalShares.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Reported Posts</span>
                    <span className="text-[#F59E0B] font-semibold">{feedStats.reportedPosts}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Flagged Spam</span>
                    <span className="text-[#EF4444] font-semibold">{feedStats.flaggedSpam}</span>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3">Trending Hashtags</div>
                <div className="space-y-2">
                  {feedStats.topHashtags.map((tag, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-4">{i + 1}.</span>
                      <span className="text-xs text-[#00E5FF] font-semibold">{tag}</span>
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-full" style={{ width: `${100 - i * 18}%` }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Predictions' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <OverviewCard icon={<Target className="w-4 h-4" />} label="Active" value={predictionStats.activePredictions.toString()} sub="Open predictions" color="text-[#00E5FF]" />
              <OverviewCard icon={<CheckCircle className="w-4 h-4" />} label="Resolved Today" value={predictionStats.resolvedToday.toString()} sub={`${predictionStats.avgAccuracy}% accuracy`} color="text-[#10B981]" />
              <OverviewCard icon={<DollarSign className="w-4 h-4" />} label="Total Staked" value={formatNumber(predictionStats.totalStaked)} sub="Across all markets" color="text-[#F59E0B]" />
              <OverviewCard icon={<Clock className="w-4 h-4" />} label="Pending" value={predictionStats.pendingResolution.toString()} sub="Awaiting resolution" color="text-[#7C3AED]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3">Market Sentiment</div>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                    <span className="text-sm font-bold text-[#10B981]">{predictionStats.bullishCount}</span>
                    <span className="text-[10px] text-gray-500">Bullish</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" />
                    <span className="text-sm font-bold text-[#EF4444]">{predictionStats.bearishCount}</span>
                    <span className="text-[10px] text-gray-500">Bearish</span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#10B981] to-[#10B981]"
                    style={{ width: `${(predictionStats.bullishCount / (predictionStats.bullishCount + predictionStats.bearishCount)) * 100}%` }}
                  ></div>
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {((predictionStats.bullishCount / (predictionStats.bullishCount + predictionStats.bearishCount)) * 100).toFixed(0)}% bullish sentiment
                </div>
              </div>

              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3">Top Predictors</div>
                <div className="space-y-2">
                  {predictionStats.topPredictors.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-4">{i + 1}.</span>
                        <span className="text-gray-300">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[#10B981] font-semibold">{p.accuracy}%</span>
                        <span className="text-[10px] text-gray-500">({p.predictions})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Builder Funding' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Pending" value={pending.length.toString()} color="text-[#F59E0B]" />
              <StatCard label="Approved" value={approved.length.toString()} color="text-[#10B981]" />
              <StatCard label="Rejected" value={rejected.length.toString()} color="text-[#EF4444]" />
              <StatCard label="Total" value={SUBMISSIONS.length.toString()} color="text-[#00E5FF]" />
            </div>

            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-bold">Submissions ({submissions.length})</div>
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
        )}

        {activeTab === 'Top Tokens' && (
          <div className="space-y-4">
            <div className="glass rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="text-xs font-bold flex items-center gap-2">
                  <Coins className="w-3.5 h-3.5 text-[#F59E0B]" />
                  Top Tokens by Market Cap
                </div>
                <div className="text-[10px] text-gray-500">via CoinGecko</div>
              </div>
              <div className="divide-y divide-white/5">
                {topTokens.map((token, i) => (
                  <div key={token.symbol} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-500 w-5">{i + 1}</span>
                      <div>
                        <div className="text-sm font-bold">{token.symbol}</div>
                        <div className="text-[10px] text-gray-500">{token.name}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">{formatPrice(token.price)}</div>
                      <div className={`text-[10px] font-semibold flex items-center gap-0.5 justify-end ${token.change24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                        {token.change24h >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                        {Math.abs(token.change24h).toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-[10px] text-gray-500">Volume</div>
                      <div className="text-xs text-gray-300">{formatNumber(token.volume)}</div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-[10px] text-gray-500">MCap</div>
                      <div className="text-xs text-gray-300">{formatNumber(token.marketCap)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Activity' && (
          <div className="space-y-4">
            <div className="glass rounded-xl border border-white/10">
              <div className="px-4 py-3 border-b border-white/10">
                <div className="text-xs font-bold flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
                  Recent Activity Feed
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {recentActivity.map((item) => (
                  <div key={item.id} className="px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${severityBg(item.severity)}`}>
                      {item.type === 'prediction' && <Target className={`w-3.5 h-3.5 ${severityColor(item.severity)}`} />}
                      {item.type === 'feed' && <FileText className={`w-3.5 h-3.5 ${severityColor(item.severity)}`} />}
                      {item.type === 'funding' && <Layers className={`w-3.5 h-3.5 ${severityColor(item.severity)}`} />}
                      {item.type === 'user' && <Users className={`w-3.5 h-3.5 ${severityColor(item.severity)}`} />}
                      {item.type === 'alert' && <AlertTriangle className={`w-3.5 h-3.5 ${severityColor(item.severity)}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-300">{item.message}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{item.timestamp}</div>
                    </div>
                    <div className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${severityBg(item.severity)} ${severityColor(item.severity)}`}>
                      {item.severity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Quick Actions' && (
          <div className="space-y-4">
            <div className="text-xs font-bold mb-2">Platform Management</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <QuickActionCard
                icon={<RefreshCw className="w-4 h-4" />}
                title="Force Refresh Data"
                description="Clear caches and fetch fresh data from all APIs"
                color="text-[#00E5FF]"
                bgColor="bg-[#00E5FF]/10"
                onClick={refreshData}
              />
              <QuickActionCard
                icon={<Database className="w-4 h-4" />}
                title="Clear Feed Cache"
                description="Reset context feed cache and rebuild indexes"
                color="text-[#7C3AED]"
                bgColor="bg-[#7C3AED]/10"
                onClick={() => {}}
              />
              <QuickActionCard
                icon={<Ban className="w-4 h-4" />}
                title="Review Flagged Content"
                description={`${feedStats.flaggedSpam} spam posts and ${feedStats.reportedPosts} reports pending`}
                color="text-[#EF4444]"
                bgColor="bg-[#EF4444]/10"
                onClick={() => setActiveTab('Context Feed')}
              />
              <QuickActionCard
                icon={<UserCheck className="w-4 h-4" />}
                title="Review Submissions"
                description={`${pending.length} builder submissions awaiting review`}
                color="text-[#F59E0B]"
                bgColor="bg-[#F59E0B]/10"
                onClick={() => setActiveTab('Builder Funding')}
              />
              <QuickActionCard
                icon={<Send className="w-4 h-4" />}
                title="Send Platform Alert"
                description="Broadcast notification to all active users"
                color="text-[#10B981]"
                bgColor="bg-[#10B981]/10"
                onClick={() => {}}
              />
              <QuickActionCard
                icon={<Settings className="w-4 h-4" />}
                title="Platform Settings"
                description="Configure API keys, rate limits, and features"
                color="text-gray-400"
                bgColor="bg-white/5"
                onClick={() => {}}
              />
            </div>

            <div className="glass rounded-xl p-4 border border-white/10 mt-4">
              <div className="text-xs font-bold mb-3 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#EF4444]" />
                Danger Zone
              </div>
              <div className="space-y-2">
                <button className="w-full py-2 px-3 rounded-lg border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/10 transition-colors text-left flex items-center gap-2">
                  <Trash2 className="w-3 h-3" /> Purge All Spam Content
                </button>
                <button className="w-full py-2 px-3 rounded-lg border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/10 transition-colors text-left flex items-center gap-2">
                  <Ban className="w-3 h-3" /> Emergency: Disable New Submissions
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OverviewCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <div className={color}>{icon}</div>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
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

function QuickActionCard({ icon, title, description, color, bgColor, onClick }: {
  icon: React.ReactNode; title: string; description: string; color: string; bgColor: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="glass rounded-xl p-4 border border-white/10 hover:border-white/20 transition-all text-left w-full group"
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgColor}`}>
          <span className={color}>{icon}</span>
        </div>
        <div className="flex-1">
          <div className="text-xs font-bold group-hover:text-white transition-colors">{title}</div>
          <div className="text-[10px] text-gray-500">{description}</div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
      </div>
    </button>
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
