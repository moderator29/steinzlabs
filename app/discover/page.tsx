'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Compass } from 'lucide-react';
import { LeaderboardColumn } from '@/components/social/LeaderboardColumn';
import { RecommendationsStrip } from '@/components/social/RecommendationsStrip';
import { SearchBox } from '@/components/social/SearchBox';
import { UserListRow } from '@/components/social/UserListRow';
import BackButton from '@/components/ui/BackButton';
import { GlassCard } from '@/components/ui/GlassCard';
import { AuroraBackground } from '@/components/brand/AuroraBackground';
import { useFeatureUsageLog } from '@/lib/hooks/useFeatureUsageLog';

/**
 * /discover — the hub: search box, recommendations strip, 5 visible
 * leaderboards (Top Success / Top Followers / New Users / Max Tier /
 * Top Traders). The full 8-board grid lives at /leaderboard/[kind].
 *
 * ?q=... triggers a dedicated search-results view instead of the
 * leaderboard grid so deep-linked searches land on results, not the
 * hub.
 */

function DiscoverInner() {
  useFeatureUsageLog('discover');
  const sp = useSearchParams();
  const q = sp.get('q')?.trim() ?? '';

  return (
    <AuroraBackground fullHeight>
      <div className="min-h-screen p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <BackButton />
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-[var(--nl-blue,#0066FF)]" />
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Discover users</h1>
          </div>
        </div>

        <div className="mb-5">
          <SearchBox autoFocus={!q} />
        </div>

        {q ? <SearchResults q={q} /> : <DiscoverHub />}
      </div>
    </AuroraBackground>
  );
}

function DiscoverHub() {
  return (
    <div className="space-y-4">
      <RecommendationsStrip />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <LeaderboardColumn kind="success-rate" title="Top Success Rate" description="Verified performers by composite score" />
        <LeaderboardColumn kind="followers"    title="Top Followers"    description="Most followed on the platform" />
        <LeaderboardColumn kind="new-users"    title="New Users"        description="Recently joined" />
        <LeaderboardColumn kind="max-tier"     title="Max Tier"         description="Top-tier members" />
        <LeaderboardColumn kind="top-traders"  title="Top Traders"      description="Highest 30-day portfolio gains" />
        <LeaderboardColumn kind="most-active"  title="Most Active"      description="Daily-active users" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LeaderboardColumn kind="copy-traders"   title="Top Copy Traders"   description="Best copy-trade win rates" />
        <LeaderboardColumn kind="whale-watchers" title="Top Whale Watchers" description="Most accurate whale follows" />
      </div>
    </div>
  );
}

interface User {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tier: string | null;
  verified_badge: string | null;
  is_chosen: boolean | null;
  i_follow?: 'not_following' | 'pending' | 'accepted';
  they_follow_me?: boolean;
}

function SearchResults({ q }: { q: string }) {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/social/search?q=${encodeURIComponent(q)}&limit=25`);
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) setUsers(json.users ?? []);
        else setError(json.error ?? 'Failed to search');
      } catch {
        if (!cancelled) setError('Network error');
      }
    })();
    return () => { cancelled = true; };
  }, [q]);

  if (error) return <div className="text-sm text-red-400">{error}</div>;
  if (users === null) return <div className="text-sm text-slate-400">Searching…</div>;
  if (users.length === 0) return <div className="text-sm text-slate-400">No users match &quot;{q}&quot;.</div>;
  return (
    <GlassCard className="p-2 divide-y divide-white/[0.05]">
      {users.map((u) => (
        <UserListRow
          key={u.id}
          user={{
            id: u.id,
            username: u.username,
            display_name: u.display_name,
            avatar_url: u.avatar_url,
            tier: u.tier,
            verified_badge: u.verified_badge,
            is_chosen: u.is_chosen,
            success_rate: null,
            i_follow: u.i_follow === 'accepted',
            pending_outgoing: u.i_follow === 'pending',
            they_follow_me: u.they_follow_me ?? false,
          }}
        />
      ))}
    </GlassCard>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>}>
      <DiscoverInner />
    </Suspense>
  );
}
