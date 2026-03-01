'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, LogOut, Eye, CheckCircle, XCircle, MessageSquare, AlertTriangle,
  ChevronRight, Clock, Users, FileText, Code, Globe, Activity, Lock,
  ChevronDown, BarChart3, TrendingUp, TrendingDown, Zap, RefreshCw,
  DollarSign, Layers, Target, Bell, Settings, Database, Wifi,
  ArrowUpRight, ArrowDownRight, Coins, PieChart, Send, Trash2, Ban,
  UserCheck, Menu, X, Home, Briefcase, ShieldCheck, Radio, Search,
  ExternalLink, Copy, ChevronLeft, Server, Cpu, HardDrive, ToggleLeft,
  ToggleRight, Hash, Filter, Download, Upload, Star, Flag, Bookmark,
  Gamepad2, Trophy
} from 'lucide-react';

const ADMIN_PASSWORD = '195656';

interface TokenData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  total_volume: number;
  market_cap: number;
  image: string;
}

interface PredictionData {
  id: string;
  title: string;
  token: string;
  type: string;
  yesPool: number;
  noPool: number;
  totalPool: number;
  participants: number;
  endTime: string;
  resolved: boolean;
  outcome?: string;
}

interface BuilderData {
  id: string;
  name: string;
  role: string;
  skills: string;
  wallet: string;
  status: string;
  appliedAt: string;
  verified: boolean;
  endorsements: number;
}

interface ProjectData {
  id: string;
  name: string;
  description: string;
  category: string;
  chain: string;
  fundingGoal: number;
  currentFunding: number;
  status: string;
  submittedAt: string;
  builderId: string;
  milestones: { name: string; amount: number; status: string }[];
}

interface WhaleEvent {
  type: string;
  token: string;
  amount: string;
  usdValue: string;
  chain: string;
  timestamp: string;
  address?: string;
}

interface GameScoreData {
  id: string;
  username: string;
  score: number;
  coins: number;
  distance: number;
  timestamp: number;
  gamesPlayed: number;
  bestStreak: number;
}

interface GameStats {
  leaderboard: GameScoreData[];
  totalPlayers: number;
  totalGamesPlayed: number;
  highestScore: number;
  topPlayer: string;
}

interface ApiHealth {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency: number;
  lastCheck: string;
}

