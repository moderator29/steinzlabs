'use client';

import { useEffect, useState, useTransition } from 'react';
import { UserPlus, Check, Clock, X } from 'lucide-react';
import { getCachedFollowState, setCachedFollowState, onFollowChange } from '@/lib/social/follow-cache';

/**
 * FollowButton — drives all four states from a single piece of UI:
 *   not_following  → "Follow"     (primary)
 *   pending        → "Requested"  (with hover-Cancel)
 *   accepted       → "Following"  (with hover-Unfollow)
 *   mutual         → "Following"  + "Mutual" pill
 *
 * Owns the optimistic toggle + the rate-limit 429 surfacing. Calls
 * POST/DELETE/PATCH /api/social/follow.
 */

export interface FollowButtonProps {
  targetId: string;
  initialState: 'not_following' | 'pending' | 'accepted';
  mutual?: boolean;
  /** Called after a successful state change so the parent can refresh counts. */
  onChange?: (next: 'not_following' | 'pending' | 'accepted') => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function FollowButton({ targetId, initialState, mutual, onChange, size = 'md', className }: FollowButtonProps) {
  // §social-follow-cache — prefer the cross-surface cache (set by any
  // FollowButton instance on success) so when the user follows someone
  // in the Top Success Rate leaderboard and then navigates to Top
  // Followers, the same row already reads as "Following" without
  // waiting for a fresh API roundtrip.
  const [state, setState] = useState(() => getCachedFollowState(targetId) ?? initialState);
  const [hover, setHover] = useState(false);
  // §follow-inversion — after an optimistic state flip the pointer is still
  // physically over the button, so `hover` stays true and the freshly-
  // accepted state would render its destructive hover label ("Unfollow")
  // the instant you click "Follow" — reading as inverted/broken. Suppress
  // the destructive affordance until the pointer leaves and returns.
  const [justChanged, setJustChanged] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const showDestructive = hover && !justChanged;

  // Subscribe to cross-surface changes so siblings update in real time.
  useEffect(() => {
    const cached = getCachedFollowState(targetId);
    if (cached && cached !== state) setState(cached);
    return onFollowChange((id, next) => { if (id === targetId) setState(next); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  const send = async () => {
    setError(null);
    try {
      if (state === 'not_following') {
        const res = await fetch('/api/social/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: targetId }),
        });
        if (res.status === 429) { setError('Slow down — too many follows recently.'); return; }
        if (!res.ok) { setError('Could not follow'); return; }
        const json = await res.json();
        const next = json.follow?.status === 'pending' ? 'pending' : 'accepted';
        setState(next);
        setJustChanged(true);
        setCachedFollowState(targetId, next);
        onChange?.(next);
      } else {
        const res = await fetch(`/api/social/follow?target_id=${targetId}`, { method: 'DELETE' });
        if (!res.ok) { setError('Could not unfollow'); return; }
        setState('not_following');
        setJustChanged(true);
        setCachedFollowState(targetId, 'not_following');
        onChange?.('not_following');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleClick = () => startTransition(send);

  const base =
    size === 'sm'
      ? 'text-[11px] px-2.5 py-1 rounded-md'
      : 'text-[12px] px-3.5 py-1.5 rounded-lg';
  const palette =
    state === 'not_following'
      ? 'bg-[var(--nl-blue,#0A1EFF)] hover:bg-[var(--nl-blue-strong,#0916CC)] text-white border border-transparent'
      : state === 'pending'
      ? 'bg-white/[0.04] hover:bg-amber-500/10 text-amber-300 border border-amber-500/30'
      : showDestructive
      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
      : 'bg-emerald-500/[0.08] text-emerald-300 border border-emerald-500/25';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => { setHover(false); setJustChanged(false); }}
        onFocus={() => setHover(true)}
        onBlur={() => { setHover(false); setJustChanged(false); }}
        className={`inline-flex items-center gap-1.5 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${base} ${palette}`}
        aria-label={
          state === 'not_following' ? `Follow user` :
          state === 'pending' ? `Cancel follow request` :
          showDestructive ? `Unfollow user` : `Following`
        }
      >
        {state === 'not_following' ? (<><UserPlus className="w-3 h-3" />Follow</>)
          : state === 'pending' ? (showDestructive ? (<><X className="w-3 h-3" />Cancel</>) : (<><Clock className="w-3 h-3" />Requested</>))
          : showDestructive ? (<><X className="w-3 h-3" />Unfollow</>) : (<><Check className="w-3 h-3" />Following</>)}
        {state === 'accepted' && mutual && !showDestructive && (
          <span className="ms-1 px-1.5 py-[1px] rounded text-[9px] bg-[var(--nl-blue,#0A1EFF)]/15 text-[var(--nl-blue,#0A1EFF)] border border-[var(--nl-blue,#0A1EFF)]/25">
            Mutual
          </span>
        )}
      </button>
      {error ? <div className="mt-1 text-[10px] text-red-400" role="alert">{error}</div> : null}
    </div>
  );
}
