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
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
  last_active: string | null;
  tier: string | null;
  tier_expires_at: string | null;
  // banned_until is source of truth on auth.users; ISO string when banned, null otherwise.
  // The legacy `profiles.status` column never existed — old code wrote to it
  // and the update silently failed. Don't reintroduce the field name.
  banned_until: string | null;
  role: string | null;
  is_verified: boolean | null;
}

type TierFilter = 'all' | 'free' | 'mini' | 'pro' | 'max';
type SignupFilter = 'all' | '24h' | '7d' | '30d' | '90d';
type ActivityFilter = 'all' | 'active7d' | 'active30d' | 'dormant30d' | 'never';

// Tier badge palette — opaque borders + brighter text for WCAG AAA
// contrast against the page background. Audit flagged the previous
// translucent /15 fills as ~3.2:1 (AA only).
const TIER_BADGE: Record<Tier, string> = {
  free: 'bg-gray-500/25 text-gray-200 border border-gray-500/40',
  mini: 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/50',
  pro:  'bg-[#0A1EFF]/30 text-[#C7D2FE] border border-[#0A1EFF]/60',
  max:  'bg-amber-500/25 text-amber-100 border border-amber-400/50',
  naka_cult: 'bg-[#DC143C]/25 text-[#FFD0DC] border border-[#DC143C]/50',
};

function effectiveTierOf(u: Pick<AdminUser, 'tier' | 'tier_expires_at'>): Tier {
  return checkTier(u.tier, u.tier_expires_at, 'free').currentTier;
}

function isBannedNow(u: Pick<AdminUser, 'banned_until'>): boolean {
  if (!u.banned_until) return false;
  return new Date(u.banned_until).getTime() > Date.now();
}

function initials(u: Pick<AdminUser, 'first_name' | 'last_name' | 'username' | 'display_name' | 'email'>): string {
  const a = (u.first_name?.[0] ?? '').trim();
  const b = (u.last_name?.[0] ?? '').trim();
  if (a || b) return (a + b).toUpperCase() || '·';
  // Try first letter of any non-blank string the user gave us — works for
  // emoji/unicode usernames too because we don't strip the chars first;
  // we only fall back to '·' if literally nothing usable exists.
  for (const candidate of [u.display_name, u.username, u.email]) {
    if (candidate && candidate.trim().length > 0) {
      // Preserve the first code point (emoji-safe).
      return Array.from(candidate.trim())[0]?.toUpperCase() ?? '·';
    }
  }
  return '·';
}

