'use client';

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import BackButton from '@/components/ui/BackButton';
import { FollowButton } from '@/components/social/FollowButton';
import { MessageButton } from '@/components/social/MessageButton';
import { MoreMenu } from '@/components/social/MoreMenu';
import { UserListRow } from '@/components/social/UserListRow';
import { TierBadge } from '@/components/ui/TierBadge';
import { GlassCard } from '@/components/ui/GlassCard';

/**
 * /u/[username] — public profile.
 * Header (avatar + name + tier + verified) → 4 stat containers
 * (Subscription, Wallet, Followers, Following) → action row
 * (Follow + Message + More) → tabs (Overview / Following / Followers).
 *
 * Platform users don't post, so there is no Posts tab/stat.
 */

interface ProfileResponse {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    tier: string | null;
    verified_badge: string | null;
    is_verified: boolean;
    is_chosen: boolean;
    is_private: boolean;
    dm_permission: 'everyone' | 'following' | 'mutual' | 'nobody';
    show_activity: boolean;
    social_links: Record<string, string>;
    created_at: string;
  };
  counts: { followers: number; following: number };
  success_rate: number | null;
  relationship: {
    i_follow: boolean;
    they_follow_me: boolean;
    pending_outgoing: boolean;
    pending_incoming: boolean;
    i_blocked: boolean;
    i_muted: boolean;
  } | null;
}

type Tab = 'overview' | 'following' | 'followers';

