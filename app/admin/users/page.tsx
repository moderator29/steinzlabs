'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Ban, UserCheck, Mail, X, ChevronRight, Filter } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';
import { StatusDot } from '@/components/ui/StatusDot';
import { checkTier, type Tier } from '@/lib/subscriptions/tierCheck';

interface AdminUser {
  id: string;
  email: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  last_active: string | null;
  tier: string | null;
  tier_expires_at: string | null;
  tier_granted_reason: string | null;
  status: string | null;
  role: string | null;
}

type TierFilter = 'all' | 'free' | 'mini' | 'pro' | 'max';
type SignupFilter = 'all' | '24h' | '7d' | '30d' | '90d';
type ActivityFilter = 'all' | 'active7d' | 'active30d' | 'dormant30d' | 'never';

const TIER_BADGE: Record<Tier, string> = {
  free: 'bg-gray-500/15 text-gray-400 border border-gray-500/20',
  mini: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  pro:  'bg-[#0A1EFF]/20 text-[#7C9EFF] border border-[#0A1EFF]/30',
  max:  'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

function effectiveTierOf(u: Pick<AdminUser, 'tier' | 'tier_expires_at'>): Tier {
  return checkTier(u.tier, u.tier_expires_at, 'free').currentTier;
}

function initials(u: Pick<AdminUser, 'first_name' | 'last_name' | 'username' | 'email'>): string {
  const a = (u.first_name?.[0] ?? '').trim();
  const b = (u.last_name?.[0] ?? '').trim();
  if (a || b) return (a + b).toUpperCase() || '·';
  const fallback = (u.username ?? u.email ?? '·').replace(/[^a-zA-Z0-9]/g, '');
  return (fallback[0] ?? '·').toUpperCase();
}

function displayName(u: Pick<AdminUser, 'first_name' | 'last_name' | 'username' | 'email'>): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (u.username) return u.username;
  if (u.email) return u.email.split('@')[0];
  return 'Unknown';
}

function withinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= days * 86_400_000;
}