function displayName(u: Pick<AdminUser, 'first_name' | 'last_name' | 'display_name' | 'username' | 'email'>): string {
  const full = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (u.display_name) return u.display_name;
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
  const banned = isBannedNow(user);

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
        body: JSON.stringify({ action: banned ? 'unban' : 'ban', userId: user.id }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      onBan(user.id, !banned);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="User details">
      <div className="flex-1 bg-black/50" onClick={onClose} aria-hidden="true" />
      {/* w-full on mobile (375px-safe), w-96 from sm: up. Audit flagged hardcoded w-96 overflowing iPhone SE. */}
      <div className="w-full sm:w-96 bg-[#141824] border-l border-[#1E2433] h-full overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#1E2433]">
          <h3 className="text-sm font-bold text-white">User Details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Close user details">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#0A1EFF]/15 rounded-full flex items-center justify-center" aria-hidden="true">
              <span className="text-lg font-bold text-[#9EAFFF]">{initials(user)}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white truncate">{displayName(user)}</div>
              <div className="text-xs text-gray-300 truncate">{user.username ? `@${user.username}` : user.email}</div>
            </div>
          </div>
          {[
            ['Email', user.email ?? '—'],
            ['User ID', user.id],
            ['Joined', formatTimeAgo(user.created_at)],
            ['Effective tier', eff.toUpperCase()],
            ['Tier expires', user.tier_expires_at ? new Date(user.tier_expires_at).toLocaleDateString() : '—'],
            ['Last Active', user.last_active ? formatTimeAgo(user.last_active) : 'Never signed in'],
            ['Status', banned ? `Banned until ${new Date(user.banned_until!).toLocaleDateString()}` : 'Active'],
            ['Role', user.role ?? 'user'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-[#1E2433] gap-3">
              <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
              <span className="text-xs text-white font-medium truncate text-right">{val}</span>
            </div>
          ))}

          {/* Tier management */}
          <div className="pt-2 space-y-2 border border-[#1E2433] rounded-xl p-3 bg-[#0d1120]">
            <div className="text-[11px] uppercase tracking-wide text-gray-300 font-semibold">Tier override</div>
            <label className="block">
              <span className="sr-only">Tier</span>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value as Tier)}
                className="w-full bg-[#1E2433] border border-[#2E3443] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#0A1EFF]"
              >
                <option value="free">Free — $0</option>
                <option value="mini">Mini — $5/mo</option>
                <option value="pro">Pro — $9/mo</option>
                <option value="max">Max — $15/mo</option>
              </select>
            </label>
            {tier !== 'free' && (
              <label className="flex items-center gap-2">
                <span className="text-[11px] text-gray-300">Months</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={months}
                  onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                  className="flex-1 bg-[#1E2433] border border-[#2E3443] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-[#0A1EFF]"
                  aria-label="Months of tier override"
                />
              </label>
            )}
            <label className="block">
              <span className="sr-only">Reason for tier override</span>
              <input
                type="text"
                placeholder="Reason (optional — audit trail)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[#1E2433] border border-[#2E3443] rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0A1EFF]"
              />
            </label>
            <button
              onClick={applyTier}
              disabled={saving}
              className="w-full py-2 rounded-lg text-xs font-bold bg-[#0A1EFF] hover:bg-[#0818CC] text-white disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A1EFF] focus:ring-offset-2 focus:ring-offset-[#0d1120]"
            >
              {saving ? 'Saving…' : 'Apply tier'}
            </button>
            {flash && <div className="text-[11px] text-emerald-300" role="status">{flash}</div>}
            {error && <div className="text-[11px] text-red-300" role="alert">{error}</div>}
          </div>

          <div className="pt-2 space-y-2">
            <button onClick={applyBan} aria-label={banned ? 'Unban user' : 'Ban user'}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#141824] ${banned ? 'bg-green-600 hover:bg-green-500 text-white focus:ring-green-500' : 'bg-red-600/30 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white focus:ring-red-500'}`}>
              {banned ? <><UserCheck className="w-4 h-4" aria-hidden="true" /> Unban User</> : <><Ban className="w-4 h-4" aria-hidden="true" /> Ban User</>}
            </button>
            {user.email && (
              <a href={`mailto:${user.email}`}
                aria-label={`Email ${user.email}`}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-[#1E2433] hover:bg-[#2E3443] text-gray-200 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0A1EFF]">
                <Mail className="w-4 h-4" aria-hidden="true" /> Email User
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
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `HTTP ${r.status}`);
      }
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
      if (q && ![u.email, u.username, u.display_name, u.first_name, u.last_name].some(f => (f ?? '').toLowerCase().includes(q))) return false;

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
    const banned_until = ban ? new Date(Date.now() + 100 * 365 * 86_400_000).toISOString() : null;
    setUsers(prev => prev.map(u => u.id === id ? { ...u, banned_until } : u));
    setSelected(prev => prev?.id === id ? { ...prev, banned_until } : prev);
  }, []);

  const handleTier = useCallback((id: string, tier: Tier, expires: string | null) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, tier, tier_expires_at: expires } : u));
    setSelected(prev => prev?.id === id ? { ...prev, tier, tier_expires_at: expires } : prev);
  }, []);

  const tierCounts = useMemo(() => {
    const c: Record<Tier, number> = { free: 0, mini: 0, pro: 0, max: 0, naka_cult: 0 };
    for (const u of users) c[effectiveTierOf(u)]++;
    return c;
  }, [users]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-xs text-gray-300 mt-0.5">
            {users.length.toLocaleString()} loaded · {tierCounts.max} max · {tierCounts.pro} pro · {tierCounts.mini} mini · {tierCounts.free} free
          </p>
        </div>
      </div>

      {error && <div role="alert" className="mb-4 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-xs text-red-200">{error}</div>}

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#1E2433] space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <label className="block">
              <span className="sr-only">Search users</span>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, email, or username..."
                className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#0A1EFF] focus:border-[#0A1EFF]/40 transition-colors" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-gray-400" aria-hidden="true" />
            <label>
              <span className="sr-only">Tier filter</span>
              <select value={tierFilter} onChange={e => setTierFilter(e.target.value as TierFilter)}
                className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-[#0A1EFF]">
                <option value="all">All tiers</option>
                <option value="free">Free</option>
                <option value="mini">Mini</option>
                <option value="pro">Pro</option>
                <option value="max">Max</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Signup window filter</span>
              <select value={signupFilter} onChange={e => setSignupFilter(e.target.value as SignupFilter)}
                className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-[#0A1EFF]">
                <option value="all">All signups</option>
                <option value="24h">Joined &lt;24h</option>
                <option value="7d">Joined &lt;7d</option>
                <option value="30d">Joined &lt;30d</option>
                <option value="90d">Joined &lt;90d</option>
              </select>
            </label>
            <label>
              <span className="sr-only">Activity filter</span>
              <select value={activityFilter} onChange={e => setActivityFilter(e.target.value as ActivityFilter)}
                className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-2 py-1.5 text-white focus:outline-none focus:ring-2 focus:ring-[#0A1EFF]">
                <option value="all">Any activity</option>
                <option value="active7d">Active &lt;7d</option>
                <option value="active30d">Active &lt;30d</option>
                <option value="dormant30d">Dormant &gt;30d</option>
                <option value="never">Never signed in</option>
              </select>
            </label>
            <span className="ml-auto text-gray-300">{filtered.length} match{filtered.length === 1 ? '' : 'es'}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#1E2433]">
              <tr>{['User', 'Email', 'Tier', 'Created', 'Last Active', 'Status', ''].map(h => (
                <th key={h || 'actions'} scope="col" className="px-4 py-2.5 text-left text-gray-300 font-medium">{h || <span className="sr-only">Open user</span>}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-300">Loading…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-300">No users match these filters.</td></tr>
              )}
              {filtered.map(user => {
                const eff = effectiveTierOf(user);
                const banned = isBannedNow(user);
                return (
                  <tr key={user.id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30 cursor-pointer focus-within:bg-[#1E2433]/30" onClick={() => setSelected(user)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {user.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0 border border-white/10" />
                        ) : (
                          <div className="w-7 h-7 bg-[#0A1EFF]/15 rounded-full flex items-center justify-center flex-shrink-0" aria-hidden="true">
                            <span className="text-[10px] font-bold text-[#9EAFFF]">{initials(user)}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{displayName(user)}</div>
                          <div className="text-gray-400 truncate">{user.username ? `@${user.username}` : '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-200 truncate max-w-[220px]">{user.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${TIER_BADGE[eff]}`} aria-label={`Tier ${eff}`}>
                        {eff}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{formatTimeAgo(user.created_at)}</td>
                    <td className="px-4 py-3 text-gray-300">{user.last_active ? formatTimeAgo(user.last_active) : <span className="text-gray-500">Never</span>}</td>
                    <td className="px-4 py-3">
                      <StatusDot status={banned ? 'error' : 'active'} label={banned ? 'Banned' : 'Active'} />
                    </td>
                    <td className="px-4 py-3 text-gray-500"><ChevronRight className="w-4 h-4" aria-hidden="true" /></td>
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
