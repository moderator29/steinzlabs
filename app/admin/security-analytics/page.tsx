'use client';

import { useState } from 'react';
import { Shield, AlertTriangle, Ban, Search, Plus, Trash2 } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';
import { StatusDot } from '@/components/ui/StatusDot';

interface FlaggedToken {
  id: string;
  address: string;
  symbol: string;
  chain: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  flaggedAt: number;
  flaggedBy: string;
  active: boolean;
}

const MOCK_TOKENS: FlaggedToken[] = [
  { id: '1', address: '0xAb3f...B12E', symbol: 'SCAM1',  chain: 'ETH',  reason: 'Verified honeypot — 0% sell tax override', severity: 'critical', flaggedAt: Date.now() - 3600_000, flaggedBy: 'shadow_guardian', active: true },
  { id: '2', address: '9UeS...mK7J',  symbol: 'RUGPULL', chain: 'SOL',  reason: 'Dev wallet holds 80% of supply', severity: 'high', flaggedAt: Date.now() - 7200_000, flaggedBy: 'admin', active: true },
  { id: '3', address: '0xF2a1...D94C', symbol: 'FAKE2',  chain: 'BASE', reason: 'Mint function enabled, no lock', severity: 'high', flaggedAt: Date.now() - 86400_000, flaggedBy: 'shadow_guardian', active: true },
  { id: '4', address: '0x9B2d...A3E1', symbol: 'OLDSCAM', chain: 'BSC', reason: 'Previously identified rug — relaunched', severity: 'critical', flaggedAt: Date.now() - 172800_000, flaggedBy: 'admin', active: false },
];

const SEVERITY_STYLES: Record<string, string> = {
  low:      'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  medium:   'text-orange-400 bg-orange-400/10 border-orange-400/20',
  high:     'text-red-400 bg-red-400/10 border-red-400/20',
  critical: 'text-red-500 bg-red-500/15 border-red-500/30',
};

export default function SecurityAnalyticsPage() {
  const [tokens, setTokens] = useState(MOCK_TOKENS);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newToken, setNewToken] = useState({ address: '', symbol: '', chain: 'ETH', reason: '', severity: 'high' as const });

  const filtered = tokens.filter(t =>
    [t.address, t.symbol, t.reason].some(f => f.toLowerCase().includes(query.toLowerCase()))
  );

  const addToken = () => {
    if (!newToken.address || !newToken.symbol) return;
    const entry: FlaggedToken = { ...newToken, id: Date.now().toString(), flaggedAt: Date.now(), flaggedBy: 'admin', active: true };
    setTokens(prev => [entry, ...prev]);
    setNewToken({ address: '', symbol: '', chain: 'ETH', reason: '', severity: 'high' });
    setShowAdd(false);
  };

  const removeToken = (id: string) => setTokens(prev => prev.filter(t => t.id !== id));
  const toggleToken = (id: string) => setTokens(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Security Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Flagged token registry — blocks display in security scans</p>
        </div>
        <button onClick={() => setShowAdd(prev => !prev)}
          className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" /> Flag Token
        </button>
      </div>

      {showAdd && (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4">
          <h3 className="text-sm font-semibold text-white mb-3">Flag New Token</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[['address', 'Contract Address'], ['symbol', 'Token Symbol']].map(([name, placeholder]) => (
              <input key={name} placeholder={placeholder} value={(newToken as Record<string, string>)[name]}
                onChange={e => setNewToken(prev => ({ ...prev, [name]: e.target.value }))}
                className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
            ))}
            <select value={newToken.chain} onChange={e => setNewToken(prev => ({ ...prev, chain: e.target.value }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {['ETH', 'SOL', 'BASE', 'ARB', 'BSC'].map(c => <option key={c}>{c}</option>)}
            </select>
            <select value={newToken.severity} onChange={e => setNewToken(prev => ({ ...prev, severity: e.target.value as 'high' }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {['low', 'medium', 'high', 'critical'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <input placeholder="Reason for flagging" value={newToken.reason} onChange={e => setNewToken(prev => ({ ...prev, reason: e.target.value }))}
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 mb-3" />
          <div className="flex gap-2">
            <button onClick={addToken} className="bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-4 py-2 rounded-lg transition-colors font-medium">Add to Registry</button>
            <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-white text-xs px-4 py-2 rounded-lg hover:bg-[#1E2433] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="bg-[#141824] border border-[#1E2433] rounded-xl overflow-hidden">
        <div className="p-3 border-b border-[#1E2433]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by address, symbol, or reason..."
              className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
          </div>
        </div>
        <table className="w-full text-xs">
          <thead className="border-b border-[#1E2433]">
            <tr>{['Token', 'Chain', 'Reason', 'Severity', 'Flagged', 'Source', 'Active', 'Actions'].map(h => (
              <th key={h} className="px-4 py-2.5 text-left text-gray-500 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-b border-[#1E2433] last:border-0 hover:bg-[#1E2433]/30">
                <td className="px-4 py-3">
                  <div className="text-white font-bold">{t.symbol}</div>
                  <div className="font-mono text-gray-500 text-[10px]">{t.address}</div>
                </td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-[#1E2433] rounded text-[10px] font-mono text-gray-300">{t.chain}</span></td>
                <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{t.reason}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${SEVERITY_STYLES[t.severity]}`}>{t.severity}</span>
                </td>
                <td className="px-4 py-3 text-gray-500">{formatTimeAgo(t.flaggedAt)}</td>
                <td className="px-4 py-3 text-gray-400">{t.flaggedBy}</td>
                <td className="px-4 py-3"><StatusDot status={t.active ? 'active' : 'inactive'} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleToken(t.id)} className="text-[10px] text-gray-500 hover:text-white border border-[#1E2433] rounded px-2 py-1 hover:border-[#2E3443] transition-colors">
                      {t.active ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => removeToken(t.id)} className="text-red-500/50 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
