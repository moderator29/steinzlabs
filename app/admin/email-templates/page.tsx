'use client';

import { useState } from 'react';
import { Mail, Plus, Save, Eye, Code, Trash2, Check } from 'lucide-react';

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

const MOCK: EmailTemplate[] = [
  {
    id: '1', name: 'Welcome Email', type: 'transactional', active: true,
    subject: 'Welcome to VTX — Your crypto intelligence platform',
    body: `Hi {{name}},\n\nWelcome to VTX! Your account is now active.\n\nGet started by connecting your wallet at {{app_url}}/dashboard.\n\nBest,\nThe VTX Team`,
    variables: ['name', 'app_url'], updatedAt: Date.now() - 86400_000,
  },
  {
    id: '2', name: 'Security Alert', type: 'system', active: true,
    subject: 'Security alert: New login detected on your account',
    body: `Hi {{name}},\n\nA new login was detected from {{ip}} at {{timestamp}}.\n\nIf this wasn't you, please reset your password immediately.\n\nVTX Security Team`,
    variables: ['name', 'ip', 'timestamp'], updatedAt: Date.now() - 172800_000,
  },
  {
    id: '3', name: 'Weekly Digest', type: 'marketing', active: false,
    subject: 'Your weekly crypto intelligence digest',
    body: `Hi {{name}},\n\nHere's your weekly summary:\n\n- Top movers: {{top_movers}}\n- Whale activity: {{whale_count}} alerts\n- Your portfolio: {{portfolio_change}}\n\nView full report: {{report_url}}\n\nVTX`,
    variables: ['name', 'top_movers', 'whale_count', 'portfolio_change', 'report_url'], updatedAt: Date.now() - 604800_000,
  },
  {
    id: '4', name: 'Subscription Confirmed', type: 'transactional', active: true,
    subject: 'Subscription activated — {{plan}} plan',
    body: `Hi {{name}},\n\nYour {{plan}} plan is now active. Billing starts on {{billing_date}}.\n\nManage your subscription: {{billing_url}}\n\nThank you,\nVTX`,
    variables: ['name', 'plan', 'billing_date', 'billing_url'], updatedAt: Date.now() - 259200_000,
  },
];

const BLANK: Omit<EmailTemplate, 'id' | 'updatedAt'> = {
  name: '', subject: '', body: '', type: 'transactional', active: true, variables: [],
};

function extractVars(text: string): string[] {
  return Array.from(new Set([...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1])));
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState(MOCK);
  const [selected, setSelected] = useState<EmailTemplate | null>(MOCK[0]);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saved, setSaved] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ ...BLANK });

  const save = () => {
    if (!selected) return;
    const vars = extractVars(selected.subject + ' ' + selected.body);
    const updated = { ...selected, variables: vars, updatedAt: Date.now() };
    setTemplates(prev => prev.map(t => t.id === selected.id ? updated : t));
    setSelected(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const createNew = () => {
    if (!newForm.name.trim()) return;
    const vars = extractVars(newForm.subject + ' ' + newForm.body);
    const tpl: EmailTemplate = { ...newForm, id: Date.now().toString(), variables: vars, updatedAt: Date.now() };
    setTemplates(prev => [tpl, ...prev]);
    setSelected(tpl);
    setShowNew(false);
    setNewForm({ ...BLANK });
  };

  const remove = (id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    if (selected?.id === id) setSelected(templates.find(t => t.id !== id) ?? null);
  };

  const previewBody = selected?.body.replace(/\{\{(\w+)\}\}/g, (_, v) => `<span class="bg-yellow-400/20 text-yellow-300 px-1 rounded">[${v}]</span>`) ?? '';

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Email Templates</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage transactional and marketing email templates</p>
        </div>
        <button onClick={() => setShowNew(s => !s)}
          className="flex items-center gap-2 text-xs bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg font-medium transition-colors">
          <Plus className="w-3.5 h-3.5" /> New Template
        </button>
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
          <div className="flex gap-2">
            <button onClick={() => setShowNew(false)} className="text-xs text-gray-400 hover:text-white px-3 py-2">Cancel</button>
            <button onClick={createNew} className="bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-4 py-2 rounded-lg font-medium transition-colors">Create</button>
          </div>
        </div>
      )}

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
                      onChange={e => { const u = { ...selected, active: e.target.checked }; setSelected(u); setTemplates(prev => prev.map(t => t.id === selected.id ? u : t)); }}
                      className="accent-[#0A1EFF]" />
                    <span className="text-xs text-gray-300">Active</span>
                  </label>
                  <button onClick={save} className="flex items-center gap-1.5 bg-[#0A1EFF] hover:bg-[#0818CC] text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors">
                    {saved ? <><Check className="w-3.5 h-3.5" /> Saved</> : <><Save className="w-3.5 h-3.5" /> Save</>}
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
                      <div className="text-sm text-white" dangerouslySetInnerHTML={{ __html: selected.subject.replace(/\{\{(\w+)\}\}/g, (_, v) => `<span class="bg-yellow-400/20 text-yellow-300 px-1 rounded">[${v}]</span>`) }} />
                    </div>
                    <div className="bg-[#0A0E1A] rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 mb-2">Body preview</div>
                      <div className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed" dangerouslySetInnerHTML={{ __html: previewBody }} />
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
    </div>
  );
}
