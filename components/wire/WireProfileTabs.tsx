'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Gift as GiftIcon } from 'lucide-react';
import { VerifiedGoldBadge } from '@/components/ui/VerifiedGoldBadge';
import WireTab from './WireTab';
import type { WirePost, WireAuthor } from './WirePostCard';

/**
 * WireProfileTabs — self-contained 3 sub-tab strip for a user's profile:
 *   Posts    → that user's wire timeline   (WireTab author=userId)
 *   Reposts  → that user's reposts          (WireTab reposts=userId)
 *   Gifts    → gifts RECEIVED by the user    (read-only list of wire_gifts)
 *
 * Slot this into ProfileTab without rewiring its existing structure — it owns
 * its own tab state and data fetching. The Gift button inside the Posts/Reposts
 * feeds bubbles up via the optional `onGift` prop.
 */

export interface WireProfileTabsProps {
  userId: string;
  onGift?: (post: WirePost) => void;
  className?: string;
}

type SubTab = 'posts' | 'reposts' | 'gifts';

interface WireGift {
  id: string;
  post_id: string | null;
  chain: string | null;
  token_symbol: string | null;
  amount: number | null;
  amount_usd: number | null;
  status: string | null;
  created_at: string;
  sender?: WireAuthor | null;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(then).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function GiftsList({ userId }: { userId: string }) {
  const [gifts, setGifts] = useState<WireGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/wire/gifts?recipient=${encodeURIComponent(userId)}`);
      if (!res.ok) {
        setError('Could not load gifts');
        return;
      }
      const j = await res.json();
      setGifts(Array.isArray(j.gifts) ? j.gifts : []);
    } catch {
      setError('Network error loading gifts');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-white/40">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="nl-glass rounded-2xl p-6 text-center">
        <p className="text-white/60 text-sm">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-3 text-[#4d94ff] text-sm hover:underline">
          Try again
        </button>
      </div>
    );
  }
  if (gifts.length === 0) {
    return (
      <div className="nl-glass rounded-2xl p-10 text-center">
        <p className="text-white/70 font-medium">No gifts yet</p>
        <p className="text-white/45 text-sm mt-1">Gifts received on The Wire will show up here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {gifts.map((g) => {
        const sender = g.sender;
        const name = sender?.display_name || sender?.username || 'Someone';
        const usd = typeof g.amount_usd === 'number' && Number.isFinite(g.amount_usd) ? g.amount_usd : null;
        const amount = typeof g.amount === 'number' && Number.isFinite(g.amount) ? g.amount : null;
        return (
          <div key={g.id} className="nl-glass rounded-2xl p-4 flex items-center gap-3">
            {sender?.avatar_url ? (
              <img src={sender.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0" />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white/90 font-semibold border border-white/10"
                style={{ background: 'linear-gradient(135deg,#0066FF33,#5566FF33)' }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white truncate max-w-[10rem]">{name}</span>
                {sender?.is_verified ? <VerifiedGoldBadge size={14} title="Verified" /> : null}
                {sender?.username ? <span className="text-white/45 text-sm truncate">@{sender.username}</span> : null}
                <span className="text-white/30 text-sm">·</span>
                <time className="text-white/45 text-sm" dateTime={g.created_at}>{relativeTime(g.created_at)}</time>
              </div>
              <p className="text-sm text-white/60 mt-0.5">sent a gift</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                <GiftIcon className="w-4 h-4" />
                {usd !== null ? `$${usd.toFixed(2)}` : amount !== null ? `${amount}` : ''}
              </div>
              {g.token_symbol ? (
                <div className="text-[11px] text-white/40 mt-0.5">
                  {amount !== null ? `${amount} ` : ''}{g.token_symbol}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function WireProfileTabs({ userId, onGift, className }: WireProfileTabsProps) {
  const [tab, setTab] = useState<SubTab>('posts');

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'posts', label: 'Posts' },
    { key: 'reposts', label: 'Reposts' },
    { key: 'gifts', label: 'Gifts' },
  ];

  return (
    <div className={className}>
      <div className="flex items-center gap-1 nl-glass rounded-2xl p-1 mb-4 w-full max-w-2xl mx-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 text-sm font-medium py-2 rounded-xl transition ${
              tab === t.key ? 'bg-[#0066FF]/15 text-white border border-[#0066FF]/40' : 'text-white/55 hover:text-white'
            }`}
            aria-pressed={tab === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posts' ? <WireTab author={userId} onGift={onGift} /> : null}
      {tab === 'reposts' ? <WireTab reposts={userId} onGift={onGift} /> : null}
      {tab === 'gifts' ? (
        <div className="w-full max-w-2xl mx-auto">
          <GiftsList userId={userId} />
        </div>
      ) : null}
    </div>
  );
}
