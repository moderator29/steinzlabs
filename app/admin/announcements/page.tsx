'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, Eye, EyeOff, Calendar, RefreshCw } from 'lucide-react';

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

const BLANK: Omit<Announcement, 'id' | 'createdAt'> = { title: '', body: '', type: 'info', active: true, targetAudience: 'All' };

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...BLANK });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/announcements', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.announcements)) {
          setItems(data.announcements.map((a: Record<string, unknown>) => ({
            id: a.id as string,
            title: a.title as string,
            body: (a.body as string) || (a.message as string) || '',
            type: (a.type as AnnType) || 'info',
            active: a.active !== false,
            createdAt: new Date((a.created_at as string) || Date.now()).getTime(),
            expiresAt: a.expires_at ? new Date(a.expires_at as string).getTime() : undefined,
            targetAudience: (a.target_audience as string) || 'All',
          })));
        }
      }
    } catch (err) {
      console.error('[announcements] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/announcements', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          type: form.type,
          active: form.active,
          target_audience: form.targetAudience,
          expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      });
      if (res.ok) {
        setForm({ ...BLANK });
        setShowForm(false);
        await load();
      }
    } catch (err) {
      console.error('[announcements] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string) => {
    const ann = items.find(a => a.id === id);
    if (!ann) return;
    setItems(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
    try {
      await fetch(`/api/admin/announcements?id=${id}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ active: !ann.active }),
      });
    } catch (err) {
      console.error('[announcements] Toggle failed:', err);
      setItems(prev => prev.map(a => a.id === id ? { ...a, active: ann.active } : a));
    }
  };

  const remove = async (id: string) => {
    setItems(prev => prev.filter(a => a.id !== id));
    try {
      await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE', headers: authHeader() });
    } catch (err) {
      console.error('[announcements] Delete failed:', err);
      load();
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">In-App Announcements</h1>
          <p className="text-xs text-gray-500 mt-0.5">Banner and notification announcements shown to users</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 text-gray-400 hover:text-white border border-[#1E2433] rounded-lg hover:border-[#2E3443] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowForm(p => !p)}
            className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg transition-colors font-medium">
            <Plus className="w-3.5 h-3.5" /> New Announcement
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">New Announcement</h3>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Announcement title"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
          <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={3} placeholder="Announcement body..."
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 resize-none" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <button onClick={save} disabled={saving} className="bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-xs px-4 py-2 rounded-lg hover:bg-[#1E2433] transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Loading announcements...</span>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bell className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-sm text-gray-400">No announcements yet</p>
          <p className="text-xs text-gray-600 mt-1">Create one to display banners or notifications to users</p>
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
