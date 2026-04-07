'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Users, BarChart3, Mail, Shield, Activity, Search, ChevronLeft, ChevronRight, Send, RefreshCw, AlertTriangle, Eye, Server, Database, Cpu, Globe, Clock, FlaskConical, Plus, Trash2, Image, Tag, DollarSign, Heart, Briefcase, TrendingUp, TrendingDown, Award, Building } from 'lucide-react';
import { useRouter } from 'next/navigation';

const ADMIN_PASSWORD = '195656';

type AdminTab = 'dashboard' | 'users' | 'broadcast' | 'research' | 'system' | 'revenue' | 'team';

interface UserData {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  tier?: string;
  created_at: string;
}

interface PlatformStats {
  users: {
    total: number;
    profiles: number;
    verified: number;
    todaySignups: number;
    weekSignups: number;
    recentUsers: UserData[];
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

function StatBox({ label, value, icon: Icon, color = '#0A1EFF' }: { label: string; value: string | number; icon: React.ElementType; color?: string }) {
  return (
    <div className="bg-[#111827] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <div className="text-xl font-bold text-white font-mono">{value}</div>
      <div className="text-[11px] text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AdminPanel() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState('all');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // Research state
  const [researchTitle, setResearchTitle] = useState('');
  const [researchSummary, setResearchSummary] = useState('');
  const [researchContent, setResearchContent] = useState('');
  const [researchCategory, setResearchCategory] = useState('General');
  const [researchImageUrl, setResearchImageUrl] = useState('');
  const [researchTags, setResearchTags] = useState('');
  const [researchPublished, setResearchPublished] = useState(true);
  const [researchSaving, setResearchSaving] = useState(false);
  const [researchResult, setResearchResult] = useState('');
  const [researchPosts, setResearchPosts] = useState<any[]>([]);

  const fetchStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/admin/stats?password=${ADMIN_PASSWORD}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {} finally {
      setRefreshing(false);
    }
  }, []);

  const fetchUsers = useCallback(async (page = 1, search = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        password: ADMIN_PASSWORD,
        page: page.toString(),
        limit: '20',
      });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setUsersTotal(data.total || 0);
        setUsersPage(data.page || 1);
        setUsersTotalPages(data.totalPages || 1);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthenticated(true);
      fetchStats();
      fetchUsers();
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastSubject.trim() || !broadcastBody.trim()) return;
    setBroadcastSending(true);
    setBroadcastResult('');
    try {
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: ADMIN_PASSWORD,
          subject: broadcastSubject,
          body: broadcastBody,
          targetTier: broadcastTarget,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastResult(`Sent to ${data.sent} of ${data.total} users`);
        setBroadcastSubject('');
        setBroadcastBody('');
      } else {
        setBroadcastResult(`Error: ${data.error}`);
      }
    } catch {
      setBroadcastResult('Failed to send broadcast');
    } finally {
      setBroadcastSending(false);
    }
  };

  useEffect(() => {
    if (authenticated) {
      const interval = setInterval(fetchStats, 60000);
      return () => clearInterval(interval);
    }
  }, [authenticated, fetchStats]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] text-white flex items-center justify-center">
        <div className="w-full max-w-sm p-6">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-[#0A1EFF]/20 to-[#4F46E5]/20 rounded-2xl flex items-center justify-center border border-[#0A1EFF]/10">
              <Shield className="w-7 h-7 text-[#0A1EFF]" />
            </div>
            <h1 className="text-xl font-bold">STEINZ Admin</h1>
            <p className="text-xs text-gray-500 mt-1">Platform Management Console</p>
          </div>
          <div className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="Admin password"
              className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40 transition-colors"
            />
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-xl font-bold text-sm transition-colors"
            >
              Access Admin Panel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleResearchSave = async () => {
    if (!researchTitle.trim() || !researchContent.trim()) {
      setResearchResult('Error: Title and content are required');
      return;
    }
    setResearchSaving(true);
    setResearchResult('');
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: ADMIN_PASSWORD,
          title: researchTitle,
          summary: researchSummary,
          content: researchContent,
          category: researchCategory,
          image_url: researchImageUrl || null,
          tags: researchTags.split(',').map(t => t.trim()).filter(Boolean),
          published: researchPublished,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResearchResult('Post published successfully');
        setResearchTitle(''); setResearchSummary(''); setResearchContent('');
        setResearchImageUrl(''); setResearchTags('');
        // Refresh posts list
        const r = await fetch('/api/research?limit=20');
        const d = await r.json();
        setResearchPosts(d.posts || []);
      } else {
        setResearchResult('Error: ' + (data.error || 'Failed to save'));
      }
    } catch {
      setResearchResult('Error: Network error');
    } finally {
      setResearchSaving(false);
    }
  };

  const handleResearchDelete = async (id: string) => {
    try {
      await fetch(`/api/research?id=${id}&password=${ADMIN_PASSWORD}`, { method: 'DELETE' });
      setResearchPosts(prev => prev.filter(p => p.id !== id));
    } catch {}
  };

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Overview', icon: BarChart3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'broadcast', label: 'Broadcast', icon: Mail },
    { id: 'research', label: 'Research', icon: FlaskConical },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'team', label: 'Team', icon: Heart },
    { id: 'system', label: 'System', icon: Server },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <div className="sticky top-0 z-40 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={() => router.back()} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#0A1EFF]" />
              <span className="text-sm font-bold">STEINZ Admin</span>
              <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 rounded text-[9px] font-bold">ADMIN</span>
            </div>
          </div>
          <button onClick={fetchStats} className="p-2 hover:bg-white/[0.06] rounded-lg transition-colors" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex border-b border-white/[0.04] px-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'users') fetchUsers(1, userSearch);
                if (tab.id === 'research') {
                  fetch('/api/research?limit=20').then(r => r.json()).then(d => setResearchPosts(d.posts || [])).catch(() => {});
                }
              }}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium relative transition-colors ${
                activeTab === tab.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#0A1EFF]" />}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-7xl mx-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatBox label="Total Users" value={stats?.users.total || 0} icon={Users} />
              <StatBox label="Signups Today" value={stats?.users.todaySignups || 0} icon={Activity} color="#10B981" />
              <StatBox label="Week Signups" value={stats?.users.weekSignups || 0} icon={BarChart3} color="#8B5CF6" />
              <StatBox label="Verified Users" value={stats?.users.verified || 0} icon={Shield} color="#F59E0B" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatBox label="Total Scans" value={stats?.platform.totalScans || 0} icon={Eye} color="#EC4899" />
              <StatBox label="Active Positions" value={stats?.platform.activePositions || 0} icon={Activity} color="#10B981" />
              <StatBox label="Threats Detected" value={stats?.platform.totalThreats || 0} icon={AlertTriangle} color="#EF4444" />
              <StatBox label="Active Alerts" value={stats?.platform.totalAlerts || 0} icon={Globe} color="#F97316" />
              <StatBox label="Followed Entities" value={stats?.platform.followedEntities || 0} icon={Users} color="#06B6D4" />
              <StatBox label="Total Engagement" value={(stats?.engagement.views || 0) + (stats?.engagement.likes || 0) + (stats?.engagement.shares || 0)} icon={BarChart3} />
            </div>

            {stats?.users.recentUsers && stats.users.recentUsers.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3">Recent Signups</h3>
                <div className="bg-[#111827] border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-4 gap-2 px-4 py-2.5 text-[10px] text-gray-500 font-semibold uppercase border-b border-white/[0.04]">
                    <span>User</span>
                    <span>Email</span>
                    <span>Username</span>
                    <span>Joined</span>
                  </div>
                  {stats.users.recentUsers.slice(0, 10).map((user: any) => (
                    <div key={user.id} className="grid grid-cols-4 gap-2 px-4 py-3 border-b border-white/[0.04] last:border-0 text-xs hover:bg-white/[0.02]">
                      <span className="text-white truncate">{user.first_name} {user.last_name}</span>
                      <span className="text-gray-400 truncate">{user.email}</span>
                      <span className="text-gray-400">@{user.username}</span>
                      <span className="text-gray-500">{new Date(user.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {stats?.timestamp && (
              <div className="flex items-center gap-1.5 text-[10px] text-gray-600">
                <Clock className="w-3 h-3" />
                Last updated: {new Date(stats.timestamp).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-[#111827] border border-white/[0.06] rounded-xl px-3 py-2.5 focus-within:border-[#0A1EFF]/30">
                <Search className="w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchUsers(1, userSearch)}
                  placeholder="Search users by name, email, username..."
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder-gray-600"
                />
              </div>
              <button onClick={() => fetchUsers(1, userSearch)} className="px-4 py-2.5 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-xl text-xs font-bold transition-colors">
                Search
              </button>
            </div>

            <div className="text-xs text-gray-500">
              {usersTotal} total users {userSearch && `matching "${userSearch}"`}
            </div>

            <div className="bg-[#111827] border border-white/[0.06] rounded-xl overflow-hidden">
              <div className="grid grid-cols-5 gap-2 px-4 py-2.5 text-[10px] text-gray-500 font-semibold uppercase border-b border-white/[0.04]">
                <span>Name</span>
                <span>Email</span>
                <span>Username</span>
                <span>Tier</span>
                <span>Joined</span>
              </div>
              {loading ? (
                <div className="py-10 text-center">
                  <div className="w-6 h-6 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin mx-auto" />
                </div>
              ) : users.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">No users found</div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="grid grid-cols-5 gap-2 px-4 py-3 border-b border-white/[0.04] last:border-0 text-xs hover:bg-white/[0.02]">
                    <span className="text-white truncate">{user.first_name} {user.last_name}</span>
                    <span className="text-gray-400 truncate">{user.email}</span>
                    <span className="text-gray-400">@{user.username}</span>
                    <span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        user.tier === 'premium' ? 'bg-[#F59E0B]/15 text-[#F59E0B]' :
                        user.tier === 'pro' ? 'bg-[#0A1EFF]/15 text-[#0A1EFF]' :
                        'bg-gray-700/50 text-gray-400'
                      }`}>
                        {(user.tier || 'free').toUpperCase()}
                      </span>
                    </span>
                    <span className="text-gray-500">{new Date(user.created_at).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>

            {usersTotalPages > 1 && (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => fetchUsers(usersPage - 1, userSearch)}
                  disabled={usersPage <= 1}
                  className="flex items-center gap-1 px-3 py-2 bg-white/[0.04] rounded-lg text-xs disabled:opacity-30 hover:bg-white/[0.08] transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <span className="text-xs text-gray-500">Page {usersPage} of {usersTotalPages}</span>
                <button
                  onClick={() => fetchUsers(usersPage + 1, userSearch)}
                  disabled={usersPage >= usersTotalPages}
                  className="flex items-center gap-1 px-3 py-2 bg-white/[0.04] rounded-lg text-xs disabled:opacity-30 hover:bg-white/[0.08] transition-colors"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'broadcast' && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="text-sm font-bold mb-1">Email Broadcast</h3>
              <p className="text-xs text-gray-500">Send email to all users or a specific tier. Emails are sent via Resend.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Target Audience</label>
                <div className="flex gap-2">
                  {['all', 'free', 'pro', 'premium'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setBroadcastTarget(t)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        broadcastTarget === t
                          ? 'bg-[#0A1EFF]/10 border-[#0A1EFF]/30 text-white'
                          : 'border-white/[0.06] text-gray-500 hover:text-white'
                      }`}
                    >
                      {t === 'all' ? 'All Users' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Subject</label>
                <input
                  type="text"
                  value={broadcastSubject}
                  onChange={(e) => setBroadcastSubject(e.target.value)}
                  placeholder="Email subject line"
                  className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Body</label>
                <textarea
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  placeholder="Write your message here. Line breaks will be preserved."
                  rows={8}
                  className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleBroadcast}
                  disabled={broadcastSending || !broadcastSubject.trim() || !broadcastBody.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-xl font-bold text-sm transition-colors disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                  {broadcastSending ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>

              {broadcastResult && (
                <div className={`p-3 rounded-xl text-xs ${broadcastResult.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                  {broadcastResult}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'research' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold mb-4">Create Research Post</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  value={researchTitle}
                  onChange={e => setResearchTitle(e.target.value)}
                  placeholder="Post title"
                  className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40"
                />
                <input
                  type="text"
                  value={researchSummary}
                  onChange={e => setResearchSummary(e.target.value)}
                  placeholder="Short summary (optional)"
                  className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40"
                />
                <select
                  value={researchCategory}
                  onChange={e => setResearchCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40 text-white"
                >
                  {['DeFi', 'Security', 'Market Analysis', 'Protocols', 'On-Chain', 'General'].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="url"
                  value={researchImageUrl}
                  onChange={e => setResearchImageUrl(e.target.value)}
                  placeholder="Image URL (optional)"
                  className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40"
                />
                <input
                  type="text"
                  value={researchTags}
                  onChange={e => setResearchTags(e.target.value)}
                  placeholder="Tags (comma separated: DeFi, Security, Solana)"
                  className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40"
                />
                <textarea
                  value={researchContent}
                  onChange={e => setResearchContent(e.target.value)}
                  placeholder="Full content (supports markdown headings with # prefix)"
                  rows={10}
                  className="w-full px-4 py-3 bg-[#111827] border border-white/[0.06] rounded-xl text-sm focus:outline-none focus:border-[#0A1EFF]/40 resize-none"
                />
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={researchPublished}
                      onChange={e => setResearchPublished(e.target.checked)}
                      className="w-4 h-4 accent-[#0A1EFF]"
                    />
                    <span className="text-sm text-gray-400">Publish immediately</span>
                  </label>
                </div>
                <button
                  onClick={handleResearchSave}
                  disabled={researchSaving || !researchTitle.trim() || !researchContent.trim()}
                  className="flex items-center gap-2 px-6 py-3 bg-[#0A1EFF] hover:bg-[#0918D0] rounded-xl font-bold text-sm transition-colors disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  {researchSaving ? 'Publishing...' : 'Publish Post'}
                </button>
                {researchResult && (
                  <div className={`p-3 rounded-xl text-xs ${researchResult.startsWith('Error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
                    {researchResult}
                  </div>
                )}
              </div>
            </div>

            {researchPosts.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3">Published Posts</h3>
                <div className="space-y-2">
                  {researchPosts.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-[#111827] border border-white/[0.06] rounded-xl px-4 py-3">
                      <div>
                        <p className="text-xs font-semibold text-white">{p.title}</p>
                        <p className="text-[10px] text-gray-500">{p.category} · {new Date(p.published_at).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => handleResearchDelete(p.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold mb-1">Revenue Overview</h3>
              <p className="text-[11px] text-gray-500 mb-4">Platform earnings from swap fees and subscriptions</p>
            </div>

            {/* Revenue Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total Revenue', value: '$0.00', change: '+0%', icon: DollarSign, color: '#10B981' },
                { label: 'Swap Fees (0.2%)', value: '$0.00', change: '+0%', icon: TrendingUp, color: '#0A1EFF' },
                { label: 'Pro Subscribers', value: '0', change: '+0', icon: Award, color: '#7C3AED' },
                { label: 'Premium Subscribers', value: '0', change: '+0', icon: Award, color: '#F59E0B' },
              ].map(({ label, value, change, icon: Icon, color }) => (
                <div key={label} className="bg-[#111827] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    <span className="text-[10px] text-gray-500">{label}</span>
                  </div>
                  <div className="text-lg font-bold">{value}</div>
                  <div className="text-[10px] text-gray-600">{change} this month</div>
                </div>
              ))}
            </div>

            {/* Business Model */}
            <div>
              <h3 className="text-sm font-bold mb-3">Business Model</h3>
              <div className="bg-[#111827] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                {[
                  { stream: 'Swap Fees', desc: '0.2% per swap transaction routed to treasury', status: 'Active', color: '#10B981' },
                  { stream: 'Pro Subscription', desc: '$6/month - Enhanced features access', status: 'Coming Soon', color: '#F59E0B' },
                  { stream: 'Premium Subscription', desc: '$15/month - Full platform access', status: 'Coming Soon', color: '#F59E0B' },
                  { stream: 'API Access', desc: 'Developer API access for institutional users', status: 'Planned', color: '#6B7280' },
                  { stream: 'White Label', desc: 'Branded deployments for enterprise clients', status: 'Planned', color: '#6B7280' },
                ].map(({ stream, desc, status, color }) => (
                  <div key={stream} className="flex items-start justify-between px-4 py-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold">{stream}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{desc}</div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded ml-3 flex-shrink-0" style={{ color, background: `${color}18` }}>{status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Partners */}
            <div>
              <h3 className="text-sm font-bold mb-3">Technology Partners</h3>
              <div className="bg-[#111827] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                {[
                  { name: 'VTX Intelligence', role: 'AI Intelligence Engine', type: 'Core' },
                  { name: 'Alchemy', role: 'EVM Blockchain Data', type: 'Infrastructure' },
                  { name: 'Helius', role: 'Solana Blockchain Data', type: 'Infrastructure' },
                  { name: 'Arkham Intelligence', role: 'Entity Intelligence + On-Chain Tracking', type: 'Intelligence' },
                  { name: 'GoPlus Security', role: 'Token Security + Phishing Detection', type: 'Security' },
                  { name: 'Jupiter Aggregator', role: 'Solana DEX Routing', type: 'Trading' },
                  { name: '1inch', role: 'EVM DEX Aggregation', type: 'Trading' },
                  { name: 'Supabase', role: 'Database + Auth', type: 'Infrastructure' },
                ].map(({ name, role, type }) => (
                  <div key={name} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <div className="text-sm font-semibold">{name}</div>
                      <div className="text-[10px] text-gray-500">{role}</div>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#0A1EFF]/10 text-[#6B7FFF]">{type}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold mb-1">Core Team</h3>
              <p className="text-[11px] text-gray-500 mb-4">The people building STEINZ LABS</p>
            </div>

            <div className="space-y-3">
              {[
                { name: 'Founder', role: 'CEO and Product Vision', desc: 'Building the next-generation crypto intelligence OS', initials: 'SL' },
                { name: 'AI Systems', role: 'VTX Intelligence Engine', desc: 'Proprietary reasoning engine — the core intelligence layer', initials: 'AI' },
              ].map(({ name, role, desc, initials }) => (
                <div key={name} className="bg-[#111827] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#0A1EFF]/20 to-[#7C3AED]/20 rounded-full flex items-center justify-center border border-white/10 flex-shrink-0">
                    <span className="text-sm font-bold text-[#0A1EFF]">{initials}</span>
                  </div>
                  <div>
                    <div className="font-bold text-sm">{name}</div>
                    <div className="text-[11px] text-[#0A1EFF] font-semibold mb-0.5">{role}</div>
                    <div className="text-[10px] text-gray-500">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#111827] border border-[#0A1EFF]/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building className="w-4 h-4 text-[#0A1EFF]" />
                <span className="text-sm font-bold">About STEINZ LABS</span>
              </div>
              <p className="text-[12px] text-gray-400 leading-relaxed">
                STEINZ LABS is a next-generation crypto intelligence platform combining AI reasoning, real-time on-chain data, and advanced security scanning into a unified trading intelligence OS. Our mission: give every trader institutional-grade intelligence.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatBox label="API Routes" value="36+" icon={Globe} />
              <StatBox label="Database Tables" value="8+" icon={Database} color="#10B981" />
              <StatBox label="Active Services" value="6" icon={Cpu} color="#8B5CF6" />
            </div>

            <div>
              <h3 className="text-sm font-bold mb-3">Service Health</h3>
              <div className="bg-[#111827] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                {[
                  { name: 'Supabase Auth', status: 'operational', desc: 'Email/password authentication' },
                  { name: 'CoinGecko API', status: 'operational', desc: 'Market data & pricing' },
                  { name: 'DEXScreener API', status: 'operational', desc: 'DEX pairs & trending' },
                  { name: 'Arkham Intelligence', status: 'operational', desc: 'Wallet & entity intelligence' },
                  { name: 'VTX AI Agent', status: 'operational', desc: 'AI analysis engine' },
                  { name: 'Resend Email', status: 'operational', desc: 'Email delivery service' },
                  { name: 'Alchemy RPC', status: 'operational', desc: 'EVM chain data' },
                  { name: 'Helius RPC', status: 'operational', desc: 'Solana chain data' },
                ].map((service) => (
                  <div key={service.name} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <div className="text-xs font-semibold text-white">{service.name}</div>
                      <div className="text-[10px] text-gray-500">{service.desc}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-[#10B981] rounded-full" />
                      <span className="text-[10px] text-[#10B981] font-medium capitalize">{service.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold mb-3">API Endpoints</h3>
              <div className="bg-[#111827] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
                {[
                  { route: '/api/vtx-ai', method: 'POST', desc: 'VTX Agent AI chat' },
                  { route: '/api/prices', method: 'GET', desc: 'Real-time prices' },
                  { route: '/api/search', method: 'GET', desc: 'Token/coin search' },
                  { route: '/api/market-data', method: 'GET', desc: 'Market data feeds' },
                  { route: '/api/context-feed', method: 'GET', desc: 'Context feed events' },
                  { route: '/api/trade/quote', method: 'POST', desc: 'Swap quotes' },
                  { route: '/api/trade/execute', method: 'POST', desc: 'Execute trades' },
                  { route: '/api/intelligence/holders', method: 'GET', desc: 'Holder analysis' },
                  { route: '/api/bubble-map', method: 'GET', desc: 'Bubble map data' },
                  { route: '/api/whale-tracker', method: 'GET', desc: 'Whale tracking' },
                  { route: '/api/security', method: 'POST', desc: 'Security scanning' },
                  { route: '/api/subscription', method: 'GET', desc: 'User subscriptions' },
                  { route: '/api/revenue/stats', method: 'GET', desc: 'Revenue analytics' },
                  { route: '/api/admin/stats', method: 'GET', desc: 'Admin statistics' },
                  { route: '/api/admin/users', method: 'GET', desc: 'User management' },
                  { route: '/api/admin/broadcast', method: 'POST', desc: 'Email broadcast' },
                ].map((api) => (
                  <div key={api.route} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${api.method === 'GET' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                      {api.method}
                    </span>
                    <span className="text-xs text-white font-mono flex-1">{api.route}</span>
                    <span className="text-[10px] text-gray-500">{api.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
