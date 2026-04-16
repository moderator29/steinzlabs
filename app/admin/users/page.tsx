'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Users, Ban, UserCheck, Mail, X, ChevronRight, RefreshCw } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';
import { StatusDot } from '@/components/ui/StatusDot';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  created_at: string;
  is_banned?: boolean;
  subscription?: string;
  last_active?: string;
}

function UserDrawer({ user, onClose, onBan }: { user: AdminUser; onClose: () => void; onBan: (id: string, ban: boolean) => void }) {
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
              <span className="text-lg font-bold text-[#0A1EFF]">{user.first_name[0]?.toUpperCase()}</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{user.first_name} {user.last_name}</div>
              <div className="text-xs text-gray-400">@{user.username}</div>
            </div>
          </div>
          {[
            ['Email', user.email],
            ['User ID', user.id],
            ['Joined', formatTimeAgo(user.created_at)],
            ['Plan', user.subscription ?? 'Free'],
            ['Last Active', user.last_active ? formatTimeAgo(user.last_active) : 'Unknown'],
            ['Status', user.is_banned ? 'Banned' : 'Active'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center py-2 border-b border-[#1E2433]">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-xs text-white font-medium">{val}</span>
            </div>
          ))}
          <div className="pt-2 space-y-2">
            <button onClick={() => onBan(user.id, !user.is_banned)}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${user.is_banned ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600/20 hover:bg-red-600 border border-red-600/30 text-red-400 hover:text-white'}`}>
              {user.is_banned ? <><UserCheck className="w-4 h-4" /> Unban User</> : <><Ban className="w-4 h-4" /> Ban User</>}
            </button>
            <a href={`mailto:${user.email}`}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-[#1E2433] hover:bg-[#2E3443] text-gray-300 hover:text-white transition-colors">
              <Mail className="w-4 h-4" /> Email User
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token') ?? '';
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : { users: [] })
      .then(data => setUsers(data.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    [u.email, u.username, u.first_name, u.last_name].some(f => f.toLowerCase().includes(query.toLowerCase()))
  );

  const handleBan = useCallback((id: string, ban: boolean) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, is_banned: ban } : u));
    setSelected(prev => prev?.id === id ? { ...prev, is_banned: ban } : prev);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Users</h1>
          <p className="text-xs text-gray-500 mt-0.5">{users.length.toLocaleString()} registered users</p>
        </div>
      </div>

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#1E2433]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, email, or username..."
              className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 transition-colors" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-[#1E2433]">
              <tr>{['User', 'Email', 'Plan', 'Joined', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(user => (
                <tr key={user.id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30 cursor-pointer" onClick={() => setSelected(user)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-[#0A1EFF]/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-[#0A1EFF]">{user.first_name[0]}</span>
                      </div>
                      <div>
                        <div className="text-white font-medium">{user.first_name} {user.last_name}</div>
                        <div className="text-gray-500">@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${user.subscription === 'Pro' ? 'bg-[#0A1EFF]/20 text-[#0A1EFF]' : 'bg-gray-500/20 text-gray-400'}`}>
                      {user.subscription}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{formatTimeAgo(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <StatusDot status={user.is_banned ? 'error' : 'active'} label={user.is_banned ? 'Banned' : 'Active'} />
                  </td>
                  <td className="px-4 py-3 text-gray-600"><ChevronRight className="w-4 h-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <UserDrawer user={selected} onClose={() => setSelected(null)} onBan={handleBan} />}
    </div>
  );
}
