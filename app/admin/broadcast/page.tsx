'use client';

import { useState } from 'react';
import { Send, Users, Mail, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

type Audience = 'all' | 'pro' | 'free' | 'inactive';

const AUDIENCE_LABELS: Record<Audience, { label: string; count: number; desc: string }> = {
  all:      { label: 'All Users',         count: 50247, desc: 'Every registered user' },
  pro:      { label: 'Pro Subscribers',   count: 4820,  desc: 'Paid Pro plan users only' },
  free:     { label: 'Free Users',        count: 45427, desc: 'Free tier users only' },
  inactive: { label: 'Inactive (30d)',    count: 12300, desc: 'Users with no login in 30+ days' },
};

export default function BroadcastPage() {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [confirmed, setConfirmed] = useState(false);

  const selectedAudience = AUDIENCE_LABELS[audience];

  const send = async () => {
    if (!confirmed || !subject.trim() || !body.trim()) return;
    setStatus('sending');
    try {
      const token = sessionStorage.getItem('admin_token') ?? '';
      const res = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, body, audience }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
    setConfirmed(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Email Broadcast</h1>
        <p className="text-xs text-gray-500 mt-0.5">Send transactional or marketing emails via Resend</p>
      </div>

      {status === 'sent' && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-4">
          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span className="text-sm text-green-400">Broadcast sent to {selectedAudience.count.toLocaleString()} users.</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-400">Failed to send broadcast. Check server logs.</span>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Audience</h3>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(AUDIENCE_LABELS) as [Audience, typeof AUDIENCE_LABELS[Audience]][]).map(([key, val]) => (
              <button key={key} onClick={() => setAudience(key)}
                className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${audience === key ? 'border-[#0A1EFF] bg-[#0A1EFF]/10' : 'border-[#1E2433] hover:border-[#2E3443]'}`}>
                <Users className={`w-4 h-4 mt-0.5 flex-shrink-0 ${audience === key ? 'text-[#0A1EFF]' : 'text-gray-500'}`} />
                <div>
                  <div className={`text-xs font-semibold ${audience === key ? 'text-white' : 'text-gray-300'}`}>{val.label}</div>
                  <div className="text-[10px] text-gray-500">{val.count.toLocaleString()} recipients — {val.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-[#141824] border border-[#1E2433] rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-white">Email Content</h3>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Subject Line</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter email subject..."
              className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-400">Body (Markdown supported)</label>
              <button onClick={() => setPreview(p => !p)} className="text-[10px] text-[#0A1EFF] hover:text-white transition-colors">
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {preview ? (
              <div className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg p-3 min-h-[200px] text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                {body || <span className="text-gray-600">No content to preview</span>}
              </div>
            ) : (
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={10}
                placeholder="Write your email body here. Supports Markdown formatting..."
                className="w-full bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 resize-none font-mono" />
            )}
          </div>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-orange-400 font-semibold mb-1">Confirm before sending</p>
            <p className="text-xs text-gray-400 mb-2">This will send emails to {selectedAudience.count.toLocaleString()} users ({selectedAudience.label}). This cannot be undone.</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="accent-[#0A1EFF]" />
              <span className="text-xs text-gray-300">I understand and confirm this broadcast</span>
            </label>
          </div>
        </div>

        <button onClick={send} disabled={!confirmed || !subject.trim() || !body.trim() || status === 'sending'}
          className="w-full flex items-center justify-center gap-2 bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors">
          {status === 'sending' ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Send Broadcast</>}
        </button>
      </div>
    </div>
  );
}
