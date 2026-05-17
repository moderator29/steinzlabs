'use client';

import Link from 'next/link';
import { FollowButton } from './FollowButton';

/**
 * UserListRow — the X-style row used in Followers / Following lists
 * and search results. Avatar + name + tier + success badge + inline
 * Follow toggle. Click anywhere except the button → profile.
 */

export interface UserListRowProps {
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    tier: string | null;
    verified_badge: string | null;
    is_chosen: boolean | null;
    success_rate: number | null;
    i_follow: boolean;
    pending_outgoing?: boolean;
  };
  showFollowButton?: boolean;
  onFollowChange?: (next: 'not_following' | 'pending' | 'accepted') => void;
}

const TIER_COLOR: Record<string, string> = {
  free: 'text-slate-400 border-white/10',
  pro:  'text-[var(--nl-blue,#0A1EFF)] border-[var(--nl-blue,#0A1EFF)]/30',
  max:  'text-amber-300 border-amber-500/30',
};

export function UserListRow({ user, showFollowButton = true, onFollowChange }: UserListRowProps) {
  const initial = (user.display_name || user.username || '?').slice(0, 1).toUpperCase();
  const tierClass = TIER_COLOR[user.tier ?? 'free'] ?? TIER_COLOR.free;
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.025] border border-transparent hover:border-white/[0.06] transition-colors">
      <Link href={`/u/${user.username ?? user.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/10" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--nl-blue,#0A1EFF)] to-[#7C3AED] flex items-center justify-center text-sm font-bold text-white">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-white truncate">{user.display_name || user.username}</span>
            {user.is_chosen ? <span className="text-[9px] px-1.5 py-[1px] rounded bg-amber-500/15 text-amber-300 border border-amber-500/25 uppercase">Chosen</span> : null}
            {user.verified_badge ? <span className="text-[9px] px-1.5 py-[1px] rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 uppercase">{user.verified_badge}</span> : null}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
            <span className="truncate">@{user.username}</span>
            {user.tier ? <span className={`px-1.5 py-[1px] rounded border text-[9px] uppercase ${tierClass}`}>{user.tier}</span> : null}
            {typeof user.success_rate === 'number' ? <span className="tabular-nums">{user.success_rate}/100</span> : null}
          </div>
        </div>
      </Link>
      {showFollowButton && (
        <FollowButton
          targetId={user.id}
          initialState={user.i_follow ? 'accepted' : user.pending_outgoing ? 'pending' : 'not_following'}
          onChange={onFollowChange}
          size="sm"
        />
      )}
    </div>
  );
}