export default function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ id: string; username: string; display_name: string | null } | null>(null);
  const [unblocking, setUnblocking] = useState(false);

  const load = useCallback(async () => {
    try {
      setBlocked(null);
      const res = await fetch(`/api/social/profile/${encodeURIComponent(username)}`);
      if (res.status === 404) { setError('User not found'); return; }
      const json = await res.json();
      if (json?.blocked_by_me) { setBlocked(json.profile); setData(null); return; }
      if (!res.ok) { setError(json.error ?? 'Failed'); return; }
      setBlocked(null);
      setData(json);
    } catch {
      setError('Network error');
    }
  }, [username]);

  useEffect(() => { void load(); }, [load]);

  const unblock = async () => {
    if (!blocked) return;
    setUnblocking(true);
    try {
      await fetch(`/api/social/block?target_id=${blocked.id}`, { method: 'DELETE' });
      await load();
    } finally {
      setUnblocking(false);
    }
  };

  if (error) return <div className="min-h-screen flex items-center justify-center text-slate-400">{error}</div>;

  // Caller has blocked this user — show a blocked state with an Unblock action
  // instead of the full profile (industry-standard).
  if (blocked) {
    return (
      <div className="min-h-screen p-4 sm:p-6 max-w-md mx-auto">
        <div className="mb-4"><BackButton /></div>
        <GlassCard className="p-8 text-center">
          <div className="text-base font-semibold text-white">You blocked @{blocked.username}</div>
          <p className="text-sm text-slate-400 mt-2">You can&apos;t see their profile or messages, and they can&apos;t message you. Unblock to restore.</p>
          <button
            onClick={unblock}
            disabled={unblocking}
            className="mt-5 px-4 py-2 rounded-lg bg-[var(--nl-blue,#0066FF)] text-white text-sm font-semibold disabled:opacity-50"
          >
            {unblocking ? 'Unblocking…' : 'Unblock'}
          </button>
        </GlassCard>
      </div>
    );
  }

  if (!data) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;

  const p = data.profile;
  const rel = data.relationship;
  const initial = (p.display_name || p.username || '?').slice(0, 1).toUpperCase();
  const mutual = !!rel?.i_follow && !!rel?.they_follow_me;
  // Open-DM model — anyone can message unless the user explicitly restricted
  // DMs (mutual/following/nobody) or there's a block. Default (unset) is open.
  const dmPermissionView: 'allowed' | 'not_mutual' | 'not_following' | 'nobody' | 'blocked' =
    rel?.i_blocked
      ? 'blocked'
      : p.dm_permission === 'nobody'
      ? 'nobody'
      : p.dm_permission === 'following'
      ? rel?.they_follow_me ? 'allowed' : 'not_following'
      : p.dm_permission === 'mutual'
      ? mutual ? 'allowed' : 'not_mutual'
      : 'allowed';

  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="mb-4"><BackButton /></div>

      <header className="flex items-start gap-4 mb-5">
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar_url} alt="" className="w-20 h-20 rounded-2xl object-cover border border-white/10" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--nl-blue,#0066FF)] to-[#7C3AED] flex items-center justify-center text-2xl font-bold text-white">
            {initial}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{p.display_name || p.username}</h1>
            <TierBadge tier={p.tier} size={20} />
            {/* The gold 'verified_badge' is already represented by the gold Max
                TierBadge above, so only render a chip for other badge values. */}
            {p.verified_badge && p.verified_badge !== 'gold' ? <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 uppercase">{p.verified_badge}</span> : null}
            {p.is_private ? <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/10 uppercase">Private</span> : null}
          </div>
          <div className="text-[13px] text-slate-400">@{p.username}</div>
          {p.bio ? <p className="text-sm text-slate-200 mt-2 max-w-2xl">{p.bio}</p> : null}
        </div>
      </header>

      {rel && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <FollowButton
            targetId={p.id}
            initialState={rel.i_follow ? 'accepted' : rel.pending_outgoing ? 'pending' : 'not_following'}
            mutual={mutual}
            onChange={() => load()}
          />
          <MessageButton peerId={p.id} permission={dmPermissionView} />
          <MoreMenu
            targetId={p.id}
            targetUsername={p.username}
            isBlocked={rel.i_blocked}
            isMuted={rel.i_muted}
            onChange={() => load()}
          />
          {rel.pending_incoming && (
            <Link
              href="#"
              onClick={async (e) => {
                e.preventDefault();
                await fetch('/api/social/follow', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ follower_id: p.id, action: 'accept' }),
                });
                load();
              }}
              className="ms-auto text-[12px] px-3 py-1.5 rounded-lg bg-[var(--nl-blue,#0066FF)]/15 text-[var(--nl-blue,#0066FF)] border border-[var(--nl-blue,#0066FF)]/25"
            >
              Approve their follow request
            </Link>
          )}
        </div>
      )}

      {/* stat containers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <StatCard label="Subscription" value={p.tier ? p.tier.toUpperCase() : 'FREE'} />
        <StatCard label="Wallet" value={p.show_activity ? 'Public' : 'Hidden'} />
        <Link href={`/u/${p.username}/followers`} className="contents">
          <StatCard label="Followers" value={data.counts.followers.toLocaleString()} clickable />
        </Link>
        <Link href={`/u/${p.username}/following`} className="contents">
          <StatCard label="Following" value={data.counts.following.toLocaleString()} clickable />
        </Link>
      </div>

      {data.success_rate !== null && (
        <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/[0.08] border border-emerald-500/25 text-emerald-300 text-[12px] font-semibold">
          Success rate <span className="tabular-nums">{data.success_rate}/100</span>
        </div>
      )}

      <div className="flex gap-1 p-1 nl-glass rounded-xl mb-4">
        {(['overview', 'following', 'followers'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[12px] font-semibold rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-[var(--nl-blue,#0066FF)] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === 'overview' && <OverviewTab profile={p} />}
        {tab === 'following' && <FollowListInline kind="following" userId={p.id} />}
        {tab === 'followers' && <FollowListInline kind="followers" userId={p.id} />}
      </div>
    </div>
  );
}

function StatCard({ label, value, hint, clickable }: { label: string; value: string; hint?: string; clickable?: boolean }) {
  return (
    <GlassCard interactive={clickable} className="p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-base font-bold text-white tabular-nums mt-0.5">{value}</div>
      {hint ? <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div> : null}
    </GlassCard>
  );
}

function OverviewTab({ profile }: { profile: ProfileResponse['profile'] }) {
  return (
    <GlassCard className="p-4 space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Joined</div>
        <div className="text-sm text-slate-200">{new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
      </div>
      {profile.bio && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Bio</div>
          <div className="text-sm text-slate-200 whitespace-pre-wrap">{profile.bio}</div>
        </div>
      )}
      {Object.keys(profile.social_links).length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Links</div>
          <ul className="text-sm text-[var(--nl-blue,#0066FF)] space-y-0.5">
            {Object.entries(profile.social_links).map(([k, v]) => (
              <li key={k}><a href={v} target="_blank" rel="noopener noreferrer">{k}</a></li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  );
}

function FollowListInline({ kind, userId }: { kind: 'followers' | 'following'; userId: string }) {
  const [items, setItems] = useState<Array<{
    id: string; username: string | null; display_name: string | null; avatar_url: string | null;
    tier: string | null; verified_badge: string | null; is_chosen: boolean | null;
    success_rate: number | null; i_follow: boolean; pending_outgoing?: boolean;
  }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/social/follows/list?user_id=${userId}&kind=${kind}&limit=25`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) setItems(json.users ?? []);
        else setError(json.error ?? 'Failed');
      } catch {
        if (!cancelled) setError('Network error');
      }
    })();
    return () => { cancelled = true; };
  }, [kind, userId]);
  if (error) return <div className="text-sm text-red-400">{error}</div>;
  if (items === null) return <div className="text-sm text-slate-400">Loading…</div>;
  if (items.length === 0) return <div className="text-sm text-slate-400 italic">No {kind} yet.</div>;
  return (
    <GlassCard className="divide-y divide-white/[0.05]">
      {items.map((u) => <UserListRow key={u.id} user={u} />)}
    </GlassCard>
  );
}
