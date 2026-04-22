'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  LifeBuoy, Send, Plus, Clock, CheckCircle, AlertTriangle,
  MessageSquare, Loader2,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';

interface TicketSummary {
  id: string;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: string;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  sender_type: 'user' | 'admin' | 'system';
  message: string;
  created_at: string;
}

interface TicketDetail extends TicketSummary {
  description: string;
  user_email: string | null;
}

const CATEGORIES = [
  { id: 'wallet',  label: 'Wallet' },
  { id: 'swap',    label: 'Swap / Trading' },
  { id: 'payments',label: 'Payments / Billing' },
  { id: 'bug',     label: 'Bug Report' },
  { id: 'feature', label: 'Feature Request' },
  { id: 'account', label: 'Account' },
  { id: 'other',   label: 'Other' },
];

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  open:         { label: 'Open',        color: '#F59E0B', bg: 'rgba(245,158,11,.15)'  },
  in_progress:  { label: 'In progress', color: '#0A1EFF', bg: 'rgba(10,30,255,.15)'   },
  resolved:     { label: 'Resolved',    color: '#10B981', bg: 'rgba(16,185,129,.15)' },
  closed:       { label: 'Closed',      color: '#6B7280', bg: 'rgba(107,114,128,.15)'},
};

function fmtRel(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // List load
  const loadTickets = async () => {
    try {
      const r = await fetch('/api/support/tickets', { cache: 'no-store' });
      if (!r.ok) throw new Error('Failed to load tickets');
      const j = await r.json() as { tickets: TicketSummary[] };
      setTickets(j.tickets ?? []);
    } catch (e) {
      setTickets([]);
      setError(e instanceof Error ? e.message : 'Load failed');
    }
  };

  useEffect(() => { void loadTickets(); }, []);

  // Detail load
  useEffect(() => {
    if (!selected) { setDetail(null); setReplies([]); return; }
    setLoadingDetail(true);
    fetch(`/api/support/tickets/${selected}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Load failed'))))
      .then((j: { ticket: TicketDetail; replies: Reply[] }) => {
        setDetail(j.ticket);
        setReplies(j.replies ?? []);
      })
      .catch(() => { setDetail(null); setReplies([]); })
      .finally(() => setLoadingDetail(false));
  }, [selected]);

  async function createTicket(form: HTMLFormElement) {
    const fd = new FormData(form);
    const payload = {
      subject: String(fd.get('subject') ?? ''),
      description: String(fd.get('description') ?? ''),
      category: String(fd.get('category') ?? 'other'),
      priority: String(fd.get('priority') ?? 'normal'),
    };
    setCreating(true);
    setError(null);
    try {
      const r = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? 'Failed to create ticket');
      setShowForm(false);
      form.reset();
      await loadTickets();
      if (j.ticket?.id) setSelected(j.ticket.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  async function postReply() {
    if (!selected || !replyInput.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/support/tickets/${selected}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyInput.trim() }),
      });
      if (!r.ok) throw new Error('Post failed');
      setReplyInput('');
      // refresh detail
      const d = await fetch(`/api/support/tickets/${selected}`, { cache: 'no-store' }).then((x) => x.json());
      setReplies(d.replies ?? []);
    } catch {
      // keep input, silent fail
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060A14] text-white p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BackButton href="/dashboard" />
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <LifeBuoy className="w-5 h-5 text-[#4D6BFF]" />
                Support
              </h1>
              <p className="text-xs text-gray-500">Get help from the Naka team. Replies by email &amp; Telegram (if linked).</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setSelected(null); }}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> New ticket
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* List */}
          <div className="lg:col-span-1 bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-gray-500 border-b border-white/[0.05]">
              Your tickets
            </div>
            <div className="divide-y divide-white/[0.04] max-h-[70vh] overflow-y-auto">
              {tickets == null ? (
                <div className="p-6 text-center text-sm text-gray-500"><Loader2 className="w-4 h-4 inline animate-spin" /></div>
              ) : tickets.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-500">No tickets yet. Create one to get started.</div>
              ) : tickets.map((t) => {
                const s = STATUS_STYLES[t.status] ?? STATUS_STYLES.open;
                return (
                  <button
                    key={t.id}
                    onClick={() => { setSelected(t.id); setShowForm(false); }}
                    className={`w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors ${selected === t.id ? 'bg-white/[0.04]' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="text-sm font-semibold text-white truncate flex-1">{t.subject}</div>
                      <span
                        className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}35` }}
                      >
                        {s.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-500">
                      <span className="uppercase">{t.category}</span>
                      <span>·</span>
                      <Clock className="w-3 h-3" /> {fmtRel(t.updated_at)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail / Form */}
          <div className="lg:col-span-2 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 min-h-[60vh]">
            {showForm ? (
              <form
                onSubmit={(e) => { e.preventDefault(); void createTicket(e.currentTarget); }}
                className="space-y-4"
              >
                <h2 className="text-base font-bold text-white">New support ticket</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-gray-500 block mb-1">Category</label>
                    <select name="category" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm">
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wide text-gray-500 block mb-1">Priority</label>
                    <select name="priority" defaultValue="normal" className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm">
                      <option value="low">Low</option>
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wide text-gray-500 block mb-1">Subject</label>
                  <input
                    name="subject"
                    type="text"
                    required
                    minLength={3}
                    maxLength={200}
                    placeholder="Quick summary of the issue"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0A1EFF]/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wide text-gray-500 block mb-1">Description</label>
                  <textarea
                    name="description"
                    required
                    minLength={10}
                    maxLength={5000}
                    rows={8}
                    placeholder="Include what you were doing, what happened, and any tx hashes or wallet addresses involved."
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0A1EFF]/50 resize-none"
                  />
                </div>

                <p className="text-[11px] text-gray-500">
                  Attachments are coming soon. For now, paste links to screenshots (Imgur, Droplr, etc.) in the description.
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="inline-flex items-center gap-1.5 text-sm font-bold bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : selected && detail ? (
              <div>
                <div className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-white/[0.05]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-base font-bold text-white truncate">{detail.subject}</h2>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
                      <span className="uppercase font-mono">#{detail.id.slice(0, 8)}</span>
                      <span>·</span>
                      <span className="uppercase">{detail.category}</span>
                      <span>·</span>
                      <span>{fmtRel(detail.created_at)}</span>
                    </div>
                  </div>
                  {(() => {
                    const s = STATUS_STYLES[detail.status] ?? STATUS_STYLES.open;
                    return (
                      <span
                        className="text-[10px] font-bold uppercase px-2 py-1 rounded-full flex-shrink-0"
                        style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}40` }}
                      >
                        {s.label}
                      </span>
                    );
                  })()}
                </div>

                {/* Original description */}
                <div className="mb-4 bg-white/[0.03] border border-white/[0.05] rounded-xl p-4">
                  <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Your original message</div>
                  <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{detail.description}</div>
                </div>

                {/* Thread */}
                <div className="space-y-3 mb-4">
                  {replies.length === 0 ? (
                    <div className="text-[12px] text-gray-500 text-center py-4">
                      No replies yet. The team will respond here and via email.
                    </div>
                  ) : replies.map((r) => (
                    <div
                      key={r.id}
                      className={`rounded-xl p-3 ${r.sender_type === 'admin' ? 'bg-[#0A1EFF]/5 border border-[#0A1EFF]/20' : 'bg-white/[0.02] border border-white/[0.05]'}`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: r.sender_type === 'admin' ? '#4D6BFF' : '#9CA3AF' }}>
                          {r.sender_type === 'admin' ? 'Naka team' : 'You'}
                        </span>
                        <span className="text-[10px] text-gray-600">{fmtRel(r.created_at)}</span>
                      </div>
                      <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{r.message}</div>
                    </div>
                  ))}
                  {loadingDetail && <div className="text-xs text-gray-500"><Loader2 className="w-3.5 h-3.5 inline animate-spin" /> Loading…</div>}
                </div>

                {/* Reply composer */}
                {detail.status !== 'closed' && (
                  <div className="space-y-2">
                    <textarea
                      value={replyInput}
                      onChange={(e) => setReplyInput(e.target.value)}
                      rows={3}
                      placeholder="Add a reply…"
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0A1EFF]/50 resize-none"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={postReply}
                        disabled={posting || !replyInput.trim()}
                        className="inline-flex items-center gap-1.5 text-sm font-bold bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
                      >
                        {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-700 mb-3" />
                <h3 className="text-sm font-semibold text-gray-300 mb-1">Pick a ticket or start a new one.</h3>
                <p className="text-xs text-gray-500 max-w-xs mb-4">We respond to every ticket. Priority on Pro+ and urgent-flagged.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold bg-[#0A1EFF] hover:bg-[#0818CC] text-white px-4 py-2 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> New ticket
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
