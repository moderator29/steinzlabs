'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Search, Plus, Trash2, Loader2 } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';
import { StatusDot } from '@/components/ui/StatusDot';

interface FlaggedToken {
  id: string;
  address: string;
  symbol: string;
  chain: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  flagged_at: string;
  flagged_by: string;
  active: boolean;
}

const SEVERITY_STYLES: Record<string, string> = {
  low:      'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  medium:   'text-orange-400 bg-orange-400/10 border-orange-400/20',
  high:     'text-red-400 bg-red-400/10 border-red-400/20',
  critical: 'text-red-500 bg-red-500/15 border-red-500/30',
};

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function SecurityAnalyticsPage() {
  const [tokens, setTokens] = useState<FlaggedToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newToken, setNewToken] = useState({ address: '', symbol: '', chain: 'ETH', reason: '', severity: 'high' as const });

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/flagged-tokens', { headers: authHeader() });
      if (res.ok) {
        const json = await res.json();
        setTokens(json.tokens ?? []);
      }
    } catch (err) {
      console.error('[SecurityAnalytics] Failed to load tokens:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);

  const filtered = tokens.filter(t =>
    [t.address, t.symbol, t.reason].some(f => f.toLowerCase().includes(query.toLowerCase()))
  );

  const addToken = async () => {
    if (!newToken.address || !newToken.symbol) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/flagged-tokens', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(newToken),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.token) {
          setTokens(prev => [json.token, ...prev]);
        }
        setNewToken({ address: '', symbol: '', chain: 'ETH', reason: '', severity: 'high' });
        setShowAdd(false);
      }
    } catch (err) {
      console.error('[SecurityAnalytics] Failed to add token:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const removeToken = async (id: string) => {
    // Optimistic remove
    setTokens(prev => prev.filter(t => t.id !== id));
    try {
      await fetch(`/api/admin/flagged-tokens?id=${id}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
    } catch (err) {
      console.error('[SecurityAnalytics] Failed to delete token:', err);
      // Reload to restore correct state on failure
      loadTokens();
    }
  };

  const toggleToken = async (id: string) => {
    const target = tokens.find(t => t.id === id);
    if (!target) return;
    const nextActive = !target.active;
    // Optimistic update
    setTokens(prev => prev.map(t => t.id === id ? { ...t, active: nextActive } : t));
    try {
      await fetch(`/api/admin/flagged-tokens?id=${id}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ active: nextActive }),
      });
    } catch (err) {
      console.error('[SecurityAnalytics] Failed to toggle token:', err);
      loadTokens();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Security Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Flagged token registry — blocks display in security scans</p>
        </div>
        <button
          onClick={() => setShowAdd(prev => !prev)}
          className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Flag Token
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Flag New Token</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {[['address', 'Contract Address'], ['symbol', 'Token Symbol']].map(([name, placeholder]) => (
              <input
                key={name}
                placeholder={placeholder}
                value={(newToken as Record<string, string>)[name]}
                onChange={e => setNewToken(prev => ({ ...prev, [name]: e.target.value }))}
                className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40"
              />
            ))}
            <select
              value={newToken.chain}
              onChange={e => setNewToken(prev => ({ ...prev, chain: e.target.value }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              {['ETH', 'SOL', 'BASE', 'ARB', 'BSC'].map(c => <option key={c}>{c}</option>)}
            </select>
            <select
              value={newToken.severity}
              onChange={e => setNewToken(prev => ({ ...prev, severity: e.target.value as 'high' }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
            >
              {['low', 'medium', 'high', 'critical'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <input
            placeholder="Reason for flagging"
            value={newToken.reason}
            onChange={e => setNewToken(prev => ({ ...prev, reason: e.target.value }))}
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={addToken}
              disabled={submitting}
              className="bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
              Add to Registry
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="text-gray-400 hover:text-white text-xs px-4 py-2 rounded-lg hover:bg-[#1E2433] transition-colors"
            >
              Cancel
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
              placeholder="Search by address, symbol, or reason..."
              className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading flagged tokens…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
            <Shield className="w-8 h-8 text-gray-600" />
            <p className="text-sm">{tokens.length === 0 ? 'No flagged tokens yet.' : 'No results match your search.'}</p>
          </div>
        ) : (
          <table className="w-full text-xs min-w-[700px]">
            <thead className="border-b border-[#1E2433]">
              <tr>
                {['Token', 'Chain', 'Reason', 'Severity', 'Flagged', 'Source', 'Active', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                  <td className="px-4 py-3">
                    <div className="text-white font-bold">{t.symbol}</div>
                    <div className="font-mono text-gray-500 text-[10px]">{t.address}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-[#1E2433] rounded text-[10px] font-mono text-gray-300">{t.chain}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{t.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${SEVERITY_STYLES[t.severity]}`}>
                      {t.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatTimeAgo(new Date(t.flagged_at).getTime())}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{t.flagged_by}</td>
                  <td className="px-4 py-3"><StatusDot status={t.active ? 'active' : 'inactive'} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleToken(t.id)}
                        className="text-[10px] text-gray-500 hover:text-white border border-[#1E2433] rounded px-2 py-1 hover:border-[#2E3443] transition-colors"
                      >
                        {t.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => removeToken(t.id)}
                        className="text-red-500/50 hover:text-red-400 transition-colors"
                      >
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
