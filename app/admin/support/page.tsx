'use client';

import { useState } from 'react';
import { LifeBuoy, MessageSquare, ChevronRight, X, Send, Clock } from 'lucide-react';
import { formatTimeAgo } from '@/lib/formatters';
import { StatusDot } from '@/components/ui/StatusDot';

type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type Priority = 'low' | 'medium' | 'high' | 'urgent';

interface Ticket {
  id: string;
  subject: string;
  body: string;
  userEmail: string;
  status: TicketStatus;
  priority: Priority;
  createdAt: number;
  replies: { from: string; body: string; ts: number }[];
}

const PRIORITY_STYLES: Record<Priority, string> = {
  low:    'text-gray-400 bg-gray-400/10',
  medium: 'text-yellow-400 bg-yellow-400/10',
  high:   'text-orange-400 bg-orange-400/10',
  urgent: 'text-red-400 bg-red-400/10',
};

const STATUS_DOT: Record<TicketStatus, 'active' | 'warning' | 'inactive' | 'error'> = {
  open: 'warning', in_progress: 'active', resolved: 'inactive', closed: 'inactive',
};

const MOCK: Ticket[] = [
  { id: 'TKT-001', subject: 'Swap failed but funds deducted', body: 'I tried to swap 0.1 ETH for USDC on Base but the transaction failed and my ETH was still deducted.', userEmail: 'alice@example.com', status: 'open', priority: 'urgent', createdAt: Date.now() - 3600_000, replies: [] },
  { id: 'TKT-002', subject: 'Can\'t login after password reset', body: 'After resetting my password I get an invalid credentials error.', userEmail: 'bob@example.com', status: 'in_progress', priority: 'high', createdAt: Date.now() - 7200_000, replies: [{ from: 'admin', body: 'Looking into this now.', ts: Date.now() - 3600_000 }] },
  { id: 'TKT-003', subject: 'Portfolio not showing Solana positions', body: 'My Solana wallet shows 0 positions even though I have tokens.', userEmail: 'carol@example.com', status: 'open', priority: 'medium', createdAt: Date.now() - 14400_000, replies: [] },
  { id: 'TKT-004', subject: 'Feature request: Telegram alerts', body: 'Would love to get whale alerts via Telegram bot.', userEmail: 'dave@example.com', status: 'resolved', priority: 'low', createdAt: Date.now() - 86400_000, replies: [{ from: 'admin', body: 'Telegram integration is on our Q3 roadmap!', ts: Date.now() - 43200_000 }] },
];

export default function SupportPage() {
  const [tickets, setTickets] = useState(MOCK);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);
  const open = tickets.filter(t => t.status === 'open').length;

  const sendReply = () => {
    if (!reply.trim() || !selected) return;
    const newReply = { from: 'admin', body: reply, ts: Date.now() };
    const updated = tickets.map(t => t.id === selected.id
      ? { ...t, status: 'in_progress' as TicketStatus, replies: [...t.replies, newReply] }
      : t);
    setTickets(updated);
    setSelected(updated.find(t => t.id === selected.id) ?? null);
    setReply('');
  };

  const updateStatus = (id: string, status: TicketStatus) => {
    const updated = tickets.map(t => t.id === id ? { ...t, status } : t);
    setTickets(updated);
    setSelected(updated.find(t => t.id === id) ?? null);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Support Tickets</h1>
          <p className="text-xs text-gray-500 mt-0.5">{open} open tickets</p>
        </div>
        <div className="flex gap-1.5">
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${filter === s ? 'bg-[#0A1EFF] text-white' : 'text-gray-400 hover:text-white border border-[#1E2433] hover:border-[#2E3443]'}`}>
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 h-[calc(100vh-200px)]">
        <div className="col-span-2 space-y-2 overflow-y-auto">
          {filtered.map(t => (
            <div key={t.id} onClick={() => setSelected(t)}
              className={`bg-[#141824] border rounded-xl p-3 cursor-pointer transition-all ${selected?.id === t.id ? 'border-[#0A1EFF]/40' : 'border-[#1E2433] hover:border-[#2E3443]'}`}>
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <span className="text-xs font-semibold text-white line-clamp-1">{t.subject}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <StatusDot status={STATUS_DOT[t.status]} size="sm" />
                <span className="text-[10px] text-gray-500 capitalize">{t.status.replace('_', ' ')}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                <span className="ml-auto text-[10px] text-gray-600">{formatTimeAgo(t.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="col-span-3 bg-[#141824] border border-[#1E2433] rounded-xl flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="p-4 border-b border-[#1E2433]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">{selected.subject}</h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{selected.userEmail}</span>
                      <span>·</span>
                      <span>{selected.id}</span>
                      <span>·</span>
                      <span>{formatTimeAgo(selected.createdAt)}</span>
                    </div>
                  </div>
                  <select value={selected.status} onChange={e => updateStatus(selected.id, e.target.value as TicketStatus)}
                    className="bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-2 py-1 text-xs text-white focus:outline-none">
                    {(['open', 'in_progress', 'resolved', 'closed'] as TicketStatus[]).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="bg-[#0A0E1A] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-semibold text-gray-400">{selected.userEmail}</span>
                    <Clock className="w-3 h-3 text-gray-600" />
                    <span className="text-[10px] text-gray-600">{formatTimeAgo(selected.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-300">{selected.body}</p>
                </div>
                {selected.replies.map((r, i) => (
                  <div key={i} className={`rounded-xl p-3 ${r.from === 'admin' ? 'bg-[#0A1EFF]/10 border border-[#0A1EFF]/20 ml-6' : 'bg-[#0A0E1A]'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-semibold ${r.from === 'admin' ? 'text-[#0A1EFF]' : 'text-gray-400'}`}>{r.from === 'admin' ? 'Support Team' : r.from}</span>
                      <span className="text-[10px] text-gray-600">{formatTimeAgo(r.ts)}</span>
                    </div>
                    <p className="text-xs text-gray-300">{r.body}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-[#1E2433] flex gap-2">
                <textarea value={reply} onChange={e => setReply(e.target.value)} rows={2} placeholder="Write a reply..."
                  className="flex-1 bg-[#0A0E1A] border border-[#1E2433] rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#0A1EFF]/40 resize-none" />
                <button onClick={sendReply} disabled={!reply.trim()} className="bg-[#0A1EFF] hover:bg-[#0818CC] disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
              Select a ticket to view
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
