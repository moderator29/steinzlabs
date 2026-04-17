'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, Plus, Trash2, GripVertical, Eye, EyeOff, Search, Loader2 } from 'lucide-react';

interface FeaturedToken {
  id: string;
  symbol: string;
  name: string;
  chain: string;
  address: string;
  display_order: number;
  active: boolean;
  badge?: string;
  created_at: string;
}

const CHAINS = ['ETH', 'SOL', 'BASE', 'ARB', 'BSC'];
const BADGES = ['', 'Hot', 'New', 'Trending', 'Verified', 'Partner'];

const BLANK = { symbol: '', name: '', chain: 'ETH', address: '', badge: '', active: true };

const BADGE_COLORS: Record<string, string> = {
  Hot:      'text-orange-400 bg-orange-400/10',
  New:      'text-green-400 bg-green-400/10',
  Trending: 'text-purple-400 bg-purple-400/10',
  Verified: 'text-blue-400 bg-blue-400/10',
  Partner:  'text-yellow-400 bg-yellow-400/10',
};

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function FeaturedTokensPage() {
  const [tokens, setTokens] = useState<FeaturedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK });
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/featured-tokens', { headers: authHeader() });
      const json = await res.json();
      setTokens(json.tokens ?? []);
    } catch (err) {
      console.error('Failed to load featured tokens:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const filtered = tokens
    .filter(t => !query || [t.symbol, t.name, t.chain, t.address].some(f => f.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => a.display_order - b.display_order);

  const toggleActive = async (id: string) => {
    const token = tokens.find(t => t.id === id);
    if (!token) return;
    // Optimistic update
    setTokens(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));
    try {
      await fetch(`/api/admin/featured-tokens?id=${id}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ active: !token.active }),
      });
    } catch (err) {
      console.error('Failed to toggle active:', err);
      // Revert on failure
      setTokens(prev => prev.map(t => t.id === id ? { ...t, active: token.active } : t));
    }
  };

  const remove = async (id: string) => {
    // Optimistic update
    const prev = tokens;
    setTokens(p => p.filter(t => t.id !== id));
    try {
      await fetch(`/api/admin/featured-tokens?id=${id}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
    } catch (err) {
      console.error('Failed to delete token:', err);
      setTokens(prev);
    }
  };

  const moveUp = async (id: string) => {
    const sorted = [...tokens].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex(t => t.id === id);
    if (idx <= 0) return;

    const current = sorted[idx];
    const above = sorted[idx - 1];

    // Optimistic swap
    setTokens(prev => prev.map(t => {
      if (t.id === current.id) return { ...t, display_order: above.display_order };
      if (t.id === above.id) return { ...t, display_order: current.display_order };
      return t;
    }));

    try {
      await Promise.all([
        fetch(`/api/admin/featured-tokens?id=${current.id}`, {
          method: 'PATCH',
          headers: authHeader(),
          body: JSON.stringify({ display_order: above.display_order }),
        }),
        fetch(`/api/admin/featured-tokens?id=${above.id}`, {
          method: 'PATCH',
          headers: authHeader(),
          body: JSON.stringify({ display_order: current.display_order }),
        }),
      ]);
    } catch (err) {
      console.error('Failed to reorder tokens:', err);
      await loadTokens();
    }
  };

  const add = async () => {
    if (!form.symbol.trim() || !form.address.trim()) return;
    setSaving(true);
    try {
      const maxOrder = Math.max(0, ...tokens.map(t => t.display_order));
      const res = await fetch('/api/admin/featured-tokens', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ ...form, display_order: maxOrder + 1 }),
      });
      const json = await res.json();
      if (json.token) {
        setTokens(prev => [...prev, json.token]);
        setForm({ ...BLANK });
        setShowForm(false);
      }
    } catch (err) {
      console.error('Failed to add token:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Featured Tokens</h1>
          <p className="text-xs text-gray-500 mt-0.5">Curated tokens shown in the featured section and discovery feed</p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Token
        </button>
      </div>

      {showForm && (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">New Featured Token</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} placeholder="Symbol (e.g. PEPE)"
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Token name"
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Contract address"
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
            <div className="flex gap-2">
              <select value={form.chain} onChange={e => setForm(f => ({ ...f, chain: e.target.value }))}
                className="flex-1 bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {CHAINS.map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={form.badge} onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                className="flex-1 bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {BADGES.map(b => <option key={b} value={b}>{b || 'No badge'}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="accent-[#0A1EFF]" />
              <span className="text-xs text-gray-300">Active (visible to users)</span>
            </label>
            <div className="flex-1" />
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-400 hover:text-white px-3 py-2">Cancel</button>
            <button onClick={add} disabled={saving}
              className="flex items-center gap-2 bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />} Add Featured
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden overflow-x-auto">
        <div className="p-3 border-b border-[#1E2433]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tokens..."
              className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading featured tokens…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <Star className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">{query ? 'No tokens match your search.' : 'No featured tokens yet. Add one above.'}</p>
          </div>
        ) : (
          <table className="w-full text-xs min-w-[700px]">
            <thead className="border-b border-[#1E2433]">
              <tr>{['Order', 'Token', 'Chain', 'Address', 'Badge', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <GripVertical className="w-3.5 h-3.5 text-gray-600 cursor-grab" />
                      <button onClick={() => moveUp(t.id)} className="text-gray-600 hover:text-white text-[10px] w-5 h-5 flex items-center justify-center">↑</button>
                      <span className="text-gray-400 font-mono w-4 text-center">{t.display_order}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-white">{t.symbol}</div>
                    <div className="text-[10px] text-gray-500">{t.name}</div>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-[#1E2433] rounded text-[10px] font-mono text-gray-300">{t.chain}</span></td>
                  <td className="px-4 py-3 font-mono text-gray-400">{t.address}</td>
                  <td className="px-4 py-3">
                    {t.badge ? <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${BADGE_COLORS[t.badge] ?? 'text-gray-400 bg-gray-400/10'}`}>{t.badge}</span> : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {t.active ? <span className="text-green-400 text-[10px] font-semibold">Active</span> : <span className="text-gray-500 text-[10px]">Hidden</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleActive(t.id)} className="text-gray-500 hover:text-white transition-colors">
                        {t.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => remove(t.id)} className="text-red-500/50 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
