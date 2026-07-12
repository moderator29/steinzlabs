'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, MessageSquare, ArrowLeftRight, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';

/**
 * Overview quick-access previews — three compact glass cards under the portfolio
 * that surface the user's Watchlist, Messages and Swap without leaving the home
 * Overview. Every card shows REAL data (starred tickers from the user's stocks
 * watchlist, live DM threads) and degrades to an honest empty state; nothing is
 * fabricated. Responsive: single column on mobile, three across on desktop.
 */

interface Convo { id: string; peer_id: string; last_message_at: string | null; last_message_preview?: string | null; is_encrypted?: boolean; unread?: number; }
interface Peer { username?: string | null; display_name?: string | null; avatar_url?: string | null; }

function Card({ href, icon, title, cta, children }: { href: string; icon: React.ReactNode; title: string; cta: string; children: React.ReactNode }) {
  return (
    <div className="nl-glass rounded-2xl p-4 flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[#0066FF]/[0.12] border border-[#0066FF]/25 text-[#7FB2FF] shrink-0">
            {icon}
          </span>
          <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
        </div>
        <Link href={href} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#7FB2FF] hover:text-white transition-colors shrink-0">
          {cta} <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function WatchlistCard() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [syms, setSyms] = useState<string[] | null>(null);
  useEffect(() => {
    if (!uid) { setSyms([]); return; }
    try {
      const raw = window.localStorage.getItem(`nl-stocks-watchlist:${uid}`);
      const arr = raw ? JSON.parse(raw) : [];
      setSyms(Array.isArray(arr) ? arr : []);
    } catch { setSyms([]); }
  }, [uid]);

  return (
    <Card href="/dashboard?subtab=stocks" icon={<Star className="w-4 h-4" />} title="Watchlist" cta="Open">
      {syms === null ? (
        <div className="h-16 rounded-lg bg-white/[0.03] animate-pulse" />
      ) : syms.length === 0 ? (
        <p className="text-[13px] text-white/45 leading-relaxed">Star tickers on the Stocks tab to track them here.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {syms.slice(0, 6).map((s) => (
              <span key={s} className="px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[12px] font-semibold text-white tabular-nums">
                {s.replace(/^\^/, '')}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/40">{syms.length} tracked</p>
        </>
      )}
    </Card>
  );
}

function MessagesCard() {
  const [convos, setConvos] = useState<Convo[] | null>(null);
  const [peers, setPeers] = useState<Record<string, Peer>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/social/dm/conversations', { cache: 'no-store' });
        if (!r.ok) { if (!cancelled) setConvos([]); return; }
        const j = await r.json();
        const list: Convo[] = Array.isArray(j?.conversations) ? j.conversations : [];
        list.sort((a, b) => (b.last_message_at ? Date.parse(b.last_message_at) : 0) - (a.last_message_at ? Date.parse(a.last_message_at) : 0));
        if (cancelled) return;
        setConvos(list);
        const ids = Array.from(new Set(list.slice(0, 3).map((c) => c.peer_id)));
        if (ids.length) {
          const pr = await fetch('/api/social/profile/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
          if (pr.ok) { const pj = await pr.json(); if (!cancelled) setPeers(pj?.profiles ?? {}); }
        }
      } catch { if (!cancelled) setConvos([]); }
    })();
    return () => { cancelled = true; };
  }, []);

  const top = (convos ?? []).slice(0, 3);
  return (
    <Card href="/dashboard/messages" icon={<MessageSquare className="w-4 h-4" />} title="Messages" cta="Open">
      {convos === null ? (
        <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />)}</div>
      ) : top.length === 0 ? (
        <p className="text-[13px] text-white/45 leading-relaxed">No conversations yet. Start a chat from any profile.</p>
      ) : (
        <div className="space-y-1.5">
          {top.map((c) => {
            const p = peers[c.peer_id];
            const name = p?.display_name || p?.username || 'Member';
            const initial = name.trim().charAt(0).toUpperCase();
            const preview = c.last_message_preview || (c.is_encrypted ? 'Encrypted message' : 'New message');
            return (
              <Link key={c.id} href={`/dashboard/messages/${c.peer_id}`} className="flex items-center gap-2.5 rounded-lg p-1.5 -mx-1.5 hover:bg-white/[0.04] transition-colors">
                {p?.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-white/90 shrink-0" style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}>{initial}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-white truncate">{name}</div>
                  <div className="text-[11px] text-white/45 truncate">{preview}</div>
                </div>
                {(c.unread ?? 0) > 0 ? <span className="w-2 h-2 rounded-full bg-[#0066FF] shrink-0" /> : null}
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SwapCard() {
  return (
    <Card href="/dashboard/swap" icon={<ArrowLeftRight className="w-4 h-4" />} title="Swap" cta="Open">
      <p className="text-[13px] text-white/55 leading-relaxed">Trade any token at the best route across chains, with MEV protection.</p>
      <Link
        href="/dashboard/swap"
        className="mt-3 inline-flex items-center justify-center w-full gap-1.5 rounded-xl py-2 text-white text-[13px] font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99]"
        style={{ background: 'linear-gradient(135deg,#1E90FF 0%,#0066FF 100%)', boxShadow: '0 6px 20px rgba(0,102,255,0.35)' }}
      >
        <ArrowLeftRight className="w-4 h-4" /> Open Swap
      </Link>
    </Card>
  );
}

export function OverviewPreviews() {
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold text-white/90 mb-3 px-0.5">Quick access</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <WatchlistCard />
        <MessagesCard />
        <SwapCard />
      </div>
    </div>
  );
}

export default OverviewPreviews;