function UserDrawer({ user, onClose, onBan, onTier }: {
  user: AdminUser;
  onClose: () => void;
  onBan: (id: string, ban: boolean) => void;
  onTier: (id: string, tier: Tier, expires: string | null) => void;
}) {
  const eff = effectiveTierOf(user);
  const [tier, setTier] = useState<Tier>(eff);
  const [months, setMonths] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isBanned = user.status === 'banned';

  async function applyTier() {
    setSaving(true); setFlash(null); setError(null);
    try {
      const token = sessionStorage.getItem('admin_token') ?? '';
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'set_tier', userId: user.id, tier, months, reason }),
      });
      const j = await r.json().catch(() => ({} as { error?: string; tier_expires_at?: string }));
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      setFlash(`Tier set to ${tier}${tier !== 'free' ? ` for ${months} month${months === 1 ? '' : 's'}` : ''}.`);
      onTier(user.id, tier, j.tier_expires_at ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  }

  async function applyBan() {
    setError(null);
    try {
      const token = sessionStorage.getItem('admin_token') ?? '';
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: isBanned ? 'unban' : 'ban', userId: user.id }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      onBan(user.id, !isBanned);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-96 bg-[#141824] border-l border-[#1E2433] h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#1E2433]">
          <h3 className="text-sm font-bold text-white">User Details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#0A1EFF]/10 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold text-[#0A1EFF]">{initials(user)}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{displayName(user)}</div>
              <div className="text-xs text-gray-400 truncate">{user.username ? `@${user.username}` : user.email}</div>
            </div>
          </div>
          {[
            ['Email', user.email ?? '—'],
            ['User ID', user.id],
            ['Joined', formatTimeAgo(user.created_at)],
            ['Effective tier', eff.toUpperCase()],
            ['Tier expires', user.tier_expires_at ? new Date(user.tier_expires_at).toLocaleDateString() : '—'],
            ['Last Active', user.last_active ? formatTimeAgo(user.last_active) : 'Never signed in'],
            ['Status', isBanned ? 'Banned' : 'Active'],
            ['Role', user.role ?? 'user'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-[#1E2433] gap-3">
              <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
              <span className="text-xs text-white font-medium truncate text-right">{val}</span>
            </div>
          ))}

          {/* Tier management */}
          <div className="pt-2 space-y-2 border border-[#1E2433] rounded-xl p-3 bg-[#0d1120]">
            <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Tier override</div>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as Tier)}
              className="w-full bg-[#1E2433] border border-[#2E3443] rounded-lg px-3 py-2 text-xs text-white"
            >
              <option value="free">Free — $0</option>
              <option value="mini">Mini — $5/mo</option>
              <option value="pro">Pro — $9/mo</option>
              <option value="max">Max — $15/mo</option>
            </select>
            {tier !== 'free' && (
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-gray-500">Months</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={months}
                  onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                  className="flex-1 bg-[#1E2433] border border-[#2E3443] rounded-lg px-2 py-1.5 text-xs text-white"
                />
              </div>
            )}
            <input
              type="text"
              placeholder="Reason (optional — audit trail)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#1E2433] border border-[#2E3443] rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600"
            />
            <button
              onClick={applyTier}
              disabled={saving}
              className="w-full py-2 rounded-lg text-xs font-bold bg-[#0A1EFF] hover:bg-[#0818CC] text-white disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Apply tier'}
            </button>
            {flash && <div className="text-[11px] text-emerald-400">{flash}</div>}
            {error && <div className="text-[11px] text-red-400">{error}</div>}
          </div>

          <div className="pt-2 space-y-2">
            <button onClick={applyBan}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${isBanned ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600/20 hover:bg-red-600 border border-red-600/30 text-red-400 hover:text-white'}`}>
              {isBanned ? <><UserCheck className="w-4 h-4" /> Unban User</> : <><Ban className="w-4 h-4" /> Ban User</>}
            </button>
            {user.email && (
              <a href={`mailto:${user.email}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-[#1E2433] hover:bg-[#2E3443] text-gray-300 hover:text-white transition-colors">
                <Mail className="w-4 h-4" /> Email User
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [signupFilter, setSignupFilter] = useState<SignupFilter>('all');
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const token = sessionStorage.getItem('admin_token') ?? '';
      const r = await fetch('/api/admin/users?limit=200', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { users?: AdminUser[] };
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u => {
      if (q && ![u.email, u.username, u.first_name, u.last_name].some(f => (f ?? '').toLowerCase().includes(q))) return false;

      if (tierFilter !== 'all' && effectiveTierOf(u) !== tierFilter) return false;

      if (signupFilter !== 'all') {
        const days = signupFilter === '24h' ? 1 : signupFilter === '7d' ? 7 : signupFilter === '30d' ? 30 : 90;
        if (!withinDays(u.created_at, days)) return false;
      }

      if (activityFilter !== 'all') {
        if (activityFilter === 'never' && u.last_active) return false;
        if (activityFilter === 'active7d' && !withinDays(u.last_active, 7)) return false;
        if (activityFilter === 'active30d' && !withinDays(u.last_active, 30)) return false;
        if (activityFilter === 'dormant30d') {
          // signed in at some point but not in last 30 days
          if (!u.last_active || withinDays(u.last_active, 30)) return false;
        }
      }
      return true;
    });
  }, [users, query, tierFilter, signupFilter, activityFilter]);

  const handleBan = useCallback((id: string, ban: boolean) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: ban ? 'banned' : 'active' } : u));
    setSelected(prev => prev?.id === id ? { ...prev, status: ban ? 'banned' : 'active' } : prev);
  }, []);

  const handleTier = useCallback((id: string, tier: Tier, expires: string | null) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, tier, tier_expires_at: expires } : u));
    setSelected(prev => prev?.id === id ? { ...prev, tier, tier_expires_at: expires } : prev);
  }, []);

  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = { free: 0, mini: 0, pro: 0, max: 0 };
    for (const u of users) c[effectiveTierOf(u)]++;
    return c;
  }, [users]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {users.length.toLocaleString()} loaded · {tierCounts.max} max · {tierCounts.pro} pro · {tierCounts.mini} mini · {tierCounts.free} free
          </p>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">{error}</div>}

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#1E2433] space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, email, or username..."
              className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors" />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-500" />
            <select value={tierFilter} onChange={e => setTierFilter(e.target.value as TierFilter)}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-2 py-1.5 text-white">
              <option value="all">All tiers</option>
              <option value="free">Free</option>
              <option value="mini">Mini</option>
              <option value="pro">Pro</option>
              <option value="max">Max</option>
            </select>
            <select value={signupFilter} onChange={e => setSignupFilter(e.target.value as SignupFilter)}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-2 py-1.5 text-white">
              <option value="all">All signups</option>
              <option value="24h">Joined &lt;24h</option>
              <option value="7d">Joined &lt;7d</option>
              <option value="30d">Joined &lt;30d</option>
              <option value="90d">Joined &lt;90d</option>
            </select>
            <select value={activityFilter} onChange={e => setActivityFilter(e.target.value as ActivityFilter)}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-2 py-1.5 text-white">
              <option value="all">Any activity</option>
              <option value="active7d">Active &lt;7d</option>
              <option value="active30d">Active &lt;30d</option>
              <option value="dormant30d">Dormant &gt;30d</option>
              <option value="never">Never signed in</option>
            </select>
            <span className="ml-auto text-gray-500">{filtered.length} match{filtered.length === 1 ? '' : 'es'}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#1E2433]">
              <tr>{['User', 'Email', 'Tier', 'Created', 'Last Active', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No users match these filters.</td></tr>
              )}
              {filtered.map(user => {
                const eff = effectiveTierOf(user);
                const isBanned = user.status === 'banned';
                return (
                  <tr key={user.id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30 cursor-pointer" onClick={() => setSelected(user)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#0A1EFF]/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-[#0A1EFF]">{initials(user)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{displayName(user)}</div>
                          <div className="text-gray-500 truncate">{user.username ? `@${user.username}` : '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300 truncate max-w-[220px]">{user.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${TIER_BADGE[eff]}`}>
                        {eff}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{formatTimeAgo(user.created_at)}</td>
                    <td className="px-4 py-3 text-gray-400">{user.last_active ? formatTimeAgo(user.last_active) : <span className="text-gray-600">Never</span>}</td>
                    <td className="px-4 py-3">
                      <StatusDot status={isBanned ? 'error' : 'active'} label={isBanned ? 'Banned' : 'Active'} />
                    </td>
                    <td className="px-4 py-3 text-gray-600"><ChevronRight className="w-4 h-4" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <UserDrawer user={selected} onClose={() => setSelected(null)} onBan={handleBan} onTier={handleTier} />}
    </div>
  );
}
