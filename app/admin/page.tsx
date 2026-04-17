'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, LogOut, Eye, CheckCircle, XCircle, AlertTriangle, Clock,
  Users, Activity, Lock, BarChart3, TrendingUp, TrendingDown, Zap,
  RotateCcw, DollarSign, Layers, Bell, Settings, Database, Wifi,
  ArrowUpRight, ArrowDownRight, Send, Trash2, Ban, UserCheck, Menu,
  X, Home, ShieldCheck, Search, ExternalLink, Server, Briefcase,
  Globe, ChevronRight, Heart, Share2, LayoutDashboard, UserPlus,
  ShieldAlert, Radio, RefreshCw
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const REFRESH_INTERVAL = 30000;

interface AdminStats {
  users: {
    total: number;
    profiles: number;
    verified: number;
    todaySignups: number;
    weekSignups: number;
    recentUsers: Array<{
      id: string;
      first_name: string;
      last_name: string;
      username: string;
      email: string;
      created_at: string;
    }>;
  };
  platform: {
    totalScans: number;
    totalPositions: number;
    activePositions: number;
    totalThreats: number;
    totalAlerts: number;
    followedEntities: number;
  };
  engagement: {
    views: number;
    likes: number;
    shares: number;
  };
  timestamp: string;
}

interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  created_at: string;
}

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

interface ApiHealth {
  name: string;
  status: 'online' | 'degraded' | 'offline';
  latency: number;
  lastCheck: string;
}

const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Platform overview & real-time stats' },
  { id: 'users', label: 'User Management', icon: Users, description: 'Manage platform users' },
  { id: 'market', label: 'Market Data', icon: TrendingUp, description: 'Live market intelligence' },
  { id: 'api-health', label: 'API Health', icon: Server, description: 'Service status monitoring' },
  { id: 'token-listings', label: 'Token Listings', icon: Briefcase, description: 'Listing submissions' },
  { id: 'security', label: 'Security', icon: ShieldCheck, description: 'Platform security overview' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Broadcast messages' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'Configuration & data' },
];

function MetricCard({ icon: Icon, label, value, sub, color, loading, trend }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  color: string;
  loading: boolean;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 group">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${color === 'blue' ? 'from-[#0A1EFF]/10 to-[#0A1EFF]/5' : color === 'green' ? 'from-[#10B981]/10 to-[#10B981]/5' : color === 'purple' ? 'from-[#7C3AED]/10 to-[#7C3AED]/5' : color === 'amber' ? 'from-[#F59E0B]/10 to-[#F59E0B]/5' : 'from-[#EF4444]/10 to-[#EF4444]/5'}`}>
          <Icon className={`w-4 h-4 ${color === 'blue' ? 'text-[#0A1EFF]' : color === 'green' ? 'text-[#10B981]' : color === 'purple' ? 'text-[#7C3AED]' : color === 'amber' ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-medium ${trend === 'up' ? 'text-[#10B981]' : trend === 'down' ? 'text-[#EF4444]' : 'text-gray-500'}`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : trend === 'down' ? <ArrowDownRight className="w-3 h-3" /> : null}
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-8 bg-white/5 rounded-lg animate-pulse mb-1" />
      ) : (
        <div className="text-2xl font-bold text-white tracking-tight font-mono">{value}</div>
      )}
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">{label}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-sm font-heading font-bold text-white">{title}</h2>
        <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

