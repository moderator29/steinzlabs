'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, AlertTriangle, Coins, Flame, Trophy, User } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { EnterResponse, Market, MeResponse, ResolvedMarket, Side } from './types';
import { useLeaderboard, useMarkets, useMe, useNow, usePrices } from './hooks';
import { formatPoints, formatUsd, pickFeatured } from './utils';
import { FeaturedMarket } from './FeaturedMarket';
import { MarketCard } from './MarketCard';
import { LeaderboardView } from './LeaderboardView';
import { MyPredictionsView } from './MyPredictionsView';
import { LivePulse } from './LivePulse';
import { QuickPlay } from './QuickPlay';
import { DailyBonus } from './DailyBonus';
import { ResultCelebration, type Celebration } from './ResultCelebration';

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
    // The optimistic overlay is always set to a server-authoritative target
    // (pointsLeft on entry, points on claim), so drop it the moment /me agrees —
    // this reconciles both spends (down) and daily claims (up) without flicker.
    if (optimisticPoints != null && serverPoints != null && serverPoints === optimisticPoints) {
      setOptimisticPoints(null);
    }
  }, [serverPoints, optimisticPoints]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 3200);
    return () => clearTimeout(id);
  }, [flash]);

  const goSignIn = useCallback(() => router.push('/login'), [router]);

  // Generic entry — shared by the featured threshold market and Quick Play's
  // one-tap UP/DOWN. Optimistic points (subtract the stake now, reconcile from
  // the authoritative pointsLeft), then pull /me for the fresh open position.
  const handleEnterMarket = useCallback(
    async (marketId: string, side: Side, stake: number): Promise<boolean> => {
      if (submitting) return false;
      if (!signedIn) {
        goSignIn();
        return false;
      }
      if (serverPoints != null && stake > serverPoints) {
        setFlash({ tone: 'err', msg: 'Not enough Naka Points for that stake.' });
        return false;
      }
      setSubmitting(true);
      if (serverPoints != null) setOptimisticPoints(Math.max(0, serverPoints - stake));
      try {
        const res = await fetch('/api/predict/enter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ marketId, side, stake }),
        });
        const json = (await res.json()) as EnterResponse;
        if (!res.ok || !json.ok) {
          setOptimisticPoints(null); // roll back
          setFlash({ tone: 'err', msg: json.error || 'Could not place prediction.' });
          return false;
        }
        if (typeof json.pointsLeft === 'number') setOptimisticPoints(json.pointsLeft);
        setFlash({ tone: 'ok', msg: `Prediction placed. ${formatPoints(stake)} pts staked.` });
        me.refresh(); // pull the authoritative open-entry + points
        return true;
      } catch {
        setOptimisticPoints(null);
        setFlash({ tone: 'err', msg: 'Network error. Prediction not placed.' });
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, signedIn, serverPoints, goSignIn, me],
  );

  const handleEnter = useCallback(
    (side: Side, stake: number) => {
      if (!featured) return;
      void handleEnterMarket(featured.id, side, stake);
    },
    [featured, handleEnterMarket],
  );

  // Daily bonus lands directly on the balance; reconcile via /me.
  const handleDailyClaimed = useCallback(
    (points: number) => {
      setOptimisticPoints(points);
      me.refresh();
    },
    [me],
  );

  // ── Result celebration ──────────────────────────────────────────────────────
  // Watch the user's entries: when one that was OPEN flips to won/lost, flash a
  // single tasteful toast. Seed on first load so past history never replays.
  const prevOpenIds = useRef<Set<string> | null>(null);
  const celebratedIds = useRef<Set<string>>(new Set());
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [celebQueue, setCelebQueue] = useState<Celebration[]>([]);

  useEffect(() => {
    const d = me.data;
    if (!d) return;
    const openIds = new Set(d.open.map((e) => e.id));
    const prev = prevOpenIds.current;
    if (prev == null) {
      // First sighting: mark all currently-resolved entries as already seen.
      for (const e of d.history) celebratedIds.current.add(e.id);
    } else {
      const fresh: Celebration[] = [];
      for (const e of d.history) {
        const status = e.status?.toLowerCase();
        if ((status === 'won' || status === 'lost') && prev.has(e.id) && !celebratedIds.current.has(e.id)) {
          celebratedIds.current.add(e.id);
          fresh.push({ id: e.id, entry: e, won: status === 'won', streak: d.stats?.currentStreak ?? 0 });
        }
      }
      if (fresh.length) setCelebQueue((q) => [...q, ...fresh]);
    }
    prevOpenIds.current = openIds;
  }, [me.data]);

  // Show one celebration at a time.
  useEffect(() => {
    if (!celebration && celebQueue.length) {
      setCelebration(celebQueue[0]);
      setCelebQueue((q) => q.slice(1));
    }
  }, [celebration, celebQueue]);

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

        {signedIn && <DailyBonus now={now} onClaimed={handleDailyClaimed} />}

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
          markets={marketList}
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
          onEnterMarket={handleEnterMarket}
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

      <ResultCelebration celebration={celebration} onClose={() => setCelebration(null)} />
    </div>
  );
}

function LiveView({
  markets,
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
  onEnterMarket,
  onSignIn,
}: {
  markets: Market[];
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
  onEnterMarket: (marketId: string, side: Side, stake: number) => Promise<boolean>;
  onSignIn: () => void;
}) {
  const quickPlay = (
    <QuickPlay
      markets={markets}
      now={now}
      me={me}
      signedIn={signedIn}
      submitting={submitting}
      onEnter={onEnterMarket}
      onSignIn={onSignIn}
    />
  );

  if (loading && !featured) {
    return (
      <div className="space-y-4">
        {quickPlay}
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
      <div className="space-y-4">
        {quickPlay}
        <FeaturedEmpty error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {quickPlay}
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

function FeaturedEmpty({ error }: { error: boolean }) {
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
          : 'New Breaking-Live rounds open every few minutes. Hang tight, the next one is on its way.'}
      </p>
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
