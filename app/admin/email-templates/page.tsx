'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, Plus, Save, Eye, Code, Trash2, Check, RefreshCw } from 'lucide-react';
import { sanitizeHtml } from '@/lib/utils/sanitize';

type TemplateType = 'transactional' | 'marketing' | 'system';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  type: TemplateType;
  active: boolean;
  variables: string[];
  updatedAt: number;
}

const TYPE_STYLES: Record<TemplateType, string> = {
  transactional: 'text-blue-400 bg-blue-400/10',
  marketing:     'text-purple-400 bg-purple-400/10',
  system:        'text-gray-400 bg-gray-400/10',
};

const BLANK: Omit<EmailTemplate, 'id' | 'updatedAt'> = {
  name: '', subject: '', body: '', type: 'transactional', active: true, variables: [],
};

function authHeader() {
  const token = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('admin_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function extractVars(text: string): string[] {
  return Array.from(new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])));
}

function normalizeTemplate(raw: Record<string, unknown>): EmailTemplate {
  const variables = Array.isArray(raw.variables) ? (raw.variables as string[]) : [];
  return {
    id: String(raw.id ?? ''),
    name: (raw.name as string) ?? '',
    subject: (raw.subject as string) ?? '',
    body: (raw.body as string) ?? '',
    type: ((raw.type as TemplateType) ?? 'transactional'),
    active: raw.active !== false,
    variables,
    updatedAt: raw.updated_at ? new Date(raw.updated_at as string).getTime() : Date.now(),
  };
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selected, setSelected] = useState<EmailTemplate | null>(null);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saved, setSaved] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ ...BLANK });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-templates', { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.templates)) {
          const list = data.templates.map((t: Record<string, unknown>) => normalizeTemplate(t));
          setTemplates(list);
          setSelected(prev => {
            if (prev) {
              const found = list.find((t: EmailTemplate) => t.id === prev.id);
              if (found) return found;
            }
            return list[0] ?? null;
          });
        }
      }
    } catch (err) {
      console.error('[email-templates] Load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!selected) return;
    const vars = extractVars(selected.subject + ' ' + selected.body);
    const updated = { ...selected, variables: vars, updatedAt: Date.now() };
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates?id=${selected.id}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({
          name: updated.name,
          subject: updated.subject,
          body: updated.body,
          type: updated.type,
          active: updated.active,
          variables: updated.variables,
        }),
      });
      if (res.ok) {
        setTemplates(prev => prev.map(t => t.id === selected.id ? updated : t));
        setSelected(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('[email-templates] Save failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (next: boolean) => {
    if (!selected) return;
    const updated = { ...selected, active: next };
    setSelected(updated);
    setTemplates(prev => prev.map(t => t.id === selected.id ? updated : t));
    try {
      await fetch(`/api/admin/email-templates?id=${selected.id}`, {
        method: 'PATCH',
        headers: authHeader(),
        body: JSON.stringify({ active: next }),
      });
    } catch (err) {
      console.error('[email-templates] Toggle failed:', err);
    }
  };

  const createNew = async () => {
    if (!newForm.name.trim()) return;
    const vars = extractVars(newForm.subject + ' ' + newForm.body);
    setSaving(true);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify({ ...newForm, variables: vars }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.template) {
          const tpl = normalizeTemplate(data.template);
          setTemplates(prev => [tpl, ...prev]);
          setSelected(tpl);
        }
        setShowNew(false);
        setNewForm({ ...BLANK });
      }
    } catch (err) {
      console.error('[email-templates] Create failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const prevList = templates;
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(templates.find(t => t.id !== id) ?? null);
    try {
      await fetch(`/api/admin/email-templates?id=${id}`, { method: 'DELETE', headers: authHeader() });
    } catch (err) {
      console.error('[email-templates] Delete failed:', err);
      setTemplates(prevList);
    }
  };

  const previewBody = selected?.body.replace(/\{\{(\w+)\}\}/g, (_, v) => `<span class="bg-yellow-400/20 text-yellow-300 px-1 rounded">[${v}]</span>`) ?? '';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Email Templates</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage transactional and marketing email templates</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading} className="p-2 text-gray-400 hover:text-white border border-[#1E2433] rounded-lg hover:border-[#2E3443] transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setShowNew(s => !s)}
            className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg font-medium transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
        </div>
      </div>

      {showNew && (
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 mb-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">New Template</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))} placeholder="Template name"
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
            <select value={newForm.type} onChange={e => setNewForm(f => ({ ...f, type: e.target.value as TemplateType }))}
              className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {(['transactional', 'marketing', 'system'] as TemplateType[]).map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <input value={newForm.subject} onChange={e => setNewForm(f => ({ ...f, subject: e.target.value }))} placeholder="Subject"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
          <textarea value={newForm.body} onChange={e => setNewForm(f => ({ ...f, body: e.target.value }))} rows={4} placeholder="Body (use {{variable}} for placeholders)"
            className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)} className="text-xs text-gray-400 hover:text-white px-3 py-2">Cancel</button>
            <button onClick={createNew} disabled={saving} className="bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {loading && templates.length === 0 && (
        <div className="flex items-center justify-center py-12 gap-2">
          <div className="w-4 h-4 border-2 border-[#0A1EFF]/30 border-t-[#0A1EFF] rounded-full animate-spin" />
          <span className="text-xs text-gray-500">Loading email templates...</span>
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="w-8 h-8 text-gray-700 mb-2" />
          <p className="text-sm text-gray-400">No email templates yet</p>
          <p className="text-xs text-gray-600 mt-1">Create a template to start sending transactional or marketing emails</p>
        </div>
      )}

      {templates.length > 0 && (
        <div className="grid grid-cols-5 gap-4" style={{ minHeight: '500px' }}>
          <div className="col-span-2 space-y-2">
            {templates.map(t => (
              <div key={t.id} onClick={() => setSelected(t)}
                className={`bg-[#141824] border rounded-xl p-3 cursor-pointer transition-all ${selected?.id === t.id ? 'border-[#0A1EFF]/40' : 'border-[#1E2433] hover:border-[#2E3443]'}`}>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-white">{t.name}</span>
                  <button onClick={e => { e.stopPropagation(); remove(t.id); }} className="text-red-500/30 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${TYPE_STYLES[t.type]}`}>{t.type}</span>
                  {t.active ? <span className="text-green-400 text-[9px]">Active</span> : <span className="text-gray-600 text-[9px]">Inactive</span>}
                  <span className="text-[9px] text-gray-600 ml-auto">{t.variables.length} vars</span>
                </div>
              </div>
            ))}
          </div>

          <div className="col-span-3 bg-[#141824] border border-[#1E2433] rounded-xl flex flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="p-4 border-b border-[#1E2433] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#0A1EFF]" />
                    <span className="text-sm font-semibold text-white">{selected.name}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium ${TYPE_STYLES[selected.type]}`}>{selected.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setMode(m => m === 'edit' ? 'preview' : 'edit')}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-[#1E2433] px-2.5 py-1.5 rounded-lg transition-colors">
                      {mode === 'edit' ? <><Eye className="w-3.5 h-3.5" /> Preview</> : <><Code className="w-3.5 h-3.5" /> Edit</>}
                    </button>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={selected.active}
                        onChange={e => toggleActive(e.target.checked)}
                        className="accent-[#0A1EFF]" />
                      <span className="text-xs text-gray-300">Active</span>
                    </label>
                    <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                      {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save'}</>}
                    </button>
                  </div>
                </div>
                <div className="p-4 flex-1 space-y-3 overflow-y-auto">
                  {mode === 'edit' ? (
                    <>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-medium block mb-1">Subject</label>
                        <input value={selected.subject} onChange={e => setSelected(s => s ? { ...s, subject: e.target.value } : s)}
                          className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-medium block mb-1">Body</label>
                        <textarea value={selected.body} onChange={e => setSelected(s => s ? { ...s, body: e.target.value } : s)} rows={10}
                          className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 resize-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 uppercase font-medium block mb-1.5">Variables detected</label>
                        <div className="flex flex-wrap gap-1.5">
                          {extractVars(selected.subject + ' ' + selected.body).map(v => (
                            <span key={v} className="text-[10px] bg-yellow-400/10 text-yellow-300 px-2 py-0.5 rounded font-mono">{`{{${v}}}`}</span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-[#0A0E1A] rounded-lg p-3">
                        <div className="text-[10px] text-gray-500 mb-1">Subject</div>
                        <div className="text-sm text-white" dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.subject.replace(/\{\{(\w+)\}\}/g, (_, v) => `<span class="bg-yellow-400/20 text-yellow-300 px-1 rounded">[${v}]</span>`)) }} />
                      </div>
                      <div className="bg-[#0A0E1A] rounded-lg p-3">
                        <div className="text-[10px] text-gray-500 mb-2">Body preview</div>
                        <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewBody) }} />
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Select a template to edit</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