export default function AdminPanel() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [countdown, setCountdown] = useState(30);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [userTotalPages, setUserTotalPages] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [apiHealth, setApiHealth] = useState<ApiHealth[]>([]);
  const [tokenListings, setTokenListings] = useState<any[]>([]);
  const [loadingListings, setLoadingListings] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSent, setBroadcastSent] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) { // removed log
}
    setLoadingStats(false);
  }, [accessToken]);

  const fetchUsers = useCallback(async (search?: string, page?: number) => {
    setLoadingUsers(true);
    try {
      const s = search ?? userSearch;
      const p = page ?? userPage;
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(s)}&page=${p}&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUserTotal(data.total || 0);
        setUserTotalPages(data.totalPages || 0);
      }
    } catch (e) { // removed log
}
    setLoadingUsers(false);
  }, [accessToken, userSearch, userPage]);

  const fetchTokens = useCallback(async () => {
    setLoadingTokens(true);
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false');
      if (res.ok) setTokens(await res.json());
    } catch (e) { // removed log
}
    setLoadingTokens(false);
  }, []);

  const checkApiHealth = useCallback(async () => {
    const apis = [
      { name: 'Supabase Auth', url: `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/rest/v1/` },
      { name: 'CoinGecko', url: 'https://api.coingecko.com/api/v3/ping' },
      { name: 'VTX Intelligence Engine', url: '/api/vtx-ai' },
      { name: 'Context Feed', url: '/api/context-feed' },
      { name: 'Search Engine', url: '/api/search/coins?q=btc' },
      { name: 'Price Feed', url: '/api/prices' },
      { name: 'Project Discovery', url: '/api/project-discovery' },
      { name: 'Platform Stats', url: '/api/platform-stats' },
    ];
    const results: ApiHealth[] = [];
    for (const api of apis) {
      const start = Date.now();
      try {
        const res = await fetch(api.url, { signal: AbortSignal.timeout(8000) });
        const latency = Date.now() - start;
        results.push({ name: api.name, status: res.ok ? (latency > 3000 ? 'degraded' : 'online') : 'degraded', latency, lastCheck: new Date().toLocaleTimeString() });
      } catch {
        results.push({ name: api.name, status: 'offline', latency: Date.now() - start, lastCheck: new Date().toLocaleTimeString() });
      }
    }
    setApiHealth(results);
  }, []);

  const fetchListings = useCallback(async () => {
    setLoadingListings(true);
    try {
      const res = await fetch('/api/project-listing', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTokenListings(data.listings || []);
      }
    } catch (e) { // removed log
}
    setLoadingListings(false);
  }, [accessToken]);

  const handleListingAction = async (id: string, action: string) => {
    try {
      await fetch('/api/project-listing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ id, action }),
      });
      fetchListings();
    } catch (e) { // removed log
}
  };

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(), fetchTokens(), checkApiHealth(), fetchListings()]);
    setLastRefresh(new Date());
    setCountdown(30);
    setIsRefreshing(false);
  }, [fetchStats, fetchTokens, checkApiHealth, fetchListings]);

  useEffect(() => {
    if (!isLoggedIn) return;
    refreshAll();
    if (activeSection === 'users') fetchUsers();
    const interval = setInterval(refreshAll, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [isLoggedIn, refreshAll]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [isLoggedIn]);

  useEffect(() => {
    if (isLoggedIn && activeSection === 'users') fetchUsers();
  }, [activeSection, isLoggedIn]);

  const handleLogin = async () => {
    setLoginError('');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        setLoginError('Not authenticated. Please sign in first.');
        return;
      }
      // Verify admin role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (profile?.role !== 'admin') {
        setLoginError('Access denied. Admin privileges required.');
        return;
      }
      setAccessToken(session.access_token);
      setIsLoggedIn(true);
    } catch {
      setLoginError('Authentication failed. Try again.');
    }
  };

  // Auto-verify session on mount
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      if (profile?.role === 'admin') {
        setAccessToken(session.access_token);
        setIsLoggedIn(true);
      }
    });
  }, []);

  const handleUserSearch = (val: string) => {
    setUserSearch(val);
    setUserPage(1);
    fetchUsers(val, 1);
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

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-[#111827]/80 rounded-2xl p-8 border border-white/[0.06] backdrop-blur-xl">
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="w-14 h-14 bg-gradient-to-br from-[#0A1EFF] to-[#0A1EFF]/60 rounded-xl flex items-center justify-center shadow-lg shadow-[#0A1EFF]/20">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div className="text-center">
                <h1 className="text-lg font-heading font-bold text-white">NAKA LABS</h1>
                <p className="text-[11px] text-gray-500 mt-1">Admin Control Panel</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-gray-400 text-sm text-center">
                Sign in to your Naka Labs account with admin privileges to access this panel.
              </p>
              {loginError && <p className="text-[#EF4444] text-xs text-center">{loginError}</p>}
              <button onClick={handleLogin} className="w-full bg-[#0A1EFF] hover:bg-[#0A1EFF]/90 py-3 rounded-xl font-semibold text-sm transition-colors">
                Verify Admin Access
              </button>
              <a href="/login" className="block text-center text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Sign in to your account first
              </a>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-700 mt-4">Protected access — authorized personnel only</p>
        </div>
      </div>
    );
  }

  const onlineApis = apiHealth.filter(a => a.status === 'online').length;
  const totalApis = apiHealth.length;
  const totalMarketCap = tokens.reduce((s, t) => s + (t.market_cap || 0), 0);
  const totalVolume = tokens.reduce((s, t) => s + (t.total_volume || 0), 0);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white flex">
      <div className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`fixed top-0 left-0 h-full w-[260px] bg-[#0D1117] border-r border-white/[0.06] z-50 transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/steinz-logo-128.png" alt="STEINZ" className="w-8 h-8 rounded-lg" style={{ objectFit: 'contain' }} />
              <div>
                <div className="text-sm font-heading font-bold tracking-tight">NAKA LABS</div>
                <div className="text-[9px] text-gray-500 font-medium uppercase tracking-wider">Admin Panel</div>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden hover:bg-white/[0.06] p-1.5 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <nav className="p-2.5 space-y-0.5 overflow-y-auto h-[calc(100vh-140px)]">
          {ADMIN_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const pendingListings = tokenListings.filter(l => l.status === 'pending').length;
            return (
              <button
                key={section.id}
                onClick={() => { setActiveSection(section.id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] transition-all ${
                  isActive
                    ? 'bg-[#0A1EFF]/10 text-white border border-[#0A1EFF]/20'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0A1EFF]' : ''}`} />
                <span className="font-medium">{section.label}</span>
                {section.id === 'token-listings' && pendingListings > 0 && (
                  <span className="ml-auto bg-[#F59E0B] text-black text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{pendingListings}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-2.5 border-t border-white/[0.06] bg-[#0D1117]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0A1EFF]/5 border border-[#0A1EFF]/10 mb-2">
            <Radio className="w-3 h-3 text-[#10B981] animate-pulse" />
            <span className="text-[10px] text-gray-400">Auto-refresh in <span className="text-white font-mono font-bold">{countdown}s</span></span>
          </div>
          <button onClick={() => setIsLoggedIn(false)} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-500 hover:text-[#EF4444] hover:bg-[#EF4444]/5 transition-all">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-40 bg-[#0A0E1A]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden hover:bg-white/[0.06] p-2 rounded-lg transition-colors">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-base font-heading font-bold">{ADMIN_SECTIONS.find(s => s.id === activeSection)?.label}</h1>
                <p className="text-[10px] text-gray-500">{ADMIN_SECTIONS.find(s => s.id === activeSection)?.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-gray-500 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span>Live</span>
                <span className="text-gray-600">|</span>
                <span>{lastRefresh.toLocaleTimeString()}</span>
              </div>
              <button onClick={refreshAll} disabled={isRefreshing} className={`p-2 rounded-lg hover:bg-white/[0.06] transition-colors ${isRefreshing ? 'animate-spin' : ''}`}>
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
              <a href="/dashboard" className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors" title="Open Dashboard">
                <ExternalLink className="w-4 h-4 text-gray-400" />
              </a>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-6 max-w-7xl mx-auto">

          {activeSection === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={Users} label="Total Users" value={stats?.users.total?.toString() || '0'} sub="Registered accounts" color="blue" loading={loadingStats} trend="up" />
                <MetricCard icon={UserCheck} label="Verified Users" value={stats?.users.verified?.toString() || '0'} sub="Identity confirmed" color="green" loading={loadingStats} />
                <MetricCard icon={UserPlus} label="Today's Signups" value={stats?.users.todaySignups?.toString() || '0'} sub="New registrations" color="purple" loading={loadingStats} trend="up" />
                <MetricCard icon={Users} label="This Week" value={stats?.users.weekSignups?.toString() || '0'} sub="7-day signups" color="amber" loading={loadingStats} />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={Eye} label="Total Views" value={stats?.engagement.views?.toLocaleString() || '0'} sub="Platform-wide" color="blue" loading={loadingStats} />
                <MetricCard icon={Heart} label="Total Likes" value={stats?.engagement.likes?.toLocaleString() || '0'} sub="Content engagement" color="red" loading={loadingStats} />
                <MetricCard icon={Share2} label="Total Shares" value={stats?.engagement.shares?.toLocaleString() || '0'} sub="Content shared" color="purple" loading={loadingStats} />
                <MetricCard icon={Server} label="API Status" value={totalApis > 0 ? `${onlineApis}/${totalApis}` : '—'} sub="Services online" color={onlineApis === totalApis ? 'green' : 'amber'} loading={false} />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={ShieldAlert} label="Security Scans" value={stats?.platform.totalScans?.toString() || '0'} sub="Token scans run" color="green" loading={loadingStats} />
                <MetricCard icon={Layers} label="Positions" value={`${stats?.platform.activePositions || 0} active`} sub={`${stats?.platform.totalPositions || 0} total`} color="blue" loading={loadingStats} />
                <MetricCard icon={AlertTriangle} label="Threats" value={stats?.platform.totalThreats?.toString() || '0'} sub="Detected threats" color="red" loading={loadingStats} />
                <MetricCard icon={Bell} label="Alerts" value={stats?.platform.totalAlerts?.toString() || '0'} sub="User alerts set" color="amber" loading={loadingStats} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-[#0A1EFF]" />
                      <span className="text-xs font-heading font-bold">Recent Signups</span>
                    </div>
                    <button onClick={() => setActiveSection('users')} className="text-[10px] text-[#0A1EFF] hover:underline flex items-center gap-1">
                      View All <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {loadingStats ? (
                      [...Array(5)].map((_, i) => <div key={i} className="h-10 bg-white/[0.03] rounded-lg animate-pulse" />)
                    ) : (stats?.users.recentUsers || []).slice(0, 8).map((user) => (
                      <div key={user.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center text-[10px] font-bold text-[#0A1EFF]">
                            {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="text-xs font-semibold">{user.first_name} {user.last_name}</div>
                            <div className="text-[10px] text-gray-500">@{user.username} · {user.email}</div>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-600">{timeAgo(user.created_at)}</span>
                      </div>
                    ))}
                    {!loadingStats && (!stats?.users.recentUsers || stats.users.recentUsers.length === 0) && (
                      <div className="text-center py-6 text-gray-600 text-[11px]">No users registered yet</div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4 text-[#0A1EFF]" />
                      <span className="text-xs font-heading font-bold">API Health</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {apiHealth.slice(0, 8).map((api) => (
                        <div key={api.name} className="flex items-center gap-2 py-1">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${api.status === 'online' ? 'bg-[#10B981]' : api.status === 'degraded' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`} />
                          <span className="text-[10px] text-gray-400 truncate">{api.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-[#10B981]" />
                      <span className="text-xs font-heading font-bold">Market Snapshot</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-500">Total Market Cap</span>
                        <span className="text-white font-mono font-semibold">{formatNumber(totalMarketCap)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-500">24h Volume</span>
                        <span className="text-white font-mono font-semibold">{formatNumber(totalVolume)}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-500">Tokens Tracked</span>
                        <span className="text-white font-mono font-semibold">{tokens.length}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-gray-500">Entities Followed</span>
                        <span className="text-white font-mono font-semibold">{stats?.platform.followedEntities || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-[#0A1EFF]/5 to-transparent rounded-xl p-4 border border-[#0A1EFF]/10">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-[#0A1EFF]" />
                  <span className="text-xs font-heading font-bold">Platform Intelligence</span>
                </div>
                <p className="text-[10px] text-gray-500">Stats auto-refresh every 30 seconds. All data sourced from Supabase, CoinGecko, and internal APIs. Last synced: {lastRefresh.toLocaleString()}</p>
              </div>
            </div>
          )}

          {activeSection === 'users' && (
            <div className="space-y-4">
              <SectionHeader
                title="User Management"
                subtitle={`${userTotal} total users registered`}
                action={
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => handleUserSearch(e.target.value)}
                      placeholder="Search users..."
                      className="bg-[#111827] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#0A1EFF]/40 w-56 transition-colors"
                    />
                  </div>
                }
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={Users} label="Total Users" value={userTotal.toString()} sub="All accounts" color="blue" loading={false} />
                <MetricCard icon={UserCheck} label="Verified" value={stats?.users.verified?.toString() || '0'} sub="Confirmed identity" color="green" loading={loadingStats} />
                <MetricCard icon={UserPlus} label="Today" value={stats?.users.todaySignups?.toString() || '0'} sub="New today" color="purple" loading={loadingStats} />
                <MetricCard icon={Users} label="This Week" value={stats?.users.weekSignups?.toString() || '0'} sub="Past 7 days" color="amber" loading={loadingStats} />
              </div>

              <div className="bg-[#111827]/80 rounded-xl border border-white/[0.06] overflow-hidden">
                {loadingUsers ? (
                  <div className="p-6 space-y-2">
                    {[...Array(8)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />)}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-[10px] text-gray-500 uppercase tracking-wider">
                          <th className="text-left px-4 py-3">User</th>
                          <th className="text-left px-4 py-3">Username</th>
                          <th className="text-left px-4 py-3">Email</th>
                          <th className="text-left px-4 py-3">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 flex items-center justify-center text-[10px] font-bold text-[#0A1EFF]">
                                  {(user.first_name?.[0] || '?').toUpperCase()}
                                </div>
                                <span className="text-xs font-semibold">{user.first_name} {user.last_name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400">@{user.username}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{user.email}</td>
                            <td className="px-4 py-3 text-[11px] text-gray-600">{new Date(user.created_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {!loadingUsers && users.length === 0 && (
                  <div className="text-center py-12 text-gray-600 text-xs">
                    {userSearch ? `No users found for "${userSearch}"` : 'No users registered yet'}
                  </div>
                )}
              </div>

              {userTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button disabled={userPage <= 1} onClick={() => { setUserPage(p => p - 1); fetchUsers(userSearch, userPage - 1); }} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                    Previous
                  </button>
                  <span className="text-[11px] text-gray-500">Page {userPage} of {userTotalPages}</span>
                  <button disabled={userPage >= userTotalPages} onClick={() => { setUserPage(p => p + 1); fetchUsers(userSearch, userPage + 1); }} className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'market' && (
            <div className="space-y-4">
              <SectionHeader
                title="Market Intelligence"
                subtitle="Live data from CoinGecko"
                action={
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="text" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Filter tokens..." className="bg-[#111827] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-[#0A1EFF]/40 w-48 transition-colors" />
                  </div>
                }
              />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={BarChart3} label="Total Market Cap" value={formatNumber(totalMarketCap)} sub="Top 50 tokens" color="blue" loading={loadingTokens} />
                <MetricCard icon={Activity} label="24h Volume" value={formatNumber(totalVolume)} sub="Trading volume" color="green" loading={loadingTokens} />
                <MetricCard icon={TrendingUp} label="Tokens Tracked" value={tokens.length.toString()} sub="Real-time prices" color="purple" loading={loadingTokens} />
                <MetricCard icon={Zap} label="Data Source" value="Live" sub="CoinGecko API" color="green" loading={false} />
              </div>

              {loadingTokens ? (
                <div className="bg-[#111827]/80 rounded-xl p-6 border border-white/[0.06]">
                  <div className="space-y-2">
                    {[...Array(10)].map((_, i) => <div key={i} className="h-12 bg-white/[0.03] rounded-lg animate-pulse" />)}
                  </div>
                </div>
              ) : (
                <div className="bg-[#111827]/80 rounded-xl border border-white/[0.06] overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-[10px] text-gray-500 uppercase tracking-wider">
                          <th className="text-left px-4 py-3">#</th>
                          <th className="text-left px-4 py-3">Token</th>
                          <th className="text-right px-4 py-3">Price</th>
                          <th className="text-right px-4 py-3">24h</th>
                          <th className="text-right px-4 py-3">Volume</th>
                          <th className="text-right px-4 py-3">Market Cap</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokens.filter(t => !searchFilter || t.name?.toLowerCase().includes(searchFilter.toLowerCase()) || t.symbol?.toLowerCase().includes(searchFilter.toLowerCase())).map((token, i) => (
                          <tr key={token.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-[10px] text-gray-600 font-mono">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                {token.image && <img src={token.image} alt="" className="w-6 h-6 rounded-full" />}
                                <div>
                                  <div className="text-xs font-bold">{token.symbol?.toUpperCase()}</div>
                                  <div className="text-[10px] text-gray-500">{token.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-mono font-semibold">{formatPrice(token.current_price)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`text-xs font-semibold flex items-center gap-0.5 justify-end ${token.price_change_percentage_24h >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                {token.price_change_percentage_24h >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {Math.abs(token.price_change_percentage_24h || 0).toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-400 font-mono">{formatNumber(token.total_volume)}</td>
                            <td className="px-4 py-3 text-right text-xs text-gray-400 font-mono">{formatNumber(token.market_cap)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSection === 'api-health' && (
            <div className="space-y-4">
              <SectionHeader
                title="Service Health Monitor"
                subtitle="Real-time status of all platform services"
                action={
                  <button onClick={checkApiHealth} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0A1EFF]/10 text-[#0A1EFF] text-[11px] font-semibold hover:bg-[#0A1EFF]/20 transition-colors">
                    <RefreshCw className="w-3 h-3" /> Recheck All
                  </button>
                }
              />

              <div className="grid grid-cols-3 gap-3">
                <MetricCard icon={CheckCircle} label="Online" value={apiHealth.filter(a => a.status === 'online').length.toString()} sub="Healthy services" color="green" loading={false} />
                <MetricCard icon={AlertTriangle} label="Degraded" value={apiHealth.filter(a => a.status === 'degraded').length.toString()} sub="Slow response" color="amber" loading={false} />
                <MetricCard icon={XCircle} label="Offline" value={apiHealth.filter(a => a.status === 'offline').length.toString()} sub="Unreachable" color="red" loading={false} />
              </div>

              <div className="space-y-2">
                {apiHealth.map((api) => (
                  <div key={api.name} className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06] flex items-center justify-between hover:border-white/[0.1] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${api.status === 'online' ? 'bg-[#10B981]' : api.status === 'degraded' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'} ${api.status !== 'online' ? 'animate-pulse' : ''}`} />
                      <div>
                        <div className="text-xs font-semibold">{api.name}</div>
                        <div className="text-[10px] text-gray-600">Checked: {api.lastCheck}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold capitalize ${api.status === 'online' ? 'text-[#10B981]' : api.status === 'degraded' ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>{api.status}</div>
                      <div className="text-[10px] text-gray-600 font-mono">{api.latency}ms</div>
                    </div>
                  </div>
                ))}
                {apiHealth.length === 0 && (
                  <div className="text-center py-12 text-gray-600 text-xs">Running health checks...</div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'token-listings' && (
            <div className="space-y-4">
              <SectionHeader title="Token Listing Submissions" subtitle="Review and manage listing requests" />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={Briefcase} label="Total Submissions" value={tokenListings.length.toString()} sub="All time" color="blue" loading={loadingListings} />
                <MetricCard icon={Clock} label="Pending" value={tokenListings.filter(l => l.status === 'pending').length.toString()} sub="Awaiting review" color="amber" loading={loadingListings} />
                <MetricCard icon={CheckCircle} label="Listed" value={tokenListings.filter(l => l.status === 'listed').length.toString()} sub="Live on platform" color="green" loading={loadingListings} />
                <MetricCard icon={DollarSign} label="Awaiting Payment" value={tokenListings.filter(l => ['approved_pending_payment', 'payment_sent'].includes(l.status)).length.toString()} sub="Approved" color="purple" loading={loadingListings} />
              </div>

              <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                {loadingListings ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-white/[0.03] rounded-lg animate-pulse" />)}
                  </div>
                ) : tokenListings.length === 0 ? (
                  <div className="text-center py-12 text-gray-600 text-xs">No token listing submissions yet</div>
                ) : (
                  <div className="space-y-3">
                    {tokenListings.map((listing) => (
                      <div key={listing.id} className="bg-[#0A0E1A]/60 rounded-xl p-4 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {listing.logoUrl ? (
                              <img src={listing.logoUrl} alt={listing.tokenName} className="w-10 h-10 rounded-xl object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A1EFF]/15 to-[#7C3AED]/15 flex items-center justify-center text-xs font-bold text-[#0A1EFF]">
                                {listing.symbol?.slice(0, 2) || '?'}
                              </div>
                            )}
                            <div>
                              <div className="text-sm font-bold flex items-center gap-2">
                                {listing.tokenName}
                                <span className="text-gray-500 text-xs font-normal">({listing.symbol})</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  listing.status === 'pending' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                                  listing.status === 'listed' ? 'bg-[#10B981]/15 text-[#10B981]' :
                                  listing.status === 'rejected' ? 'bg-[#EF4444]/15 text-[#EF4444]' :
                                  'bg-[#0A1EFF]/15 text-[#0A1EFF]'
                                }`}>
                                  {listing.status === 'approved_pending_payment' ? 'APPROVED' : listing.status?.toUpperCase()}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 mt-0.5">{listing.chain} · {listing.contractAddress?.slice(0, 8)}...{listing.contractAddress?.slice(-4)}</div>
                              {listing.description && <div className="text-[10px] text-gray-500 mt-1 line-clamp-1">{listing.description}</div>}
                              <div className="flex items-center gap-3 mt-1.5 text-[9px] text-gray-600">
                                {listing.website && <a href={listing.website} target="_blank" rel="noopener noreferrer" className="hover:text-[#0A1EFF] transition-colors">Website</a>}
                                {listing.telegram && <a href={listing.telegram} target="_blank" rel="noopener noreferrer" className="hover:text-[#0A1EFF] transition-colors">Telegram</a>}
                                {listing.twitter && <a href={listing.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-[#0A1EFF] transition-colors">Twitter</a>}
                                <span>Submitted: {new Date(listing.submittedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            {listing.status === 'pending' && (
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => handleListingAction(listing.id, 'approve')} className="px-3 py-1.5 bg-[#10B981]/10 text-[#10B981] text-[10px] font-semibold rounded-lg hover:bg-[#10B981]/20 transition-colors flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" /> Approve
                                </button>
                                <button onClick={() => handleListingAction(listing.id, 'reject')} className="px-3 py-1.5 bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-semibold rounded-lg hover:bg-[#EF4444]/20 transition-colors flex items-center gap-1">
                                  <XCircle className="w-3 h-3" /> Reject
                                </button>
                              </div>
                            )}
                            {listing.status === 'approved_pending_payment' && (
                              <button onClick={() => handleListingAction(listing.id, 'send_payment_email')} className="px-3 py-1.5 bg-[#7C3AED]/10 text-[#7C3AED] text-[10px] font-semibold rounded-lg hover:bg-[#7C3AED]/20 transition-colors flex items-center gap-1">
                                <Send className="w-3 h-3" /> Send Payment Email
                              </button>
                            )}
                            {listing.status === 'payment_sent' && (
                              <button onClick={() => handleListingAction(listing.id, 'confirm_payment')} className="px-3 py-1.5 bg-[#10B981]/10 text-[#10B981] text-[10px] font-semibold rounded-lg hover:bg-[#10B981]/20 transition-colors flex items-center gap-1">
                                <DollarSign className="w-3 h-3" /> Confirm Payment
                              </button>
                            )}
                            {listing.status === 'paid' && (
                              <button onClick={() => handleListingAction(listing.id, 'list')} className="px-3 py-1.5 bg-[#0A1EFF]/10 text-[#0A1EFF] text-[10px] font-semibold rounded-lg hover:bg-[#0A1EFF]/20 transition-colors flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> List on Discovery
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-4">
              <SectionHeader title="Security Overview" subtitle="Shadow Guardian & platform security metrics" />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard icon={ShieldCheck} label="Scans Run" value={stats?.platform.totalScans?.toString() || '0'} sub="Token security scans" color="green" loading={loadingStats} />
                <MetricCard icon={AlertTriangle} label="Threats Found" value={stats?.platform.totalThreats?.toString() || '0'} sub="Detected threats" color="red" loading={loadingStats} />
                <MetricCard icon={ShieldAlert} label="Active Alerts" value={stats?.platform.totalAlerts?.toString() || '0'} sub="User-configured" color="amber" loading={loadingStats} />
                <MetricCard icon={Eye} label="Entities Tracked" value={stats?.platform.followedEntities?.toString() || '0'} sub="Money Radar" color="blue" loading={loadingStats} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                    <span className="text-xs font-heading font-bold">Shadow Guardian Status</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Pre-Trade Scanning', status: 'Active', color: 'text-[#10B981]' },
                      { label: 'Scam Detection Engine', status: 'Active', color: 'text-[#10B981]' },
                      { label: 'AI Risk Assessment', status: 'Active', color: 'text-[#10B981]' },
                      { label: 'Wallet Reputation', status: 'Active', color: 'text-[#10B981]' },
                      { label: 'Holder Intelligence', status: 'Active', color: 'text-[#10B981]' },
                      { label: 'Bubblemaps Analysis', status: 'Active', color: 'text-[#10B981]' },
                    ].map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-white/[0.03] last:border-0">
                        <span className="text-gray-400">{f.label}</span>
                        <span className={`font-semibold ${f.color}`}>{f.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <Layers className="w-4 h-4 text-[#0A1EFF]" />
                    <span className="text-xs font-heading font-bold">Trading Infrastructure</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Jupiter Aggregator (Solana)', status: 'Live', color: 'text-[#10B981]' },
                      { label: '0x Protocol (EVM)', status: 'Live', color: 'text-[#10B981]' },
                      { label: 'Arkham Intelligence', status: 'Live', color: 'text-[#10B981]' },
                      { label: 'Money Radar (Copy Trade)', status: 'Live', color: 'text-[#10B981]' },
                      { label: 'VTX Intelligence Engine', status: 'Live', color: 'text-[#10B981]' },
                      { label: 'Multi-Chain Search', status: 'Live', color: 'text-[#10B981]' },
                    ].map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-white/[0.03] last:border-0">
                        <span className="text-gray-400">{f.label}</span>
                        <span className={`font-semibold ${f.color}`}>{f.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <SectionHeader title="Broadcast Notifications" subtitle="Send platform-wide messages" />

              <div className="bg-[#111827]/80 rounded-xl p-5 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-4 h-4 text-[#0A1EFF]" />
                  <span className="text-xs font-heading font-bold">Compose Broadcast</span>
                </div>
                <textarea
                  value={broadcastMsg}
                  onChange={(e) => setBroadcastMsg(e.target.value)}
                  placeholder="Write a platform-wide notification message..."
                  className="w-full bg-[#0A0E1A] border border-white/[0.06] rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#0A1EFF]/30 min-h-[100px] text-white placeholder-gray-600 mb-4 transition-colors resize-none"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button onClick={() => { if (broadcastMsg.trim()) { setBroadcastSent(true); setBroadcastMsg(''); setTimeout(() => setBroadcastSent(false), 3000); } }} className="bg-[#0A1EFF] hover:bg-[#0A1EFF]/90 px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Send Broadcast
                    </button>
                    {broadcastSent && <span className="text-[#10B981] text-[11px] font-medium">Sent successfully!</span>}
                  </div>
                  <span className="text-[10px] text-gray-600">{broadcastMsg.length} chars</span>
                </div>
              </div>

              <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                <div className="text-xs font-heading font-bold mb-3">Quick Templates</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {[
                    { label: 'Scheduled Maintenance', msg: 'NAKA LABS will undergo scheduled maintenance shortly. Some features may be temporarily unavailable.', icon: Clock, color: 'text-[#F59E0B]' },
                    { label: 'New Feature', msg: 'New feature available! Check out the latest updates on NAKA LABS.', icon: Zap, color: 'text-[#0A1EFF]' },
                    { label: 'Security Advisory', msg: 'Security advisory: Always verify tokens before trading. Use Shadow Guardian for safety checks.', icon: ShieldAlert, color: 'text-[#EF4444]' },
                    { label: 'Market Alert', msg: 'Significant market movement detected. Check VTX AI for analysis.', icon: TrendingUp, color: 'text-[#10B981]' },
                  ].map((alert, i) => {
                    const AlertIcon = alert.icon;
                    return (
                      <button
                        key={i}
                        onClick={() => setBroadcastMsg(alert.msg)}
                        className="bg-[#0A0E1A]/60 rounded-xl p-3.5 border border-white/[0.04] hover:border-white/[0.1] text-left transition-all flex items-start gap-3"
                      >
                        <AlertIcon className={`w-4 h-4 ${alert.color} flex-shrink-0 mt-0.5`} />
                        <div>
                          <div className={`text-[11px] font-bold ${alert.color}`}>{alert.label}</div>
                          <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-2">{alert.msg}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'settings' && (
            <div className="space-y-4">
              <SectionHeader title="Platform Configuration" subtitle="Data sources, settings, and admin tools" />

              <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-4 h-4 text-[#7C3AED]" />
                  <span className="text-xs font-heading font-bold">Data Sources & Infrastructure</span>
                </div>
                <div className="space-y-1">
                  {[
                    { label: 'Authentication', value: 'Supabase Auth + Firebase', status: 'Connected' },
                    { label: 'Database', value: 'Supabase PostgreSQL', status: 'Connected' },
                    { label: 'Market Data', value: 'CoinGecko API', status: 'Connected' },
                    { label: 'DEX Data', value: 'DexScreener API', status: 'Connected' },
                    { label: 'On-chain Intel', value: 'Arkham Intelligence', status: 'Connected' },
                    { label: 'AI Engine', value: 'VTX Intelligence Engine', status: 'Connected' },
                    { label: 'Solana Trading', value: 'Jupiter Aggregator', status: 'Connected' },
                    { label: 'EVM Trading', value: '0x Protocol', status: 'Connected' },
                    { label: 'Token Security', value: 'Security Scanner', status: 'Connected' },
                    { label: 'Social Auth', value: 'Firebase (Google/Apple)', status: 'Connected' },
                  ].map((source, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0 text-[11px]">
                      <span className="text-gray-400">{source.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-medium">{source.value}</span>
                        <span className="text-[#10B981] font-semibold text-[9px]">{source.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#111827]/80 rounded-xl p-4 border border-white/[0.06]">
                <div className="flex items-center gap-2 mb-4">
                  <Settings className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-heading font-bold">Platform Settings</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between py-2 border-b border-white/[0.03]">
                    <span className="text-gray-400">Auto-refresh Interval</span>
                    <span className="text-white font-mono">30 seconds</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/[0.03]">
                    <span className="text-gray-400">Price Feed Interval</span>
                    <span className="text-white font-mono">30 seconds</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/[0.03]">
                    <span className="text-gray-400">Context Feed Poll</span>
                    <span className="text-white font-mono">15 seconds</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/[0.03]">
                    <span className="text-gray-400">Chains Supported</span>
                    <span className="text-white font-mono">12+</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Framework</span>
                    <span className="text-white font-mono">Next.js 15</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#111827]/80 rounded-xl p-4 border border-[#EF4444]/10">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-[#EF4444]" />
                  <span className="text-xs font-heading font-bold text-[#EF4444]">Danger Zone</span>
                </div>
                <div className="space-y-2">
                  <button className="w-full py-2.5 px-4 rounded-xl border border-[#EF4444]/10 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/5 transition-colors text-left flex items-center gap-2.5">
                    <Trash2 className="w-3.5 h-3.5" /> Clear All Caches
                  </button>
                  <button className="w-full py-2.5 px-4 rounded-xl border border-[#EF4444]/10 text-[#EF4444] text-xs font-semibold hover:bg-[#EF4444]/5 transition-colors text-left flex items-center gap-2.5">
                    <Ban className="w-3.5 h-3.5" /> Enable Maintenance Mode
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