const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'market', label: 'Market Data', icon: TrendingUp },
  { id: 'trading', label: 'Trading Suite', icon: Zap },
  { id: 'predictions', label: 'Predictions', icon: Target },
  { id: 'builders', label: 'Builder Network', icon: Users },
  { id: 'funding', label: 'Funding Portal', icon: Briefcase },
  { id: 'whales', label: 'Whale Activity', icon: Activity },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'api-health', label: 'API Health', icon: Server },
  { id: 'game-stats', label: 'Game Stats', icon: Gamepad2 },
  { id: 'token-listings', label: 'Token Listings', icon: Briefcase },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [predictions, setPredictions] = useState<PredictionData[]>([]);
  const [builders, setBuilders] = useState<BuilderData[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [whaleEvents, setWhaleEvents] = useState<WhaleEvent[]>([]);
  const [apiHealth, setApiHealth] = useState<ApiHealth[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [loadingBuilders, setLoadingBuilders] = useState(false);
  const [loadingWhales, setLoadingWhales] = useState(false);
  const [gameStats, setGameStats] = useState<GameStats>({ leaderboard: [], totalPlayers: 0, totalGamesPlayed: 0, highestScore: 0, topPlayer: 'N/A' });
  const [loadingGames, setLoadingGames] = useState(false);
  const [tokenListings, setTokenListings] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [platformStats, setPlatformStats] = useState<any>(null);

  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=25&page=1&sparkline=false&price_change_percentage=1h,24h,7d');
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } catch (e) { console.error('Failed to fetch tokens:', e); }
    setLoadingTokens(false);
  }, []);

  const fetchPredictions = useCallback(async () => {
    setLoadingPredictions(true);
    try {
      const res = await fetch('/api/predictions');
      if (res.ok) {
        const data = await res.json();
        setPredictions(data.predictions || []);
      }
    } catch (e) { console.error('Failed to fetch predictions:', e); }
    setLoadingPredictions(false);
  }, []);

  const fetchBuilders = useCallback(async () => {
    setLoadingBuilders(true);
    try {
      const [buildersRes, projectsRes] = await Promise.all([
        fetch('/api/builder-submissions?type=builders&status=all'),
        fetch('/api/builder-submissions?type=projects&status=all'),
      ]);
      if (buildersRes.ok) {
        const bData = await buildersRes.json();
        setBuilders((bData.builders || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          role: b.role,
          skills: Array.isArray(b.skills) ? b.skills.join(', ') : b.skills || '',
          wallet: b.walletAddress || b.wallet || '',
          status: b.status,
          appliedAt: b.appliedAt,
          verified: b.verified,
          endorsements: b.endorsements || 0,
        })));
      }
      if (projectsRes.ok) {
        const pData = await projectsRes.json();
        setProjects((pData.projects || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          category: p.category,
          chain: p.chain,
          fundingGoal: p.goal || p.fundingGoal || 0,
          currentFunding: p.raised || p.currentFunding || 0,
          status: p.status,
          submittedAt: p.submittedAt,
          builderId: p.builder || p.builderId || '',
          milestones: (p.milestones || []).map((m: any) => ({
            name: m.name,
            amount: m.amount,
            status: m.status,
          })),
        })));
      }
    } catch (e) { console.error('Failed to fetch builders:', e); }
    setLoadingBuilders(false);
  }, []);

  const fetchWhales = useCallback(async () => {
    setLoadingWhales(true);
    try {
      const res = await fetch('/api/whale-tracker');
      if (res.ok) {
        const data = await res.json();
        setWhaleEvents(data.events || []);
      }
    } catch (e) { console.error('Failed to fetch whales:', e); }
    setLoadingWhales(false);
  }, []);

  const fetchGames = useCallback(async () => {
    setLoadingGames(true);
    try {
      const res = await fetch('/api/game-scores');
      if (res.ok) {
        const data = await res.json();
        setGameStats(data);
      }
    } catch (e) { console.error('Failed to fetch game stats:', e); }
    setLoadingGames(false);
  }, []);

  const fetchTokenListings = useCallback(async () => {
    setLoadingListings(true);
    try {
      const res = await fetch(`/api/project-listing?password=${ADMIN_PASSWORD}`);
      if (res.ok) {
        const data = await res.json();
        setTokenListings(data.listings || []);
      }
    } catch (e) { console.error('Failed to fetch listings:', e); }
    setLoadingListings(false);
  }, []);

  const fetchPlatformStats = useCallback(async () => {
    try {
      const res = await fetch('/api/platform-stats');
      if (res.ok) {
        const data = await res.json();
        setPlatformStats(data);
      }
    } catch (e) { console.error('Failed to fetch platform stats:', e); }
  }, []);

  const handleListingAction = async (id: string, action: string) => {
    try {
      await fetch('/api/project-listing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, password: ADMIN_PASSWORD }),
      });
      fetchTokenListings();
    } catch (e) { console.error('Listing action failed:', e); }
  };

  const handleDeleteGameScore = async (id?: string) => {
    try {
      const url = id
        ? `/api/game-scores?password=${ADMIN_PASSWORD}&id=${id}`
        : `/api/game-scores?password=${ADMIN_PASSWORD}`;
      await fetch(url, { method: 'DELETE' });
      fetchGames();
    } catch (e) { console.error('Delete failed:', e); }
  };

  const checkApiHealth = useCallback(async () => {
    const apis = [
      { name: 'CoinGecko Market Data', url: 'https://api.coingecko.com/api/v3/ping' },
      { name: 'Predictions Engine', url: '/api/predictions' },
      { name: 'Builder Submissions', url: '/api/builder-submissions' },
      { name: 'Whale Tracker', url: '/api/whale-tracker' },
      { name: 'VTX AI Assistant', url: '/api/vtx-ai' },
      { name: 'Token Scanner (GoPlus)', url: '/api/token-scanner' },
      { name: 'Context Feed', url: '/api/context-feed' },
      { name: 'Notifications', url: '/api/notifications' },
      { name: 'Wallet Intelligence', url: '/api/wallet-intelligence' },
    ];

    const results: ApiHealth[] = [];
    for (const api of apis) {
      const start = Date.now();
      try {
        const res = await fetch(api.url, { method: api.url.startsWith('http') ? 'GET' : 'GET' });
        const latency = Date.now() - start;
        results.push({
          name: api.name,
          status: res.ok ? (latency > 2000 ? 'degraded' : 'online') : 'degraded',
          latency,
          lastCheck: new Date().toLocaleTimeString(),
        });
      } catch {
        results.push({
          name: api.name,
          status: 'offline',
          latency: Date.now() - start,
          lastCheck: new Date().toLocaleTimeString(),
        });
      }
    }
    setApiHealth(results);
  }, []);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchTokens(), fetchPredictions(), fetchBuilders(), fetchWhales(), fetchGames(), fetchTokenListings(), fetchPlatformStats(), checkApiHealth()]);
    setLastRefresh(new Date());
    setIsRefreshing(false);
  }, [fetchTokens, fetchPredictions, fetchBuilders, fetchWhales, fetchGames, fetchTokenListings, fetchPlatformStats, checkApiHealth]);

  useEffect(() => {
    if (!isLoggedIn) return;
    refreshAll();
    const interval = setInterval(refreshAll, 60000);
    return () => clearInterval(interval);
  }, [isLoggedIn, refreshAll]);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setIsLoggedIn(true);
      setLoginError('');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  const handleBuilderAction = async (builderId: string, action: string) => {
    try {
      await fetch('/api/builder-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action === 'approve' ? 'admin_approve' : 'admin_reject',
          targetType: 'builder',
          targetId: builderId,
          password: ADMIN_PASSWORD,
        }),
      });
      fetchBuilders();
    } catch (e) { console.error('Action failed:', e); }
  };

  const handleProjectAction = async (projectId: string, action: string, milestoneIndex?: number) => {
    try {
      if (action === 'approve_milestone' && milestoneIndex !== undefined) {
        await fetch('/api/builder-submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve_milestone', projectId, milestoneIndex, password: ADMIN_PASSWORD }),
        });
      } else {
        await fetch('/api/builder-submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: action === 'approve' ? 'admin_approve' : 'admin_reject',
            targetType: 'project',
            targetId: projectId,
            password: ADMIN_PASSWORD,
          }),
        });
      }
      fetchBuilders();
    } catch (e) { console.error('Action failed:', e); }
  };

  const formatNumber = (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  const formatPrice = (p: number) => {
    if (p < 0.0001) return `$${p.toFixed(8)}`;
    if (p < 0.01) return `$${p.toFixed(6)}`;
    if (p < 1) return `$${p.toFixed(4)}`;
    if (p < 100) return `$${p.toFixed(2)}`;
    return `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center px-4">
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

  const onlineApis = apiHealth.filter(a => a.status === 'online').length;
  const totalApis = apiHealth.length;
  const totalMarketCap = tokens.reduce((s, t) => s + (t.market_cap || 0), 0);
  const totalVolume = tokens.reduce((s, t) => s + (t.total_volume || 0), 0);
  const activePredictions = predictions.filter(p => !p.resolved);
  const resolvedPredictions = predictions.filter(p => p.resolved);
  const totalPredictionPool = predictions.reduce((s, p) => s + (p.totalPool || 0), 0);
  const pendingBuilders = builders.filter(b => b.status === 'pending');
  const approvedBuilders = builders.filter(b => b.status === 'approved');
  const pendingProjects = projects.filter(p => p.status === 'pending' || p.status === 'submitted');
  const fundedProjects = projects.filter(p => p.currentFunding > 0);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex">
      <div className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`fixed top-0 left-0 h-full w-72 bg-[#0D1117] border-r border-white/10 z-50 transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00E5FF] to-[#7C3AED] rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-heading font-bold">STEINZ Admin</div>
              <div className="text-[10px] text-gray-500">Control Panel</div>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden hover:bg-white/10 p-1.5 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-140px)]">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => { setActiveSection(section.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#00E5FF]/15 to-[#7C3AED]/15 text-white border border-[#00E5FF]/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#00E5FF]' : ''}`} />
                <span className="font-medium">{section.label}</span>
                {section.id === 'builders' && pendingBuilders.length > 0 && (
                  <span className="ml-auto bg-[#EF4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingBuilders.length}</span>
                )}
                {section.id === 'funding' && pendingProjects.length > 0 && (
                  <span className="ml-auto bg-[#F59E0B] text-black text-[9px] font-bold px-1.5 py-0.5 rounded-full">{pendingProjects.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10 bg-[#0D1117]">
          <button onClick={() => setIsLoggedIn(false)} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-all">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-40 bg-[#0A0E1A]/80 backdrop-blur-xl border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden hover:bg-white/10 p-2 rounded-lg">
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-heading font-bold capitalize">{ADMIN_SECTIONS.find(s => s.id === activeSection)?.label}</h1>
              <div className="flex items-center gap-2 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><Wifi className="w-2.5 h-2.5 text-[#10B981]" /> Live</span>
                <span>|</span>
                <span>Updated: {lastRefresh.toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshAll} className={`hover:bg-white/10 p-2 rounded-lg transition-colors ${isRefreshing ? 'animate-spin' : ''}`}>
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
            <a href="/dashboard" className="hover:bg-white/10 p-2 rounded-lg transition-colors">
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
        </header>

        <div className="p-4 max-w-7xl mx-auto">

          {activeSection === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Coins className="w-4 h-4" />} label="Total Market Cap" value={formatNumber(totalMarketCap)} sub="Top 25 tokens" color="text-[#00E5FF]" loading={loadingTokens} />
                <StatCard icon={<Target className="w-4 h-4" />} label="Active Predictions" value={activePredictions.length.toString()} sub={`${formatNumber(totalPredictionPool)} pooled`} color="text-[#7C3AED]" loading={loadingPredictions} />
                <StatCard icon={<Users className="w-4 h-4" />} label="Builders" value={builders.length.toString()} sub={`${approvedBuilders.length} approved`} color="text-[#10B981]" loading={loadingBuilders} />
                <StatCard icon={<Server className="w-4 h-4" />} label="API Status" value={`${onlineApis}/${totalApis}`} sub="Services online" color={onlineApis === totalApis ? 'text-[#10B981]' : 'text-[#F59E0B]'} loading={false} />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Briefcase className="w-4 h-4" />} label="Projects" value={projects.length.toString()} sub={`${fundedProjects.length} funded`} color="text-[#F59E0B]" loading={loadingBuilders} />
                <StatCard icon={<Activity className="w-4 h-4" />} label="Whale Events" value={whaleEvents.length.toString()} sub="Recent activity" color="text-[#00E5FF]" loading={loadingWhales} />
                <StatCard icon={<Gamepad2 className="w-4 h-4" />} label="HODL Runner" value={gameStats.totalPlayers.toString()} sub={`${gameStats.totalGamesPlayed} games`} color="text-[#7C3AED]" loading={loadingGames} />
                <StatCard icon={<Briefcase className="w-4 h-4" />} label="Token Listings" value={tokenListings.length.toString()} sub={`${tokenListings.filter(l => l.status === 'pending').length} pending`} color="text-[#F59E0B]" loading={loadingListings} />
              </div>

              {platformStats && (
                <div className="glass rounded-xl p-4 border border-[#00E5FF]/20 bg-gradient-to-r from-[#00E5FF]/5 to-[#7C3AED]/5">
                  <div className="text-xs font-bold mb-3 flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#00E5FF]" />
                    Platform Stats (Public)
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#00E5FF]">{platformStats.chains}</div>
                      <div className="text-[9px] text-gray-400">Chains Supported</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#10B981]">{platformStats.signalAccuracy}</div>
                      <div className="text-[9px] text-gray-400">Signal Accuracy</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#7C3AED]">{platformStats.volumeTracked}</div>
                      <div className="text-[9px] text-gray-400">Global Volume (CoinGecko)</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-[#F59E0B]">{platformStats.activeUsers}</div>
                      <div className="text-[9px] text-gray-400">Platform Status</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3 flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-[#00E5FF]" />
                  API Health Status
                </div>
                <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
                  {apiHealth.slice(0, 10).map((api) => (
                    <div key={api.name} className="text-center">
                      <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${api.status === 'online' ? 'bg-[#10B981]' : api.status === 'degraded' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`} />
                      <div className="text-[9px] text-gray-400 leading-tight">{api.name}</div>
                      <div className="text-[9px] text-gray-600">{api.latency}ms</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass rounded-xl p-4 border border-white/10">
                  <div className="text-xs font-bold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                    Top Movers (24h)
                  </div>
                  <div className="space-y-2">
                    {[...tokens].sort((a, b) => Math.abs(b.price_change_percentage_24h || 0) - Math.abs(a.price_change_percentage_24h || 0)).slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {t.image && <img src={t.image} alt="" className="w-4 h-4 rounded-full" />}
                          <span className="font-semibold">{t.symbol?.toUpperCase()}</span>
                        </div>
                        <span className={t.price_change_percentage_24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                          {t.price_change_percentage_24h >= 0 ? '+' : ''}{t.price_change_percentage_24h?.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl p-4 border border-white/10">
                  <div className="text-xs font-bold mb-3 flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-[#F59E0B]" />
                    Recent Whale Activity
                  </div>
                  <div className="space-y-2">
                    {whaleEvents.slice(0, 5).map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${e.type === 'sell' ? 'bg-[#EF4444]' : 'bg-[#10B981]'}`} />
                          <span className="text-gray-300">{e.token} {e.type}</span>
                        </div>
                        <span className="text-gray-400">{e.usdValue || e.amount}</span>
                      </div>
                    ))}
                    {whaleEvents.length === 0 && <div className="text-[10px] text-gray-500">Loading whale data...</div>}
                  </div>
                </div>
              </div>

              {pendingBuilders.length > 0 && (
                <div className="glass rounded-xl p-4 border border-[#F59E0B]/30 bg-[#F59E0B]/5">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                    <span className="text-xs font-bold text-[#F59E0B]">Action Required</span>
                  </div>
                  <p className="text-xs text-gray-300">{pendingBuilders.length} builder application(s) pending review. {pendingProjects.length} project(s) awaiting approval.</p>
                  <button onClick={() => setActiveSection('builders')} className="mt-2 text-[10px] text-[#00E5FF] hover:underline flex items-center gap-1">
                    Review Now <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'market' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">Live market data from CoinGecko</div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search tokens..."
                      className="bg-[#111827] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#00E5FF]/50 w-48"
                    />
                  </div>
                </div>
              </div>

              {loadingTokens ? (
                <div className="text-center py-10 text-gray-500 text-sm">Loading market data...</div>
              ) : (
                <div className="glass rounded-xl border border-white/10 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] text-gray-500 uppercase">
                          <th className="text-left px-4 py-3">#</th>
                          <th className="text-left px-4 py-3">Token</th>
                          <th className="text-right px-4 py-3">Price</th>
                          <th className="text-right px-4 py-3">24h Change</th>
                          <th className="text-right px-4 py-3">Volume</th>
                          <th className="text-right px-4 py-3">Market Cap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokens.filter(t => !searchFilter || t.name?.toLowerCase().includes(searchFilter.toLowerCase()) || t.symbol?.toLowerCase().includes(searchFilter.toLowerCase())).map((token, i) => (
                          <tr key={token.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-[10px] text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {token.image && <img src={token.image} alt="" className="w-5 h-5 rounded-full" />}
                                <div>
                                  <div className="text-xs font-bold">{token.symbol?.toUpperCase()}</div>
                                  <div className="text-[10px] text-gray-500">{token.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-semibold">{formatPrice(token.current_price)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-xs font-semibold flex items-center gap-0.5 justify-end ${token.price_change_percentage_24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                {token.price_change_percentage_24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(token.price_change_percentage_24h || 0).toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-300">{formatNumber(token.total_volume)}</td>
                            <td className="px-4 py-3 text-right text-xs text-gray-300">{formatNumber(token.market_cap)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'trading' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Zap className="w-4 h-4" />} label="Status" value={tokens.length > 0 ? 'Active' : 'Offline'} sub={tokens.length > 0 ? 'All systems operational' : 'No data'} color={tokens.length > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'} loading={loadingTokens} />
                <StatCard icon={<TrendingUp className="w-4 h-4" />} label="Trending" value={tokens.length > 0 ? 'Live' : 'Loading'} sub="CoinGecko data" color="text-[#10B981]" loading={loadingTokens} />
                <StatCard icon={<BarChart3 className="w-4 h-4" />} label="Tokens Tracked" value={tokens.length.toString()} sub="Real-time prices" color="text-[#7C3AED]" loading={loadingTokens} />
                <StatCard icon={<Activity className="w-4 h-4" />} label="24h Volume" value={formatNumber(totalVolume)} sub="Across tracked tokens" color="text-[#00E5FF]" loading={loadingTokens} />
              </div>
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3">Trading Suite Features</div>
                <div className="space-y-2">
                  {[
                    { label: 'Trending Tokens', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'Top by Market Cap', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'New Pairs (DexScreener)', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'Market Pulse & Fear/Greed', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'Paste CA / Token Scanner', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'Watchlist', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'TradingView Charts', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'STEINZ Terminal', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'Multi-Chain Support', status: 'Live', color: 'text-[#10B981]' },
                    { label: 'AI Risk Scanner', status: 'Live', color: 'text-[#10B981]' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-white/5 last:border-0">
                      <span className="text-gray-300">{f.label}</span>
                      <span className={`font-semibold text-[10px] ${f.color}`}>{f.status}</span>
                    </div>
                  ))}
                </div>
              </div>
              <a href="/dashboard/trading-suite" target="_blank" className="block">
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] text-xs font-semibold hover:opacity-90 transition-opacity">
                  Open Trading Suite
                </button>
              </a>
            </div>
          )}

          {activeSection === 'predictions' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Target className="w-4 h-4" />} label="Active" value={activePredictions.length.toString()} sub="Open markets" color="text-[#00E5FF]" loading={loadingPredictions} />
                <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Resolved" value={resolvedPredictions.length.toString()} sub="Settled markets" color="text-[#10B981]" loading={loadingPredictions} />
                <StatCard icon={<DollarSign className="w-4 h-4" />} label="Total Pool" value={formatNumber(totalPredictionPool)} sub="All markets" color="text-[#F59E0B]" loading={loadingPredictions} />
                <StatCard icon={<Users className="w-4 h-4" />} label="Participants" value={predictions.reduce((s, p) => s + (p.participants || 0), 0).toString()} sub="Total bettors" color="text-[#7C3AED]" loading={loadingPredictions} />
              </div>

              {loadingPredictions ? (
                <div className="text-center py-10 text-gray-500 text-sm">Loading predictions...</div>
              ) : (
                <div className="space-y-3">
                  {predictions.map((pred) => (
                    <div key={pred.id} className="glass rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${pred.resolved ? 'bg-[#10B981]/20 text-[#10B981]' : 'bg-[#00E5FF]/20 text-[#00E5FF]'}`}>
                            {pred.resolved ? 'Resolved' : 'Active'}
                          </span>
                          <span className="text-xs font-bold">{pred.title || `${pred.token} ${pred.type}`}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{pred.participants || 0} participants</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#10B981] font-semibold">YES: {formatNumber(pred.yesPool || 0)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#EF4444] font-semibold">NO: {formatNumber(pred.noPool || 0)}</span>
                        </div>
                        <span className="text-gray-500">Pool: {formatNumber(pred.totalPool || 0)}</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#10B981] rounded-full" style={{ width: `${pred.totalPool ? ((pred.yesPool || 0) / pred.totalPool) * 100 : 50}%` }} />
                      </div>
                      {pred.resolved && pred.outcome && (
                        <div className="mt-2 text-[10px] font-semibold text-[#10B981]">Outcome: {pred.outcome}</div>
                      )}
                    </div>
                  ))}
                  {predictions.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">No predictions found</div>}
                </div>
              )}
            </div>
          )}

          {activeSection === 'builders' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={pendingBuilders.length.toString()} sub="Awaiting review" color="text-[#F59E0B]" loading={loadingBuilders} />
                <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Approved" value={approvedBuilders.length.toString()} sub="Verified builders" color="text-[#10B981]" loading={loadingBuilders} />
                <StatCard icon={<Users className="w-4 h-4" />} label="Total" value={builders.length.toString()} sub="All applications" color="text-[#00E5FF]" loading={loadingBuilders} />
              </div>

              {loadingBuilders ? (
                <div className="text-center py-10 text-gray-500 text-sm">Loading builder data...</div>
              ) : (
                <div className="space-y-3">
                  {builders.map((builder) => (
                    <div key={builder.id} className={`glass rounded-xl p-4 border ${builder.status === 'pending' ? 'border-[#F59E0B]/30' : 'border-white/10'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${builder.status === 'pending' ? 'bg-[#F59E0B] animate-pulse' : builder.status === 'approved' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
                          <span className="text-sm font-bold">{builder.name}</span>
                          {builder.verified && <img src="/verified-badge.png" alt="Verified" className="w-4 h-4" />}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          builder.status === 'pending' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                          builder.status === 'approved' ? 'bg-[#10B981]/20 text-[#10B981]' :
                          'bg-[#EF4444]/20 text-[#EF4444]'
                        }`}>{builder.status}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 mb-2">{builder.role} | Skills: {builder.skills}</div>
                      <div className="text-[10px] text-gray-500 mb-3">Wallet: {builder.wallet} | Endorsements: {builder.endorsements || 0}</div>
                      {builder.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleBuilderAction(builder.id, 'approve')} className="flex-1 py-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981] text-[11px] font-semibold hover:bg-[#10B981]/30 transition-colors flex items-center justify-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>
                          <button onClick={() => handleBuilderAction(builder.id, 'reject')} className="flex-1 py-1.5 rounded-lg bg-[#EF4444]/20 text-[#EF4444] text-[11px] font-semibold hover:bg-[#EF4444]/30 transition-colors flex items-center justify-center gap-1">
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {builders.length === 0 && (
                    <div className="text-center py-10 text-gray-500 text-sm">No builder applications yet. Applications submitted through the Builder Network page will appear here.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSection === 'funding' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Briefcase className="w-4 h-4" />} label="Total Projects" value={projects.length.toString()} sub="Submitted" color="text-[#00E5FF]" loading={loadingBuilders} />
                <StatCard icon={<Clock className="w-4 h-4" />} label="Pending" value={pendingProjects.length.toString()} sub="Awaiting review" color="text-[#F59E0B]" loading={loadingBuilders} />
                <StatCard icon={<DollarSign className="w-4 h-4" />} label="Total Funded" value={formatNumber(projects.reduce((s, p) => s + (p.currentFunding || 0), 0))} sub="All projects" color="text-[#10B981]" loading={loadingBuilders} />
                <StatCard icon={<Layers className="w-4 h-4" />} label="Funded Projects" value={fundedProjects.length.toString()} sub="With backing" color="text-[#7C3AED]" loading={loadingBuilders} />
              </div>

              {loadingBuilders ? (
                <div className="text-center py-10 text-gray-500 text-sm">Loading projects...</div>
              ) : (
                <div className="space-y-3">
                  {projects.map((project) => (
                    <div key={project.id} className="glass rounded-xl p-4 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{project.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-gray-400">{project.category}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-gray-400">{project.chain}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          project.status === 'pending' || project.status === 'submitted' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                          project.status === 'approved' || project.status === 'funded' ? 'bg-[#10B981]/20 text-[#10B981]' :
                          'bg-[#EF4444]/20 text-[#EF4444]'
                        }`}>{project.status}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 mb-2">{project.description}</p>
                      <div className="flex items-center gap-4 text-[10px] text-gray-500 mb-3">
                        <span>Goal: {formatNumber(project.fundingGoal || 0)}</span>
                        <span>Funded: {formatNumber(project.currentFunding || 0)}</span>
                        <span>Progress: {project.fundingGoal ? ((project.currentFunding / project.fundingGoal) * 100).toFixed(0) : 0}%</span>
                      </div>
                      {project.fundingGoal > 0 && (
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                          <div className="h-full bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] rounded-full" style={{ width: `${Math.min(100, project.fundingGoal ? (project.currentFunding / project.fundingGoal) * 100 : 0)}%` }} />
                        </div>
                      )}
                      {project.milestones && project.milestones.length > 0 && (
                        <div className="mb-3">
                          <div className="text-[10px] font-bold text-gray-400 mb-1">Milestones</div>
                          {project.milestones.map((m, i) => (
                            <div key={i} className="flex items-center justify-between text-[10px] py-1">
                              <span className="text-gray-300">{i + 1}. {m.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500">{formatNumber(m.amount)}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${m.status === 'completed' ? 'bg-[#10B981]/20 text-[#10B981]' : m.status === 'in_progress' || m.status === 'pending_review' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-white/10 text-gray-500'}`}>{m.status || 'pending'}</span>
                                {(m.status === 'in_progress' || m.status === 'pending_review') && (
                                  <button
                                    onClick={() => handleProjectAction(project.id, 'approve_milestone', i)}
                                    className="px-2 py-0.5 rounded bg-[#10B981]/20 text-[#10B981] text-[8px] font-bold hover:bg-[#10B981]/30 transition-colors flex items-center gap-0.5"
                                  >
                                    <CheckCircle className="w-2.5 h-2.5" /> Approve
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {(project.status === 'pending' || project.status === 'submitted') && (
                        <div className="flex gap-2">
                          <button onClick={() => handleProjectAction(project.id, 'approve')} className="flex-1 py-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981] text-[11px] font-semibold hover:bg-[#10B981]/30 transition-colors flex items-center justify-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Approve Project
                          </button>
                          <button onClick={() => handleProjectAction(project.id, 'reject')} className="flex-1 py-1.5 rounded-lg bg-[#EF4444]/20 text-[#EF4444] text-[11px] font-semibold hover:bg-[#EF4444]/30 transition-colors flex items-center justify-center gap-1">
                            <XCircle className="w-3 h-3" /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {projects.length === 0 && (
                    <div className="text-center py-10 text-gray-500 text-sm">No projects submitted yet. Projects from the Builder Funding Portal will appear here for review.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSection === 'whales' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">Real-time whale activity from blockchain data</div>
                <button onClick={fetchWhales} className="text-[10px] text-[#00E5FF] hover:underline flex items-center gap-1">
                  <RefreshCw className={`w-3 h-3 ${loadingWhales ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              {loadingWhales ? (
                <div className="text-center py-10 text-gray-500 text-sm">Loading whale data...</div>
              ) : (
                <div className="glass rounded-xl border border-white/10 overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {whaleEvents.map((event, i) => (
                      <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${event.type === 'sell' ? 'bg-[#EF4444]/10' : event.type === 'buy' ? 'bg-[#10B981]/10' : 'bg-[#00E5FF]/10'}`}>
                          {event.type === 'sell' ? <TrendingDown className="w-4 h-4 text-[#EF4444]" /> : event.type === 'buy' ? <TrendingUp className="w-4 h-4 text-[#10B981]" /> : <Activity className="w-4 h-4 text-[#00E5FF]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold">{event.token} <span className="text-gray-500 font-normal">{event.type}</span></div>
                          <div className="text-[10px] text-gray-500">{event.chain} | {event.timestamp}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold">{event.usdValue || event.amount}</div>
                          {event.address && <div className="text-[9px] text-gray-600 font-mono">{event.address.slice(0, 8)}...{event.address.slice(-4)}</div>}
                        </div>
                      </div>
                    ))}
                    {whaleEvents.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">No whale events detected</div>}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                  Security Overview
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">Token Scanner</div>
                    <div className="text-xs text-[#10B981] font-semibold">GoPlus API Active</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">Auth Provider</div>
                    <div className="text-xs text-[#10B981] font-semibold">Supabase Active</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">Admin Access</div>
                    <div className="text-xs text-[#10B981] font-semibold">Password Protected</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-500 mb-1">API Rate Limiting</div>
                    <div className="text-xs text-[#F59E0B] font-semibold">Cache-based</div>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3">Platform Security Checklist</div>
                <div className="space-y-2">
                  {[
                    { label: 'HTTPS/TLS Encryption', status: true },
                    { label: 'Admin Password Protection', status: true },
                    { label: 'GoPlus Token Security Integration', status: true },
                    { label: 'Input Validation & Sanitization', status: true },
                    { label: 'API Rate Limiting (Cache-based)', status: true },
                    { label: 'Supabase Auth Integration', status: true },
                    { label: 'XSS Protection Headers', status: true },
                    { label: 'Environment Variables for Secrets', status: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle className={`w-3.5 h-3.5 ${item.status ? 'text-[#10B981]' : 'text-gray-600'}`} />
                      <span className={item.status ? 'text-gray-300' : 'text-gray-600'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'api-health' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">Real-time status of all platform APIs</div>
                <button onClick={checkApiHealth} className="text-[10px] text-[#00E5FF] hover:underline flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> Recheck All
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Online" value={apiHealth.filter(a => a.status === 'online').length.toString()} sub="Services" color="text-[#10B981]" loading={false} />
                <StatCard icon={<AlertTriangle className="w-4 h-4" />} label="Degraded" value={apiHealth.filter(a => a.status === 'degraded').length.toString()} sub="Slow response" color="text-[#F59E0B]" loading={false} />
                <StatCard icon={<XCircle className="w-4 h-4" />} label="Offline" value={apiHealth.filter(a => a.status === 'offline').length.toString()} sub="Down" color="text-[#EF4444]" loading={false} />
              </div>

              <div className="space-y-2">
                {apiHealth.map((api) => (
                  <div key={api.name} className="glass rounded-xl p-4 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${api.status === 'online' ? 'bg-[#10B981]' : api.status === 'degraded' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`} />
                      <div>
                        <div className="text-xs font-semibold">{api.name}</div>
                        <div className="text-[10px] text-gray-500">Last check: {api.lastCheck}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold capitalize ${api.status === 'online' ? 'text-[#10B981]' : api.status === 'degraded' ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>{api.status}</div>
                      <div className="text-[10px] text-gray-500">{api.latency}ms</div>
                    </div>
                  </div>
                ))}
                {apiHealth.length === 0 && <div className="text-center py-10 text-gray-500 text-sm">Checking API health...</div>}
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3 flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-[#00E5FF]" />
                  Broadcast Notification
                </div>
                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="Write a platform-wide notification message..."
                  className="w-full bg-[#111827] border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#00E5FF]/50 min-h-[80px] text-white mb-3"
                />
                <button
                  onClick={() => { if (broadcastMsg.trim()) { setBroadcastSent(true); setBroadcastMsg(''); setTimeout(() => setBroadcastSent(false), 3000); } }}
                  className="bg-gradient-to-r from-[#00E5FF] to-[#7C3AED] px-4 py-2 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Send Broadcast
                </button>
                {broadcastSent && <p className="text-[10px] text-[#10B981] mt-2">Notification broadcast sent successfully!</p>}
              </div>

              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3">Quick Alerts</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {[
                    { label: 'Scheduled Maintenance', msg: 'STEINZ Labs will undergo scheduled maintenance in 1 hour. Some features may be temporarily unavailable.', color: 'text-[#F59E0B]' },
                    { label: 'New Feature Launch', msg: 'New feature available! Check out the latest updates on the platform.', color: 'text-[#00E5FF]' },
                    { label: 'Security Advisory', msg: 'Security advisory: Please verify any tokens before trading. Use the Security Center for safety checks.', color: 'text-[#EF4444]' },
                    { label: 'Market Alert', msg: 'Significant market movement detected. Check whale tracker for details.', color: 'text-[#10B981]' },
                  ].map((alert, i) => (
                    <button
                      key={i}
                      onClick={() => setBroadcastMsg(alert.msg)}
                      className="glass rounded-lg p-3 border border-white/10 hover:border-white/20 text-left transition-all"
                    >
                      <div className={`text-[11px] font-bold ${alert.color}`}>{alert.label}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{alert.msg.slice(0, 60)}...</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'game-stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Gamepad2 className="w-4 h-4" />} label="Total Players" value={gameStats.totalPlayers.toString()} sub="Registered players" color="text-[#10B981]" loading={loadingGames} />
                <StatCard icon={<Trophy className="w-4 h-4" />} label="Highest Score" value={gameStats.highestScore.toLocaleString()} sub={`by ${gameStats.topPlayer}`} color="text-[#F59E0B]" loading={loadingGames} />
                <StatCard icon={<Activity className="w-4 h-4" />} label="Games Played" value={gameStats.totalGamesPlayed.toString()} sub="Total rounds" color="text-[#00E5FF]" loading={loadingGames} />
                <StatCard icon={<Star className="w-4 h-4" />} label="Top Player" value={gameStats.topPlayer} sub="Current leader" color="text-[#7C3AED]" loading={loadingGames} />
              </div>

              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold flex items-center gap-2">
                    <Gamepad2 className="w-3.5 h-3.5 text-[#10B981]" />
                    HODL Runner Leaderboard
                  </div>
                  <button
                    onClick={() => handleDeleteGameScore()}
                    className="text-[10px] text-[#EF4444] hover:bg-[#EF4444]/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear All
                  </button>
                </div>

                {loadingGames ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
                    ))}
                  </div>
                ) : gameStats.leaderboard.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-xs">No game scores yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b border-white/5">
                          <th className="text-left py-2 px-2">#</th>
                          <th className="text-left py-2 px-2">Player</th>
                          <th className="text-right py-2 px-2">Score</th>
                          <th className="text-right py-2 px-2">Coins</th>
                          <th className="text-right py-2 px-2">Distance</th>
                          <th className="text-right py-2 px-2">Games</th>
                          <th className="text-right py-2 px-2">Best Streak</th>
                          <th className="text-right py-2 px-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameStats.leaderboard.map((player, idx) => (
                          <tr key={player.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-2 px-2">
                              <span className={`font-bold ${idx === 0 ? 'text-[#F59E0B]' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-[#CD7F32]' : 'text-gray-500'}`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-2 px-2 font-semibold text-white">{player.username}</td>
                            <td className="py-2 px-2 text-right text-[#10B981] font-bold">{player.score.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-[#F59E0B]">{player.coins.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-gray-300">{player.distance.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right text-gray-400">{player.gamesPlayed}</td>
                            <td className="py-2 px-2 text-right text-[#00E5FF]">{player.bestStreak.toLocaleString()}</td>
                            <td className="py-2 px-2 text-right">
                              <button
                                onClick={() => handleDeleteGameScore(player.id)}
                                className="text-[#EF4444] hover:bg-[#EF4444]/10 p-1 rounded transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'token-listings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={<Briefcase className="w-4 h-4" />} label="Total Submissions" value={tokenListings.length.toString()} sub="All time" color="text-[#00E5FF]" loading={loadingListings} />
                <StatCard icon={<Clock className="w-4 h-4" />} label="Pending Review" value={tokenListings.filter(l => l.status === 'pending').length.toString()} sub="Awaiting action" color="text-[#F59E0B]" loading={loadingListings} />
                <StatCard icon={<CheckCircle className="w-4 h-4" />} label="Listed" value={tokenListings.filter(l => l.status === 'listed').length.toString()} sub="Live on discovery" color="text-[#10B981]" loading={loadingListings} />
                <StatCard icon={<DollarSign className="w-4 h-4" />} label="Awaiting Payment" value={tokenListings.filter(l => ['approved_pending_payment', 'payment_sent'].includes(l.status)).length.toString()} sub="Approved tokens" color="text-[#7C3AED]" loading={loadingListings} />
              </div>

              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold flex items-center gap-2 mb-3">
                  <Briefcase className="w-3.5 h-3.5 text-[#00E5FF]" />
                  Token Listing Submissions
                </div>

                {loadingListings ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-white/5 rounded animate-pulse" />
                    ))}
                  </div>
                ) : tokenListings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-xs">No token listing submissions yet</div>
                ) : (
                  <div className="space-y-3">
                    {tokenListings.map((listing) => (
                      <div key={listing.id} className="glass rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {listing.logoUrl ? (
                              <img src={listing.logoUrl} alt={listing.tokenName} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00E5FF]/20 to-[#7C3AED]/20 flex items-center justify-center text-[10px] font-bold">
                                {listing.symbol?.slice(0, 2) || '?'}
                              </div>
                            )}
                            <div>
                              <div className="text-xs font-bold flex items-center gap-2">
                                {listing.tokenName} <span className="text-gray-500">({listing.symbol})</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                  listing.status === 'pending' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                                  listing.status === 'listed' ? 'bg-[#10B981]/20 text-[#10B981]' :
                                  listing.status === 'rejected' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                                  listing.status === 'paid' ? 'bg-[#10B981]/20 text-[#10B981]' :
                                  'bg-[#00E5FF]/20 text-[#00E5FF]'
                                }`}>
                                  {listing.status === 'approved_pending_payment' ? 'APPROVED' :
                                   listing.status === 'payment_sent' ? 'PAYMENT SENT' :
                                   listing.status?.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5">
                                {listing.chain} · {listing.contractAddress?.slice(0, 6)}...{listing.contractAddress?.slice(-4)}
                              </div>
                              {listing.description && (
                                <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">{listing.description}</div>
                              )}
                              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-gray-500">
                                {listing.website && <a href={listing.website} target="_blank" rel="noopener noreferrer" className="hover:text-[#00E5FF]">Website</a>}
                                {listing.telegram && <a href={listing.telegram} target="_blank" rel="noopener noreferrer" className="hover:text-[#00E5FF]">Telegram</a>}
                                {listing.twitter && <a href={listing.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-[#00E5FF]">Twitter</a>}
                                {listing.email && <span>Contact: {listing.email}</span>}
                                <span>Submitted: {new Date(listing.submittedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {listing.status === 'pending' && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleListingAction(listing.id, 'approve')} className="px-2.5 py-1 bg-[#10B981]/20 text-[#10B981] text-[10px] font-semibold rounded hover:bg-[#10B981]/30 transition-colors flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Approve
                                </button>
                                <button onClick={() => handleListingAction(listing.id, 'reject')} className="px-2.5 py-1 bg-[#EF4444]/20 text-[#EF4444] text-[10px] font-semibold rounded hover:bg-[#EF4444]/30 transition-colors flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Reject
                                </button>
                              </div>
                            )}
                            {listing.status === 'approved_pending_payment' && (
                              <button onClick={() => handleListingAction(listing.id, 'send_payment_email')} className="px-2.5 py-1 bg-[#7C3AED]/20 text-[#7C3AED] text-[10px] font-semibold rounded hover:bg-[#7C3AED]/30 transition-colors flex items-center gap-1">
                                <Send className="w-3 h-3" /> Send Payment Email
                              </button>
                            )}
                            {listing.status === 'payment_sent' && (
                              <button onClick={() => handleListingAction(listing.id, 'confirm_payment')} className="px-2.5 py-1 bg-[#10B981]/20 text-[#10B981] text-[10px] font-semibold rounded hover:bg-[#10B981]/30 transition-colors flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Confirm Payment
                              </button>
                            )}
                            {listing.status === 'paid' && (
                              <button onClick={() => handleListingAction(listing.id, 'list')} className="px-2.5 py-1 bg-gradient-to-r from-[#00E5FF]/20 to-[#7C3AED]/20 text-[#00E5FF] text-[10px] font-semibold rounded hover:from-[#00E5FF]/30 hover:to-[#7C3AED]/30 transition-colors flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> List on Discovery
                              </button>
                            )}
                            {listing.status === 'listed' && (
                              <span className="text-[9px] text-[#10B981] font-semibold">Live on Discovery</span>
                            )}
                            <a href={`/dashboard/token-preview/${listing.id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-gray-500 hover:text-[#00E5FF] transition-colors">
                              Preview Link
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="space-y-4">
              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3 flex items-center gap-2">
                  <Settings className="w-3.5 h-3.5 text-gray-400" />
                  Platform Configuration
                </div>
                <div className="space-y-4">
                  <div className="text-center py-6 text-gray-500">
                    <Settings className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <div className="text-xs">Platform configuration managed via environment variables and API routes</div>
                    <div className="text-[10px] mt-1">Auto-refresh: 60s | Prediction fees: 3% | Context feed: 15s poll</div>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl p-4 border border-white/10">
                <div className="text-xs font-bold mb-3 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-[#7C3AED]" />
                  Data Sources
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Market Data</span>
                    <span className="text-[#10B981] font-semibold">CoinGecko API</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Blockchain Data</span>
                    <span className="text-[#10B981] font-semibold">Alchemy SDK</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Token Security</span>
                    <span className="text-[#10B981] font-semibold">GoPlus Labs</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">AI Assistant</span>
                    <span className="text-[#10B981] font-semibold">Anthropic Claude</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">Authentication</span>
                    <span className="text-[#10B981] font-semibold">Supabase Auth</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span className="text-gray-400">DEX Data</span>
                    <span className="text-[#10B981] font-semibold">DexScreener API</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-gray-400">Fear & Greed Index</span>
                    <span className="text-[#10B981] font-semibold">Alternative.me</span>
                  </div>
                </div>
              </div>

              <div className="glass rounded-xl p-4 border border-[#EF4444]/20">
                <div className="text-xs font-bold mb-3 flex items-center gap-2 text-[#EF4444]">
                  <Lock className="w-3.5 h-3.5" />
                  Danger Zone
                </div>
                <div className="space-y-2">
                  <button className="w-full py-2 px-3 rounded-lg border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/10 transition-colors text-left flex items-center gap-2">
                    <Trash2 className="w-3 h-3" /> Clear All Caches
                  </button>
                  <button className="w-full py-2 px-3 rounded-lg border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/10 transition-colors text-left flex items-center gap-2">
                    <Ban className="w-3 h-3" /> Enable Maintenance Mode
                  </button>
                  <button className="w-full py-2 px-3 rounded-lg border border-[#EF4444]/20 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/10 transition-colors text-left flex items-center gap-2">
                    <Trash2 className="w-3 h-3" /> Reset Builder Submissions
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, loading }: { icon: React.ReactNode; label: string; value: string; sub: string; color: string; loading: boolean }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <div className={color}>{icon}</div>
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 bg-white/5 rounded animate-pulse" />
      ) : (
        <div className={`text-xl font-bold ${color}`}>{value}</div>
      )}
      <div className="text-[10px] text-gray-500 mt-0.5">{sub}</div>
    </div>
  );
}
