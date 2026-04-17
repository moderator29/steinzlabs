'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Activity, DollarSign, Shield, TrendingUp, TrendingDown, RefreshCw, Zap } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { StatusDot } from '@/components/ui/StatusDot';
import { formatUSD, formatLargeNumber, formatTimeAgo } from '@/lib/formatters';

function KpiCard({ icon: Icon, label, value, change, changeType }: {
  icon: React.ElementType; label: string; value: string; change?: string; changeType?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <div className="w-7 h-7 bg-[#0A1EFF]/10 rounded-lg flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-[#0A1EFF]" />
        </div>
      </div>
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      {change && (
        <div className={`flex items-center gap-1 text-xs ${changeType === 'up' ? 'text-green-400' : changeType === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
          {changeType === 'up' ? <TrendingUp className="w-3 h-3" /> : changeType === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
          {change}
        </div>
      )}
    </div>
  );
}

interface StatsData {
  users: { total: number; todaySignups: number; weekSignups: number; recentUsers: Array<{ id: string; email: string; username: string; created_at: string }> };
  platform: { totalScans: number; totalPositions: number; activePositions: number; totalThreats: number; totalAlerts: number };
}

interface ActivityEntry { event: string; detail: string; time: number; }

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('admin_token') ?? '';
      const res = await fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data: StatsData = await res.json();
        setStats(data);
        // Build activity feed from recent signups
        const recentActivity: ActivityEntry[] = (data.users.recentUsers || []).slice(0, 6).map(u => ({
          event: 'New user signup',
          detail: u.email || u.username || u.id.slice(0, 8),
          time: new Date(u.created_at).getTime(),
        }));
        setActivity(recentActivity);
      }
    } catch (err) {
      console.error('[admin/dashboard] Stats load failed:', err);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Last refreshed: {formatTimeAgo(lastRefresh)}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot status="active" label="All systems operational" pulse />
          <button onClick={load} disabled={loading} className="flex items-center gap-2 text-xs text-gray-400 hover:text-white border border-[#1E2433] rounded-lg px-3 py-1.5 hover:border-[#2E3443] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={Users} label="Total Users" value={formatLargeNumber(stats?.users.total ?? 0)} change={`+${stats?.users.weekSignups ?? 0} this week`} changeType="up" />
        <KpiCard icon={DollarSign} label="Revenue (30d)" value={formatUSD(0)} change="Payments not yet live" changeType="neutral" />
        <KpiCard icon={Activity} label="Total Scans" value={formatLargeNumber(stats?.platform.totalScans ?? 0)} change={`${stats?.platform.activePositions ?? 0} active positions`} changeType="neutral" />
        <KpiCard icon={Shield} label="Threats Found" value={formatLargeNumber(stats?.platform.totalThreats ?? 0)} change="All time" changeType="neutral" />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">User Growth (30d)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={CHART_DATA}>
              <defs>
                <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0A1EFF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0A1EFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="users" stroke="#0A1EFF" fill="url(#userGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Revenue (30d)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E2433" />
              <XAxis dataKey="day" hide />
              <YAxis hide />
              <Tooltip contentStyle={{ background: '#141824', border: '1px solid #1E2433', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => formatUSD(v)} />
              <Bar dataKey="revenue" fill="#0A1EFF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Signups</h3>
        <div className="space-y-2">
          {activity.length === 0 && !loading && (
            <p className="text-xs text-gray-500 py-4 text-center">No recent activity</p>
          )}
          {activity.map((a, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-[#1E2433] last:border-0">
              <StatusDot status="active" size="sm" pulse />
              <span className="text-xs text-white font-medium w-36 flex-shrink-0">{a.event}</span>
              <span className="text-xs text-gray-400 flex-1">{a.detail}</span>
              <span className="text-xs text-gray-600 flex-shrink-0">{formatTimeAgo(a.time)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
