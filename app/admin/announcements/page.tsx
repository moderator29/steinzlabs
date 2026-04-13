'use client';

import { useState } from 'react';
import { Bell, Plus, Trash2, Eye, EyeOff, Calendar } from 'lucide-react';

type AnnType = 'info' | 'warning' | 'maintenance' | 'feature';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnType;
  active: boolean;
  createdAt: number;
  expiresAt?: number;
  targetAudience: string;
}

const TYPE_STYLES: Record<AnnType, string> = {
  info:        'text-blue-400 bg-blue-400/10 border-blue-400/20',
  warning:     'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  maintenance: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  feature:     'text-green-400 bg-green-400/10 border-green-400/20',
};

const MOCK_ANN: Announcement[] = [
  { id: '1', title: 'New Swap Engine Live', body: 'Uniswap v3 routing is now live across all EVM chains.', type: 'feature', active: true, createdAt: Date.now() - 86400_000, targetAudience: 'All' },
  { id: '2', title: 'Scheduled Maintenance', body: 'Database maintenance window: 2-4am UTC Saturday.', type: 'maintenance', active: true, createdAt: Date.now() - 3600_000, expiresAt: Date.now() + 86400_000, targetAudience: 'All' },
  { id: '3', title: 'CoinGecko API Degraded', body: 'Some price data may be delayed. Working on a fix.', type: 'warning', active: false, createdAt: Date.now() - 172800_000, targetAudience: 'All' },
];

const BLANK: Omit<Announcement, 'id' | 'createdAt'> = { title: '', body: '', type: 'info', active: true, targetAudience: 'All' };

export default function AnnouncementsPage() {
  const [items, setItems] = useState(MOCK_ANN);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  const save = () => {
    if (!form.title.trim()) return;
    const entry: Announcement = { ...form, id: Date.now().toString(), createdAt: Date.now() };
    setItems(prev => [entry, ...prev]);
    setForm({ ...BLANK });
    setShowForm(false);
  };

  const toggle = (id: string) => setItems(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const remove = (id: string) => setItems(prev => prev.filter(a => a.id !== id));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">In-App Announcements</h1>
          <p className="text-xs text-gray-500 mt-0.5">Banner and notification announcements shown to users</p>
        </div>
        <button onClick={() => setShowForm(p => !p)}
          className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg transition-colors font-medium">
          <Plus className="w-3.5 h-3.5" /> New Announcement
        </button>
      </div>

      {showForm && (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">New Announcement</h3>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="Announcement body..."
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AnnType }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {(['info', 'warning', 'maintenance', 'feature'] as AnnType[]).map(t => <option key={t}>{t}</option>)}
            </select>
            <select value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {['All', 'Pro only', 'Free only'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors">Save</button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-xs px-4 py-2 rounded-lg hover:bg-[#1E2433] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map(ann => (
          <div key={ann.id} className={`bg-[#141824] border rounded-xl p-4 transition-all ${ann.active ? 'border-[#1E2433]' : 'border-[#1E2433] opacity-50'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <Bell className={`w-4 h-4 mt-0.5 flex-shrink-0 ${ann.active ? 'text-[#0A1EFF]' : 'text-gray-600'}`} />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{ann.title}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${TYPE_STYLES[ann.type]}`}>{ann.type}</span>
                    <span className="text-[10px] text-gray-500">{ann.targetAudience}</span>
                  </div>
                  <p className="text-xs text-gray-400">{ann.body}</p>
                  {ann.expiresAt && (
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                      <Calendar className="w-3 h-3" />
                      Expires: {new Date(ann.expiresAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggle(ann.id)} className="text-gray-500 hover:text-white transition-colors">
                  {ann.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button onClick={() => remove(ann.id)} className="text-red-500/50 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
