'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertTriangle, Coins, Flame, Trophy, User } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { EnterResponse, MeResponse, ResolvedMarket, Side } from './types';
import { useLeaderboard, useMarkets, useMe, useNow, usePrices } from './hooks';
import { formatPoints, formatUsd, pickFeatured } from './utils';
import { FeaturedMarket } from './FeaturedMarket';
import { MarketCard } from './MarketCard';
import { LeaderboardView } from './LeaderboardView';
import { MyPredictionsView } from './MyPredictionsView';
import { LivePulse } from './LivePulse';

type View = 'live' | 'leaderboard' | 'mine';

const TABS: { id: View; label: string; Icon: typeof Activity }[] = [
  { id: 'live', label: 'Live', Icon: Activity },
  { id: 'leaderboard', label: 'Leaderboard', Icon: Trophy },
  { id: 'mine', label: 'My Predictions', Icon: User },
];

export default function LivePredict() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const signedIn = !!user;

  const [view, setView] = useState<View>('live');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ tone: 'ok' | 'err'; msg: string } | null>(null);
  // optimistic points overlay: null means "trust the server value".
  const [optimisticPoints, setOptimisticPoints] = useState<number | null>(null);

  const now = useNow();
  const markets = useMarkets(5000);
  const me = useMe(signedIn);
  const leaderboard = useLeaderboard(view === 'leaderboard');

  const data = markets.data;
  const marketList = data?.markets ?? [];
  const results: ResolvedMarket[] = data?.results ?? [];

  // Featured = user's pick if still open, else the soonest-closing open market.
  const featured = useMemo(() => {
    if (selectedId) {
      const chosen = marketList.find((m) => m.id === selectedId);
      if (chosen && Date.parse(chosen.closesAt) - now > 0) return chosen;
    }
    return pickFeatured(marketList, now);
  }, [marketList, selectedId, now]);

  const others = useMemo(
    () => marketList.filter((m) => m.id !== featured?.id && Date.parse(m.closesAt) - now > 0),
    [marketList, featured, now],
  );

  // Poll live prices for the featured + visible grid symbols only.
  const symbols = useMemo(() => {
    const s = new Set<string>();
    if (featured) s.add(featured.symbol);
    for (const m of others.slice(0, 8)) s.add(m.symbol);
    return Array.from(s);
  }, [featured, others]);
  const prices = usePrices(symbols, 2500);

  const featuredPrice = featured ? prices[featured.symbol]?.price ?? null : null;

  // Points shown in the header: optimistic overlay wins until the server catches
  // up, then we drop back to the authoritative /me value.
  const serverPoints = me.data?.points ?? null;
  const displayPoints = optimisticPoints ?? serverPoints;
  useEffect(() => {
    if (optimisticPoints != null && serverPoints != null && serverPoints <= optimisticPoints) {
      setOptimisticPoints(null); // server reconciled
    }
  }, [serverPoints, optimisticPoints]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 3200);
    return () => clearTimeout(id);
  }, [flash]);

  const goSignIn = useCallback(() => router.push('/login'), [router]);

  const handleEnter = useCallback(
    async (side: Side, stake: number) => {
      if (!featured || submitting) return;
      if (!signedIn) return goSignIn();
      if (serverPoints != null && stake > serverPoints) {
        setFlash({ tone: 'err', msg: 'Not enough Naka Points for that stake.' });
        return;
      }
      setSubmitting(true);
      // optimistic: subtract the stake immediately.
      if (serverPoints != null) setOptimisticPoints(Math.max(0, serverPoints - stake));
      try {
        const res = await fetch('/api/predict/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketId: featured.id, side, stake }),
        });
        const json = (await res.json()) as EnterResponse;
        if (!res.ok || !json.ok) {
          setOptimisticPoints(null); // roll back
          setFlash({ tone: 'err', msg: json.error || 'Could not place prediction.' });
        } else {
          if (typeof json.pointsLeft === 'number') setOptimisticPoints(json.pointsLeft);
          setFlash({ tone: 'ok', msg: `Prediction placed — ${side.toUpperCase()} for ${formatPoints(stake)} pts.` });
          me.refresh(); // pull the authoritative open-entry + points
        }
      } catch {
        setOptimisticPoints(null);
        setFlash({ tone: 'err', msg: 'Network error — prediction not placed.' });
      } finally {
        setSubmitting(false);
      }
    },
    [featured, submitting, signedIn, serverPoints, goSignIn, me],
  );

  const streak = me.data?.stats?.currentStreak ?? 0;

  return (
    <div className="nl-aurora-bg relative space-y-4">
      {/* Header strip */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0066FF]/30 bg-[#0066FF]/[0.12] px-3 py-1.5">
          <Coins className="w-4 h-4 text-[#9FD0FF]" />
          <span className="text-sm font-bold tabular-nums text-white">
            {signedIn ? formatPoints(displayPoints) : '—'}
          </span>
          <span className="text-[11px] text-[#9FD0FF]">Naka Points</span>
        </div>

        {signedIn && streak > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-400/[0.1] px-3 py-1.5">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold tabular-nums text-white">{streak}</span>
            <span className="text-[11px] text-orange-300">streak</span>
          </div>
        )}

        {/* segmented control */}
        <div className="ms-auto inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5">
          {TABS.map((t) => {
            const active = view === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setView(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  active ? 'bg-[#0066FF] text-white shadow-[0_0_16px_rgba(0,102,255,0.4)]' : 'text-gray-400 hover:text-white'
                }`}
              >
                <t.Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* flash banner */}
      {flash && (
        <div
          className={`rounded-xl px-3.5 py-2.5 text-sm border ${
            flash.tone === 'ok'
              ? 'border-emerald-400/30 bg-emerald-500/[0.1] text-emerald-300'
              : 'border-rose-400/30 bg-rose-500/[0.1] text-rose-300'
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* Views */}
      {view === 'live' && (
        <LiveView
          featured={featured}
          featuredPrice={featuredPrice}
          others={others}
          results={results}
          now={now}
          me={me.data}
          signedIn={signedIn}
          submitting={submitting}
          loading={markets.loading}
          error={markets.error}
          selectedId={featured?.id ?? null}
          onSelect={setSelectedId}
          onEnter={handleEnter}
          onSignIn={goSignIn}
        />
      )}

      {view === 'leaderboard' && (
        <LeaderboardView
          leaders={leaderboard.data?.leaders ?? null}
          loading={leaderboard.loading}
          error={leaderboard.error}
          currentUserId={user?.id ?? null}
        />
      )}

      {view === 'mine' && (
        <MyPredictionsView
          me={me.data}
          loading={me.loading}
          error={me.error}
          signedIn={signedIn}
          now={now}
          onSignIn={goSignIn}
        />
      )}

      {!authLoading && (
        <p className="text-center text-[10px] text-gray-600">
          Naka Predict is a free-to-play game. Points have no cash value. Odds are model estimates, not financial advice.
        </p>
      )}
    </div>
  );
}

function LiveView({
  featured,
  featuredPrice,
  others,
  results,
  now,
  me,
  signedIn,
  submitting,
  loading,
  error,
  selectedId,
  onSelect,
  onEnter,
  onSignIn,
}: {
  featured: ReturnType<typeof pickFeatured>;
  featuredPrice: number | null;
  others: NonNullable<ReturnType<typeof pickFeatured>>[];
  results: ResolvedMarket[];
  now: number;
  me: MeResponse | null;
  signedIn: boolean;
  submitting: boolean;
  loading: boolean;
  error: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEnter: (side: Side, stake: number) => void;
  onSignIn: () => void;
}) {
  if (loading && !featured) {
    return (
      <div className="space-y-4">
        <div className="nl-glass rounded-3xl h-[520px] animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="nl-glass rounded-2xl h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!featured) {
    return (
      <div className="nl-glass rounded-3xl px-5 py-14 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#0066FF]/10 mb-3">
          {error ? <AlertTriangle className="w-6 h-6 text-amber-400" /> : <Activity className="w-6 h-6 text-[#9FD0FF]" />}
        </div>
        <h3 className="text-base font-semibold text-white">
          {error ? 'Markets unavailable' : 'Markets warming up'}
        </h3>
        <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
          {error
            ? 'We couldn’t reach the prediction engine. No data is shown rather than stale guesses.'
            : 'New Breaking-Live rounds open every few minutes. Hang tight — the next one is on its way.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <FeaturedMarket
        market={featured}
        now={now}
        livePrice={featuredPrice}
        me={me}
        signedIn={signedIn}
        submitting={submitting}
        onEnter={onEnter}
        onSignIn={onSignIn}
      />

      {others.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <LivePulse />
            <h4 className="text-sm font-semibold text-white">More live markets</h4>
            <span className="text-[11px] text-gray-500">{others.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {others.map((m) => (
              <MarketCard key={m.id} market={m} now={now} active={m.id === selectedId} onSelect={() => onSelect(m.id)} />
            ))}
          </div>
        </div>
      )}

      {results.length > 0 && <RecentResults results={results} />}
    </div>
  );
}

function RecentResults({ results }: { results: ResolvedMarket[] }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Recently resolved</h4>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {results.slice(0, 12).map((r) => {
          const yes = r.outcome === 'yes';
          return (
            <div
              key={r.id}
              className={`shrink-0 rounded-xl border px-3 py-2 min-w-[140px] ${
                yes ? 'border-emerald-400/30 bg-emerald-500/[0.07]' : 'border-rose-400/30 bg-rose-500/[0.07]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{r.symbol}</span>
                <span className={`text-[10px] font-bold uppercase ${yes ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {r.outcome}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {r.direction} {formatUsd(r.target)}
              </div>
              <div className="text-[11px] text-gray-500">settled {formatUsd(r.resolvedPrice)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
