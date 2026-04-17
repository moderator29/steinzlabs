'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Trash2, Edit2, Save, X, Search, Loader2 } from 'lucide-react';

interface WalletLabel {
  id: string;
  address: string;
  chain: string;
  label: string;
  category: string;
  notes?: string;
  created_at: string;
  verified: boolean;
}

const CATEGORIES = ['Exchange', 'Whale', 'Smart Money', 'Scammer', 'Protocol', 'Fund', 'Team', 'Other'];

const CATEGORY_COLORS: Record<string, string> = {
  Exchange:     'text-blue-400 bg-blue-400/10',
  Whale:        'text-purple-400 bg-purple-400/10',
  'Smart Money':'text-green-400 bg-green-400/10',
  Scammer:      'text-red-400 bg-red-400/10',
  Protocol:     'text-cyan-400 bg-cyan-400/10',
  Fund:         'text-yellow-400 bg-yellow-400/10',
  Team:         'text-orange-400 bg-orange-400/10',
  Other:        'text-gray-400 bg-gray-400/10',
};

const BLANK = {
  address: '', chain: 'ETH', label: '', category: 'Other', notes: '', verified: false,
};

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function WalletLabelsPage() {
  const [labels, setLabels] = useState<WalletLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });

  const loadLabels = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/wallet-labels', { headers: authHeader() });
      const json = await res.json();
      setLabels(json.labels ?? []);
    } catch (err) {
      console.error('Failed to load wallet labels:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLabels(); }, [loadLabels]);

  const filtered = labels.filter(l =>
    [l.address, l.label, l.category, l.notes].some(f => f?.toLowerCase().includes(query.toLowerCase()))
  );

  const save = async () => {
    if (!form.address.trim() || !form.label.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/admin/wallet-labels?id=${editing}`, {
          method: 'PATCH',
          headers: authHeader(),
          body: JSON.stringify(form),
        });
        if (res.ok) {
          setLabels(prev => prev.map(l => l.id === editing ? { ...l, ...form } : l));
          setEditing(null);
        }
      } else {
        const res = await fetch('/api/admin/wallet-labels', {
          method: 'POST',
          headers: authHeader(),
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (json.label) {
          setLabels(prev => [json.label, ...prev]);
        }
      }
      setForm({ ...BLANK });
      setShowForm(false);
    } catch (err) {
      console.error('Failed to save label:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteLabel = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/wallet-labels?id=${id}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      if (res.ok) {
        setLabels(prev => prev.filter(l => l.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete label:', err);
    }
  };

  const editLabel = (label: WalletLabel) => {
    setForm({
      address: label.address,
      chain: label.chain,
      label: label.label,
      category: label.category,
      notes: label.notes ?? '',
      verified: label.verified,
    });
    setEditing(label.id);
    setShowForm(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Wallet Labels</h1>
          <p className="text-xs text-gray-500 mt-0.5">Custom entity labels shown in the intelligence feed and scans</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditing(null); setForm({ ...BLANK }); }}
          className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Label
        </button>
      </div>

      {showForm && (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{editing ? 'Edit Label' : 'New Wallet Label'}</h3>
            <button onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Wallet address"
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40"
            />
            <input
              value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="Entity label (e.g. Binance Hot Wallet)"
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40"
            />
            <select
              value={form.chain}
              onChange={e => setForm(f => ({ ...f, chain: e.target.value }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              {['ETH', 'SOL', 'BASE', 'ARB', 'BSC'].map(c => <option key={c}>{c}</option>)}
            </select>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <input
            value={form.notes ?? ''}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Notes (optional)"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40"
          />
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.verified}
                onChange={e => setForm(f => ({ ...f, verified: e.target.checked }))}
                className="accent-[#0A1EFF]"
              />
              <span className="text-xs text-gray-300">Mark as verified</span>
            </label>
            <div className="flex-1" />
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-60 text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden overflow-x-auto">
        <div className="p-3 border-b border-[#1E2433]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by address, label, or category..."
              className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-sm">Loading labels…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
            {query ? 'No labels match your search.' : 'No wallet labels yet. Add one above.'}
          </div>
        ) : (
          <table className="w-full text-xs min-w-[700px]">
            <thead className="border-b border-[#1E2433]">
              <tr>
                {['Address', 'Chain', 'Label', 'Category', 'Verified', 'Notes', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                  <td className="px-4 py-3 font-mono text-gray-300">{l.address}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-[#1E2433] rounded text-[10px] font-mono text-gray-300">{l.chain}</span>
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">{l.label}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CATEGORY_COLORS[l.category] ?? ''}`}>{l.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    {l.verified
                      ? <span className="text-green-400 text-[10px] font-semibold">Verified</span>
                      : <span className="text-gray-600 text-[10px]">Unverified</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{l.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => editLabel(l)} className="text-gray-500 hover:text-white transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteLabel(l.id)} className="text-red-500/50 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
