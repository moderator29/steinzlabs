'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import {
  AlertTriangle, Play, Pause, ExternalLink, Plus, TrendingUp, Trash2,
  Crosshair, Loader2, Lock, Power, Zap, Target, Search, RefreshCw, Radar, Clock, Bell, ShieldAlert,
} from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { ChainLogo } from '@/components/common/ChainLogo';
import { useNavState } from '@/lib/nav/useNavState';
import { supabase } from '@/lib/supabase';
import { useAuth, hasTierAccess } from '@/lib/hooks/useAuth';
import { CHAIN_CONFIGS, SNIPER_CHAINS, type SniperChain } from '@/lib/sniper/chains';
import { SelectMenu, type SelectOption } from '@/components/ui/SelectMenu';
import { NewSniperModal } from './NewSniperModal';
import { SniperWalletModal } from './SniperWalletModal';
import { SniperTokenDrawer } from './SniperTokenDrawer';
import { WalletStatus } from './WalletStatus';
import { BackgroundSnipingCard } from '@/components/sniper/BackgroundSnipingCard';
import { AutosellStatusCard } from '@/components/sniper/AutosellStatusCard';
import { LimitOrdersTab, AlertsTab, useAlertSound } from './OrdersAlerts';
import { normalizeAddress } from '@/lib/utils/addressNormalize';
import {
  type DetectedToken, fmtUSD, timeAgo,
} from './sniperShared';
import { LAUNCHPADS } from '@/lib/sniper/launchpads';
import { SourceFilterRow } from '@/components/sniper/SourceFilterRow';
import { TokenCard } from '@/components/sniper/TokenCard';
import { FeedSoundToggle } from '@/components/sniper/FeedSoundToggle';
import { useFeedSound } from '@/lib/sniper/useFeedSound';
import { HowItWorksButton } from '@/components/common/HowItWorks';
import { sniperHowItWorks } from '@/lib/howItWorks/content/sniper';

interface SniperCriteriaRow {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  paused: boolean;
  trigger_type: string;
  chains_allowed: string[];
  amount_per_snipe_usd: number;
  daily_max_snipes: number;
  daily_max_spend_usd: number;
  auto_execute: boolean;
  max_slippage_bps: number;
  priority_fee_native: number | null;
  mev_protect: boolean;
  take_profit_pct: number | null;
  stop_loss_pct: number | null;
  trailing_stop_pct: number | null;
  wallet_addresses: string[];
  launchpads_allowed: string[] | null;
  expiry_hours: number | null;
  created_at: string;
  updated_at: string;
}

interface ExecutionRow {
  id: string;
  token_symbol: string | null;
  token_address: string;
  chain: string | null;
  amount_native: number | null;
  amount_sol: number | null;
  status: string;
  tx_hash: string | null;
  pnl_usd: number | null;
  buy_amount_usd?: number | null;
  entry_price_usd?: number | null;
  tokens_received?: number | null;
  realized_at?: string | null;
  executed_at: string;
  execution_time_ms: number | null;
}

/** Matcher decision-trail row (sniper_match_events via /api/sniper/executions). */
interface MatchEventRow {
  id: string;
  criteria_id: string | null;
  matched_token_address: string;
  matched_chain: string | null;
  trigger_reason: string | null;
  decision: string;
  executed_tx_hash: string | null;
  pnl_usd: number | null;
  details: { amount_usd?: number; token_symbol?: string } | null;
  created_at: string;
}

type Tab = 'discover' | 'positions' | 'limit' | 'alerts' | 'snipers' | 'history';

// This top-level selector filters the user's OWN sniper criteria + execution
// history — NOT the discover feed (which has its own chain picker). Criteria
// are creatable on every SNIPER_CHAINS chain (Solana/TON included), so all of
// them must be filterable here; restricting it to EVM hid a user's Solana/TON
// snipers behind a filter that could never select them.
const CRITERIA_FILTER_CHAINS = SNIPER_CHAINS;

// Discover feed page size; "Load more" pages by this offset.
const FEED_PAGE = 60;

// Early-entry liquidity presets — catch coins at 5k/10k/15k.
const LIQ_PRESETS: { label: string; value: number }[] = [
  { label: 'Any', value: 0 },
  { label: '≥5K', value: 5000 },
  { label: '≥10K', value: 10000 },
  { label: '≥15K', value: 15000 },
  { label: '≥50K', value: 50000 },
];

export default function SniperPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const hasSniperAccess = hasTierAccess(user, 'max');

  const [tab, setTab] = useState<Tab>('discover');
  const [chainFilter, setChainFilter] = useState<SniperChain | 'all'>('all');

  useNavState(
    'sniper',
    () => ({ tab, chainFilter }),
    (s) => {
      if (typeof s.tab === 'string') setTab(s.tab as Tab);
      if (typeof s.chainFilter === 'string') setChainFilter(s.chainFilter as SniperChain | 'all');
    },
  );

  const [snipers, setSnipers] = useState<SniperCriteriaRow[]>([]);
  const [executions, setExecutions] = useState<ExecutionRow[]>([]);
  const [feedTokens, setFeedTokens] = useState<DetectedToken[]>([]);
  const [feedTotal, setFeedTotal] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [minLiq, setMinLiq] = useState(0);
  // Discover-feed chain selector — independent of the global chainFilter so the
  // feed can target the full launchpad chain set (solana, base, arbitrum, …)
  // without breaking the EVM-only Positions/History/Snipers tabs.
  const [feedChain, setFeedChain] = useState<string>('all');
  const [feedSort, setFeedSort] = useState<'new' | 'volume' | 'liquidity' | 'mcap'>('new');
  const [excludeHoneypots, setExcludeHoneypots] = useState(false);
  const [socialOnly, setSocialOnly] = useState(false);
  // OG mode — earliest token we've seen per (chain, symbol). Honest "first seen
  // on Naka", not "first ever" (we have no global launch index).
  const [ogMode, setOgMode] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [feedQuery, setFeedQuery] = useState('');
  const [killSwitchOn, setKillSwitchOn] = useState(false);
  const [killToggling, setKillToggling] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [drawerToken, setDrawerToken] = useState<DetectedToken | null>(null);
  // Prefill the create-sniper modal with the token the user clicked 'Snipe'/
  // 'Create Sniper for {symbol}' on (was discarded — every quick-buy opened a
  // blank modal).
  const [prefillToken, setPrefillToken] = useState<DetectedToken | null>(null);
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());

  // ── Meme Zone sound alerts (Discover feed) ─────────────────────────────────
  const feedSound = useFeedSound();
  // Snapshot of the previous refresh: which token ids existed and their bonding
  // curve %, so we can detect freshly-appeared tokens and ~90% graduate crosses.
  const prevFeedRef = useRef<{ ids: Set<string>; bonding: Map<string, number> } | null>(null);
  // Set when the last feed mutation was a "Load more" append, so pagination is
  // never mistaken for freshly-detected tokens.
  const pagingRef = useRef(false);

  useEffect(() => {
    if (tab !== 'discover') return;
    // Wait for the first non-empty page before seeding a baseline, otherwise the
    // initial empty→populated transition would read every token as "new".
    if (feedTokens.length === 0) return;
    const wasPaging = pagingRef.current;
    pagingRef.current = false;
    const prev = prevFeedRef.current;
    const ids = new Set(feedTokens.map((t) => t.id));
    const bonding = new Map<string, number>();
    for (const t of feedTokens) {
      if (typeof t.bondingCurvePct === 'number') bonding.set(t.id, t.bondingCurvePct);
    }
    // First populated load just seeds the baseline — don't chime on initial fill.
    if (prev && !wasPaging) {
      const hasNew = feedTokens.some((t) => !prev.ids.has(t.id));
      // Graduate cross: a token that was below the threshold last cycle and is
      // now at/above it (and was already present, so it's a genuine crossing).
      const graduated = feedTokens.some((t) => {
        if (typeof t.bondingCurvePct !== 'number' || !prev.ids.has(t.id)) return false;
        const before = prev.bonding.get(t.id);
        return before != null && before < feedSound.graduatePct && t.bondingCurvePct >= feedSound.graduatePct;
      });
      if (feedSound.enabled && (hasNew || graduated)) {
        // Debounced to one chime per refresh cycle even on a burst of new pairs.
        feedSound.playChime(graduated);
      }
    }
    prevFeedRef.current = { ids, bonding };
    // playChime / graduatePct are stable enough; depend on the feed snapshot and
    // the enabled flag so toggling on doesn't retroactively replay old tokens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedTokens, tab, feedSound.enabled]);

  // ── Data loaders ─────────────────────────────────────────────────────────
  const loadSnipers = useCallback(async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('sniper_criteria').select('*').eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    if (!error && data) setSnipers(data as SniperCriteriaRow[]);
  }, [user?.id]);

  const loadExecutions = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('sniper_executions')
      .select('id, token_symbol, token_address, chain, amount_native, amount_sol, status, tx_hash, pnl_usd, buy_amount_usd, entry_price_usd, tokens_received, realized_at, executed_at, execution_time_ms')
      .eq('user_id', user.id).order('executed_at', { ascending: false }).limit(100);
    if (data) setExecutions(data as ExecutionRow[]);
  }, [user?.id]);

  const loadKillSwitch = useCallback(async () => {
    try {
      // Per-user kill state (same source the toggle writes), so it round-trips
      // across reloads instead of reflecting the unrelated admin platform state.
      const res = await fetch('/api/sniper/kill-switch', { cache: 'no-store' });
      const j = await res.json();
      setKillSwitchOn(j?.killed === true);
    } catch { /* keep default */ }
  }, []);

  // Build the GET /api/sniper query from the current discover-feed filters.
  const buildFeedParams = useCallback((offset: number) => {
    const params = new URLSearchParams({ limit: String(FEED_PAGE), offset: String(offset), sort: feedSort });
    if (feedChain !== 'all') params.set('chain', feedChain);
    // Always send minLiquidity — '0' means "no floor".
    params.set('minLiquidity', String(minLiq));
    if (sourceFilter.length) params.set('source', sourceFilter.join(','));
    const auditFlags: string[] = [];
    if (excludeHoneypots) auditFlags.push('nohoneypot');
    if (socialOnly) auditFlags.push('social');
    if (auditFlags.length) params.set('audit', auditFlags.join(','));
    if (ogMode) params.set('og', '1');
    // Forward the search term (symbol/name/address) so it resolves server-side.
    const qTrim = feedQuery.trim();
    if (qTrim) params.set('q', qTrim);
    return params;
  }, [feedChain, feedSort, minLiq, sourceFilter, excludeHoneypots, socialOnly, ogMode, feedQuery]);

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/sniper?${buildFeedParams(0).toString()}`, { cache: 'no-store' });
      const j = await res.json();
      setFeedTokens(j?.tokens ?? []);
      setFeedTotal(typeof j?.total === 'number' ? j.total : (j?.tokens?.length ?? 0));
    } catch (err) {
      Sentry.captureException(err, { tags: { surface: 'sniper/feed' } });
    } finally {
      setFeedLoading(false);
    }
  }, [buildFeedParams]);

  const loadMoreFeed = useCallback(async () => {
    setFeedLoadingMore(true);
    try {
      const res = await fetch(`/api/sniper?${buildFeedParams(feedTokens.length).toString()}`, { cache: 'no-store' });
      const j = await res.json();
      const more: DetectedToken[] = j?.tokens ?? [];
      // Mark this mutation as pagination so the sound effect doesn't treat the
      // appended older page as freshly-detected tokens and chime.
      pagingRef.current = true;
      setFeedTokens((prev) => {
        // De-dupe by id so a live refresh overlapping the next page never
        // renders the same token twice.
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...more.filter((m) => !seen.has(m.id))];
      });
      if (typeof j?.total === 'number') setFeedTotal(j.total);
    } catch (err) {
      Sentry.captureException(err, { tags: { surface: 'sniper/feed-more' } });
    } finally {
      setFeedLoadingMore(false);
    }
  }, [buildFeedParams, feedTokens.length]);

  // ── Initial + reactive loads ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || !user) return;
    Promise.all([loadSnipers(), loadExecutions(), loadKillSwitch()]).finally(() => setLoading(false));
  }, [authLoading, user, loadSnipers, loadExecutions, loadKillSwitch]);

  useEffect(() => {
    if (tab !== 'discover') return;
    // Debounce so typing in the search box (which feeds loadFeed) doesn't fire
    // a request per keystroke; address paste still resolves within 350ms.
    const t = window.setTimeout(() => loadFeed(), 350);
    return () => window.clearTimeout(t);
  }, [tab, loadFeed]);

  // Live feed — silently re-pull the first page every ~20s so newly-launched
  // pairs surface without a manual refresh (only while the tab is visible).
  useEffect(() => {
    if (tab !== 'discover') return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadFeed();
    }, 20_000);
    return () => window.clearInterval(id);
  }, [tab, loadFeed]);

  // Realtime execution fills (Photon/BullX parity — instant, with flash).
  useEffect(() => {
    if (!user?.id || !supabase) return;
    const channel = supabase
      .channel(`sniper-executions-${user.id}`)
      .on(
        'postgres_changes',
        // '*' so PnL backfill / realized_at / peak-price UPDATEs reach the UI,
        // not just new fills (INSERT). Merge updates by id; prepend inserts.
        { event: '*', schema: 'public', table: 'sniper_executions', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as ExecutionRow;
          if (!row?.id) return;
          if (payload.eventType === 'UPDATE') {
            setExecutions((prev) => prev.map((e) => (e.id === row.id ? { ...e, ...row } : e)));
            return;
          }
          setExecutions((prev) => (prev.some((e) => e.id === row.id) ? prev : [row, ...prev].slice(0, 100)));
          setFreshIds((prev) => new Set(prev).add(row.id));
          window.setTimeout(() => {
            setFreshIds((prev) => {
              if (!prev.has(row.id)) return prev;
              const next = new Set(prev); next.delete(row.id); return next;
            });
          }, 2400);
        },
      )
      .subscribe((status) => setLiveConnected(status === 'SUBSCRIBED'));
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const togglePause = async (s: SniperCriteriaRow) => {
    const next = !s.paused;
    setSnipers((prev) => prev.map((x) => (x.id === s.id ? { ...x, paused: next } : x)));
    await supabase.from('sniper_criteria').update({ paused: next }).eq('id', s.id);
  };

  const removeSniper = async (s: SniperCriteriaRow) => {
    if (!confirm(`Delete sniper "${s.name}"? This cannot be undone.`)) return;
    setSnipers((prev) => prev.filter((x) => x.id !== s.id));
    await supabase.from('sniper_criteria').delete().eq('id', s.id);
  };

  const toggleKillSwitch = async () => {
    if (killToggling) return;
    setKillToggling(true);
    const next = !killSwitchOn;
    try {
      const res = await fetch('/api/sniper/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !next, reason: next ? 'User killed all snipers' : null }),
      });
      if (res.ok) {
        setKillSwitchOn(next);
        // Refresh the snipers list so the cards + Active stat reflect the new
        // paused state instead of contradicting the killed banner.
        await loadSnipers();
      }
    } finally {
      setKillToggling(false);
    }
  };

  const visibleSnipers = useMemo(
    () => (chainFilter === 'all' ? snipers : snipers.filter((s) => s.chains_allowed.includes(chainFilter))),
    [snipers, chainFilter],
  );

  const totalPnl = useMemo(() => executions.reduce((s, e) => s + (Number(e.pnl_usd) || 0), 0), [executions]);

  // Realtime alert-trigger sound (Photon/BullX parity).
  useAlertSound(user?.id);

  // ── Render gates ─────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>;
  }
  if (!user) { router.push('/login'); return null; }
  if (!hasSniperAccess) return <UpgradeGate onUpgrade={() => router.push('/dashboard/pricing')} />;

  // ── Main UI ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto px-4 py-5">
        <BackButton />

        {/* Command bar */}
        <div className="mt-3 nl-glass rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative w-11 h-11 rounded-2xl bg-[#0066FF]/15 border border-[#0066FF]/40 flex items-center justify-center shrink-0">
                <Crosshair className="w-6 h-6 text-blue-300" />
                <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${liveConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Sniper</h1>
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">Non-Custodial</span>
                </div>
                <p className="text-[11px] sm:text-xs text-white/50">Sub-2s execution · EVM · MEV-protected · Shadow Guardian gated</p>
              </div>
              <Link href="/dashboard/launch-radar" title="Launch Radar — new launches worth watching" className="ms-auto shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#00C8FF] bg-[#0066FF]/10 border border-[#0066FF]/30 hover:border-[#0066FF]/50 transition-colors">
                <Radar className="w-3.5 h-3.5" /> Launch Radar
              </Link>
              <HowItWorksButton content={sniperHowItWorks} className="shrink-0" />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <WalletStatus onConnect={() => setShowWalletModal(true)} refreshKey={walletRefresh} />
              <button
                onClick={toggleKillSwitch}
                disabled={killToggling}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border font-bold text-xs transition ${
                  killSwitchOn
                    ? 'bg-red-500/15 border-red-500/50 text-red-300 hover:bg-red-500/25'
                    : 'bg-white/[0.04] border-white/10 text-white/70 hover:text-white hover:border-white/20'
                }`}
              >
                {killToggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                {killSwitchOn ? 'Resume' : 'Kill Switch'}
              </button>
              <button onClick={() => setShowNewModal(true)} className="nl-btn-neon inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs">
                <Plus className="w-4 h-4" /> New Sniper
              </button>
            </div>
          </div>

          {killSwitchOn && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2.5">
              <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
              <p className="text-red-200 text-xs font-medium">All snipers are killed server-side. No new executions fire until you resume.</p>
            </div>
          )}

          {/* #41 — built-in-wallet background (AA) sniping setup. Renders only
              when a Naka wallet exists locally; dormant if AA isn't configured. */}
          <div className="mt-4">
            <BackgroundSnipingCard />
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-4">
            <StatCard label="Active Snipers" value={snipers.filter((s) => s.enabled && !s.paused).length} icon={Target} />
            <StatCard label="Executions" value={executions.length} icon={Zap} />
            <StatCard label="Realized PnL" value={fmtUSD(totalPnl)} icon={TrendingUp} accent={totalPnl >= 0 ? 'pos' : 'neg'} />
            <StatCard
              label="Avg Speed"
              value={(() => {
                const times = executions.map((e) => e.execution_time_ms).filter((t): t is number => t != null && t > 0);
                if (!times.length) return '—';
                const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
                return avg < 1000 ? `${avg}ms` : `${(avg / 1000).toFixed(2)}s`;
              })()}
              icon={Radar}
            />
          </div>
        </div>

        {/* Sub-nav + chain filter */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 self-start">
            <NavPill id="discover" current={tab} onClick={setTab} icon={Radar}>Discover</NavPill>
            <NavPill id="positions" current={tab} onClick={setTab} icon={TrendingUp}>Positions</NavPill>
            <NavPill id="limit" current={tab} onClick={setTab} icon={Clock}>Limit</NavPill>
            <NavPill id="alerts" current={tab} onClick={setTab} icon={Bell}>Alerts</NavPill>
            <NavPill id="snipers" current={tab} onClick={setTab} icon={Crosshair} count={visibleSnipers.length}>Snipers</NavPill>
            <NavPill id="history" current={tab} onClick={setTab} icon={Zap}>History</NavPill>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Chain</span>
            <SelectMenu
              value={chainFilter}
              options={[
                { id: 'all', label: 'All chains' } as SelectOption,
                ...CRITERIA_FILTER_CHAINS.map((c): SelectOption => ({ id: c, label: CHAIN_CONFIGS[c].name, chain: c })),
              ]}
              onChange={(id) => setChainFilter(id as SniperChain | 'all')}
            />
          </div>
        </div>

        <div className="mt-4">
          {tab === 'discover' && (
            <DiscoverTab
              tokens={feedTokens} total={feedTotal} loading={feedLoading} loadingMore={feedLoadingMore}
              onRefresh={loadFeed} onLoadMore={loadMoreFeed}
              onSnipe={(t) => { setPrefillToken(t); setShowNewModal(true); }} onOpen={setDrawerToken}
              minLiq={minLiq} setMinLiq={setMinLiq}
              feedChain={feedChain} setFeedChain={setFeedChain}
              sort={feedSort} setSort={setFeedSort}
              excludeHoneypots={excludeHoneypots} setExcludeHoneypots={setExcludeHoneypots}
              socialOnly={socialOnly} setSocialOnly={setSocialOnly}
              ogMode={ogMode} setOgMode={setOgMode}
              sourceFilter={sourceFilter} setSourceFilter={setSourceFilter}
              query={feedQuery} setQuery={setFeedQuery}
              soundEnabled={feedSound.enabled} soundVolume={feedSound.volume}
              onToggleSound={feedSound.toggle} onSetSoundVolume={feedSound.setVolume}
            />
          )}
          {tab === 'positions' && <PositionsTab executions={executions} />}
          {tab === 'limit' && <LimitOrdersTab />}
          {tab === 'alerts' && <AlertsTab />}
          {tab === 'snipers' && (
            <SnipersTab snipers={visibleSnipers} onPause={togglePause} onDelete={removeSniper} onCreate={() => setShowNewModal(true)} />
          )}
          {tab === 'history' && <HistoryTab executions={executions} chainFilter={chainFilter} freshIds={freshIds} />}
        </div>
      </div>

      {showNewModal && (
        <NewSniperModal onClose={() => { setShowNewModal(false); setPrefillToken(null); }} onSaved={() => { setShowNewModal(false); setPrefillToken(null); loadSnipers(); }} userId={user.id} prefillToken={prefillToken} />
      )}
      {showWalletModal && (
        <SniperWalletModal userId={user.id} onClose={() => setShowWalletModal(false)} onConnected={() => setWalletRefresh((n) => n + 1)} />
      )}
      {drawerToken && (
        <SniperTokenDrawer
          token={drawerToken}
          onClose={() => setDrawerToken(null)}
          onSnipe={(t) => { setDrawerToken(null); setPrefillToken(t); setShowNewModal(true); }}
        />
      )}
    </div>
  );
}

// ─── Upgrade gate ─────────────────────────────────────────────────────────

function UpgradeGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="min-h-screen text-white p-6">
      <BackButton />
      <div className="max-w-md mx-auto mt-20 text-center nl-glass rounded-2xl p-8">
        <Lock className="w-12 h-12 mx-auto mb-4 text-amber-400" />
        <h1 className="text-2xl font-bold mb-2">Sniper is MAX-tier</h1>
        <p className="text-white/70 mb-6">Upgrade to MAX for non-custodial EVM sniping with sub-2s execution, anti-MEV routing, Shadow Guardian gating, and TP/SL automation.</p>
        <button onClick={onUpgrade} className="nl-btn-neon px-6 py-3 rounded-xl font-semibold">Upgrade to MAX</button>
      </div>
    </div>
  );
}

// ─── Stat card / nav pill ───────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }>; accent?: 'pos' | 'neg' }) {
  const valColor = accent === 'pos' ? 'text-emerald-300' : accent === 'neg' ? 'text-red-300' : 'text-white';
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-1">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className={`text-xl font-bold ${valColor}`}>{value}</div>
    </div>
  );
}

function NavPill({ id, current, onClick, count, icon: Icon, children }: { id: Tab; current: Tab; onClick: (t: Tab) => void; count?: number; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  const active = id === current;
  return (
    <button
      onClick={() => onClick(id)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
        active ? 'bg-[#0066FF]/20 text-blue-200 border border-[#0066FF]/40' : 'text-white/55 hover:text-white border border-transparent'
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{children}</span>
      {count != null && count > 0 && (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${active ? 'bg-blue-500/30 text-blue-100' : 'bg-white/10 text-white/60'}`}>{count}</span>
      )}
    </button>
  );
}

// ─── Discover (feed) ────────────────────────────────────────────────────────

// Chain pills for the discover feed — slugs sent straight to the API `chain`
// param (independent of the EVM-only CHAIN_CONFIGS used by the other tabs).
const FEED_CHAINS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'solana', label: 'Solana' },
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'base', label: 'Base' },
  { id: 'bsc', label: 'BSC' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'optimism', label: 'Optimism' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'avalanche', label: 'Avalanche' },
];

const SORT_OPTIONS: { id: 'new' | 'volume' | 'liquidity' | 'mcap'; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'volume', label: 'Volume' },
  { id: 'liquidity', label: 'Liquidity' },
  { id: 'mcap', label: 'Market cap' },
];

function DiscoverTab({
  tokens, total, loading, loadingMore, onRefresh, onLoadMore, onSnipe, onOpen,
  minLiq, setMinLiq, feedChain, setFeedChain, sort, setSort,
  excludeHoneypots, setExcludeHoneypots, socialOnly, setSocialOnly, ogMode, setOgMode,
  sourceFilter, setSourceFilter, query, setQuery,
  soundEnabled, soundVolume, onToggleSound, onSetSoundVolume,
}: {
  tokens: DetectedToken[]; total: number; loading: boolean; loadingMore: boolean;
  onRefresh: () => void; onLoadMore: () => void;
  onSnipe: (t: DetectedToken) => void; onOpen: (t: DetectedToken) => void;
  minLiq: number; setMinLiq: (n: number) => void;
  feedChain: string; setFeedChain: (c: string) => void;
  sort: 'new' | 'volume' | 'liquidity' | 'mcap'; setSort: (s: 'new' | 'volume' | 'liquidity' | 'mcap') => void;
  excludeHoneypots: boolean; setExcludeHoneypots: (b: boolean) => void;
  socialOnly: boolean; setSocialOnly: (b: boolean) => void;
  ogMode: boolean; setOgMode: (b: boolean) => void;
  sourceFilter: string[]; setSourceFilter: (s: string[]) => void;
  query: string; setQuery: (s: string) => void;
  soundEnabled: boolean; soundVolume: number;
  onToggleSound: () => void; onSetSoundVolume: (v: number) => void;
}) {
  // When the chain changes, drop launchpad selections that don't belong to it
  // so a stale Solana pad never silently empties an EVM feed.
  const onChainChange = (c: string) => {
    setFeedChain(c);
    if (sourceFilter.length) {
      const valid = LAUNCHPADS.filter((l) => c === 'all' || l.chains.includes(c)).map((l) => l.id);
      setSourceFilter(sourceFilter.filter((s) => valid.includes(s)));
    }
  };

  const hasMore = tokens.length < total;

  return (
    <div>
      <div className="nl-glass rounded-2xl p-3.5 mb-3 space-y-3">
        {/* Search + refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2 flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 min-w-0">
            <Search className="w-4 h-4 text-white/40 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, symbol or paste contract address…"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-white/40 min-w-0"
            />
          </div>
          <div className="flex items-center gap-2">
            <SelectMenu
              value={sort}
              options={SORT_OPTIONS.map((s): SelectOption => ({ id: s.id, label: `Sort: ${s.label}` }))}
              onChange={(id) => setSort(id as 'new' | 'volume' | 'liquidity' | 'mcap')}
            />
            <FeedSoundToggle
              enabled={soundEnabled}
              volume={soundVolume}
              onToggle={onToggleSound}
              onVolume={onSetSoundVolume}
            />
            <button onClick={onRefresh} className="nl-button nl-button--ghost shrink-0 px-3 py-2 rounded-lg text-xs font-semibold">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Chain pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 py-0.5">
          {FEED_CHAINS.map((c) => (
            <button
              key={c.id}
              onClick={() => onChainChange(c.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition ${
                feedChain === c.id ? 'bg-[#0066FF]/20 border-[#0066FF]/50 text-blue-200' : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {c.id !== 'all' && <ChainLogo chain={c.id} size={13} />}
              {c.label}
            </button>
          ))}
        </div>

        {/* Source / launchpad chips */}
        <SourceFilterRow chain={feedChain} selected={sourceFilter} onChange={setSourceFilter} />

        {/* Audit toggles + min-liq presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setExcludeHoneypots(!excludeHoneypots)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
              excludeHoneypots ? 'bg-emerald-500/15 border-emerald-500/45 text-emerald-200' : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> Exclude honeypots
          </button>
          <button
            onClick={() => setSocialOnly(!socialOnly)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
              socialOnly ? 'bg-[#0066FF]/20 border-[#0066FF]/50 text-blue-200' : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
            }`}
          >
            1+ social
          </button>
          <button
            onClick={() => setOgMode(!ogMode)}
            title="OG — first token we've seen for this ticker (first seen on Naka, not first ever)"
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition ${
              ogMode ? 'bg-amber-500/15 border-amber-500/45 text-amber-200' : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
            }`}
          >
            OG
          </button>
          <span className="w-px h-4 bg-white/10 mx-1" />
          <span className="text-[10px] uppercase tracking-wider text-white/40 font-semibold me-1">Min Liq</span>
          {LIQ_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => setMinLiq(p.value)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                minLiq === p.value ? 'bg-[#0066FF]/20 border border-[#0066FF]/50 text-blue-200' : 'bg-white/[0.04] border border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60">
          <Radar className="w-3.5 h-3.5 text-blue-300" />
          {loading ? 'Scanning…' : `${total.toLocaleString()} token${total === 1 ? '' : 's'}`}
        </span>
        <span className="text-[11px] text-white/40">Live · refreshes every 20s</span>
      </div>

      {loading ? (
        <div className="nl-glass rounded-2xl p-12 text-center"><Loader2 className="w-6 h-6 mx-auto animate-spin text-blue-400" /></div>
      ) : tokens.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-white/10 p-12 text-center text-white/50 text-sm">
          No fresh pairs match these filters right now.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tokens.map((t) => <TokenCard key={t.id} t={t} onSnipe={onSnipe} onOpen={onOpen} />)}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={onLoadMore}
                disabled={loadingMore}
                className="nl-button nl-button--ghost px-5 py-2.5 rounded-xl text-sm font-semibold"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loadingMore ? 'Loading…' : `Load more (${(total - tokens.length).toLocaleString()} left)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Positions (aggregated from real executions) ─────────────────────────────

/** Cache key for a live mark: chain + canonical token address. */
function markKey(chain: string, address: string): string {
  return `${chain}:${normalizeAddress(address) ?? address}`;
}

function PositionsTab({ executions }: { executions: ExecutionRow[] }) {
  // Only confirmed buys are real positions. Open = not yet realized; Realized =
  // sold (carries pnl_usd from the sell-confirm / receipt-reconciliation).
  const confirmed = useMemo(
    () => executions.filter((e) => e.status === 'confirmed' || e.status === 'sniped' || e.realized_at),
    [executions],
  );
  const open = useMemo(
    () => confirmed.filter((e) => !e.realized_at).sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()),
    [confirmed],
  );
  const realized = useMemo(
    () => confirmed.filter((e) => !!e.realized_at).sort((a, b) => new Date(b.realized_at!).getTime() - new Date(a.realized_at!).getTime()),
    [confirmed],
  );

  // Live marks for open positions from the real ingested feed
  // (sniper_feed_tokens — RLS grants authenticated SELECT). A token that has
  // aged out of the ingest window simply has no mark; shown honestly as
  // "no live mark", never a fabricated price.
  const [marks, setMarks] = useState<Map<string, number>>(() => new Map());
  const openAddrsKey = useMemo(
    () => Array.from(new Set(open.map((e) => e.token_address))).sort().join(','),
    [open],
  );
  useEffect(() => {
    if (!openAddrsKey) { setMarks(new Map()); return; }
    let alive = true;
    // Query both the stored form and the canonical form — the feed ingests
    // lowercase EVM addresses while executions may carry checksummed input.
    const addrs = Array.from(new Set(openAddrsKey.split(',').flatMap((a) => {
      const n = normalizeAddress(a);
      return n && n !== a ? [a, n] : [a];
    })));
    const load = async () => {
      const { data } = await supabase
        .from('sniper_feed_tokens')
        .select('chain, token_address, price_usd')
        .in('token_address', addrs);
      if (!alive || !data) return;
      const next = new Map<string, number>();
      for (const r of data as { chain: string; token_address: string; price_usd: number | null }[]) {
        if (r.price_usd != null) next.set(markKey(r.chain, r.token_address), Number(r.price_usd));
      }
      setMarks(next);
    };
    void load();
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => { alive = false; window.clearInterval(id); };
  }, [openAddrsKey]);

  // Aggregate open exposure — only positions with a live mark contribute to
  // value/unrealized, and the strip says how many are priced.
  const openStats = useMemo(() => {
    let invested = 0, value = 0, priced = 0, unrealized = 0;
    for (const e of open) {
      const spent = Number(e.buy_amount_usd ?? 0) || 0;
      invested += spent;
      const mark = e.chain ? marks.get(markKey(e.chain, e.token_address)) : undefined;
      if (mark != null && e.tokens_received != null) {
        const v = Number(e.tokens_received) * mark;
        value += v;
        priced++;
        if (spent > 0) unrealized += v - spent;
      }
    }
    return { invested, value, priced, unrealized };
  }, [open, marks]);

  if (open.length === 0 && realized.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-dashed border-white/10 p-12 text-center">
          <TrendingUp className="w-10 h-10 mx-auto mb-3 text-white/25" />
          <h3 className="text-base font-bold mb-1">No positions yet</h3>
          <p className="text-white/50 text-sm">Positions appear here once your snipers fill. Open positions show live value from the feed; realized PnL updates after exits.</p>
        </div>
        <AutosellStatusCard />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {open.length > 0 && (
        <div className="nl-glass rounded-xl p-3 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Field label="Open positions">{open.length}</Field>
          <Field label="Invested">{openStats.invested > 0 ? fmtUSD(openStats.invested).replace('+', '') : '—'}</Field>
          <Field label={`Live value${openStats.priced < open.length ? ` (${openStats.priced}/${open.length} priced)` : ''}`}>
            {openStats.priced > 0 ? fmtUSD(openStats.value).replace('+', '') : '—'}
          </Field>
          <Field label="Unrealized PnL">
            <span className={openStats.priced === 0 ? 'text-white/60' : openStats.unrealized >= 0 ? 'text-emerald-300' : 'text-red-300'}>
              {openStats.priced > 0 ? fmtUSD(openStats.unrealized) : '—'}
            </span>
          </Field>
        </div>
      )}
      {open.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">Open · {open.length}</div>
          <div className="grid gap-2">
            {open.map((e) => (
              <PositionRow key={e.id} e={e} mark={e.chain ? marks.get(markKey(e.chain, e.token_address)) ?? null : null} />
            ))}
          </div>
        </div>
      )}
      {realized.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">Realized · {realized.length}</div>
          <div className="grid gap-2">{realized.map((e) => <PositionRow key={e.id} e={e} mark={null} realized />)}</div>
        </div>
      )}
      <AutosellStatusCard />
    </div>
  );
}

function PositionRow({ e, mark, realized }: { e: ExecutionRow; mark: number | null; realized?: boolean }) {
  const cfg = e.chain ? CHAIN_CONFIGS[e.chain as SniperChain] : null;
  const spent = Number(e.buy_amount_usd ?? 0) || 0;
  const pnl = e.pnl_usd != null ? Number(e.pnl_usd) : null;
  // Live value / unrealized PnL — only when the feed still carries a real mark
  // and we know the token quantity. Otherwise shown honestly as unavailable.
  const liveValue = !realized && mark != null && e.tokens_received != null ? Number(e.tokens_received) * mark : null;
  const uPnl = liveValue != null && spent > 0 ? liveValue - spent : null;
  return (
    <div className="nl-glass rounded-xl p-3 flex items-center gap-3">
      {cfg ? <img src={cfg.logo} alt="" className="w-9 h-9 rounded-full shrink-0" /> : <div className="w-9 h-9 rounded-full bg-white/10 shrink-0 flex items-center justify-center text-[10px] font-bold text-white/60">{(e.token_symbol ?? '?').slice(0, 2)}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-bold truncate">{e.token_symbol ?? e.token_address.slice(0, 6)}</span>
          {e.chain && <span className="text-[10px] uppercase tracking-wider text-white/40">{e.chain}</span>}
          {!realized && <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">Open</span>}
        </div>
        <div className="text-[11px] text-white/50 truncate">
          {spent > 0 ? `Spent ${fmtUSD(spent).replace('+', '')}` : ''}{e.entry_price_usd ? ` · entry $${Number(e.entry_price_usd).toPrecision(3)}` : ''}{!realized && mark != null ? ` · now $${mark.toPrecision(3)}` : ''} · {timeAgo(realized ? (e.realized_at ?? e.executed_at) : e.executed_at)}
        </div>
      </div>
      {realized ? (
        <div className={`text-right shrink-0 font-bold ${pnl != null && pnl > 0 ? 'text-emerald-300' : pnl != null && pnl < 0 ? 'text-red-300' : 'text-white/60'}`}>
          <div className="text-sm">{pnl != null ? fmtUSD(pnl) : '—'}</div>
          <div className="text-[10px] font-medium text-white/40">{pnl != null && spent > 0 ? `${((pnl / spent) * 100).toFixed(1)}%` : 'settling…'}</div>
        </div>
      ) : uPnl != null ? (
        <div className={`text-right shrink-0 font-bold ${uPnl >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
          <div className="text-sm">{fmtUSD(uPnl)}</div>
          <div className="text-[10px] font-medium text-white/40">{spent > 0 ? `${((uPnl / spent) * 100).toFixed(1)}% unrealized` : 'unrealized'}</div>
        </div>
      ) : liveValue != null ? (
        <div className="text-right shrink-0">
          <div className="text-sm font-bold text-white/85">{fmtUSD(liveValue).replace('+', '')}</div>
          <div className="text-[10px] font-medium text-white/40">live value</div>
        </div>
      ) : (
        <span className="shrink-0 text-[10px] text-white/40">no live mark</span>
      )}
    </div>
  );
}

// ─── Snipers (config cards) ─────────────────────────────────────────────────

type SniperStatusFilter = 'all' | 'active' | 'paused' | 'disabled';
function sniperStatusOf(s: SniperCriteriaRow): 'active' | 'paused' | 'disabled' {
  return !s.enabled ? 'disabled' : s.paused ? 'paused' : 'active';
}

/** Presentation for a matcher decision value. */
function decisionMeta(decision: string): { label: string; cls: string } {
  switch (decision) {
    case 'sniped_executed':
      return { label: 'Executed', cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' };
    case 'sniped_pending':
      return { label: 'Queued', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/30' };
    case 'matched':
      return { label: 'Alerted', cls: 'text-blue-200 bg-[#0066FF]/15 border-[#0066FF]/30' };
    default:
      return { label: decision.replace(/_/g, ' '), cls: 'text-white/60 bg-white/5 border-white/10' };
  }
}

/**
 * Matcher decision trail — real sniper_match_events rows for the caller
 * (via /api/sniper/executions). Shows why each rule fired: alerted, queued
 * for auto-execute, or executed — the layer between "rule exists" and
 * "execution landed" that was previously invisible.
 */
function MatchActivity() {
  const [events, setEvents] = useState<MatchEventRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch('/api/sniper/executions?limit=30', { cache: 'no-store' });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const j = await res.json();
        if (alive) { setEvents(Array.isArray(j?.events) ? j.events : []); setError(false); }
      } catch {
        if (alive) { setError(true); setEvents((prev) => prev ?? []); }
      }
    };
    void load();
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  return (
    <div className="mt-5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-2">
        <Radar className="w-3.5 h-3.5" /> Match Activity
      </div>
      {events === null ? (
        <div className="nl-glass rounded-xl p-6 text-center"><Loader2 className="w-4 h-4 mx-auto animate-spin text-blue-400" /></div>
      ) : error && events.length === 0 ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-xs text-red-300">Couldn&apos;t load match activity.</div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-white/10 p-6 text-center text-white/50 text-xs">
          No matches yet. When a live token passes one of your rules, the matcher&apos;s decision (alert, queue, execute) appears here.
        </div>
      ) : (
        <div className="nl-glass rounded-xl p-2 space-y-1">
          {events.map((ev) => {
            const meta = decisionMeta(ev.decision);
            const symbol = ev.details?.token_symbol;
            const amount = typeof ev.details?.amount_usd === 'number' ? ev.details.amount_usd : null;
            return (
              <div key={ev.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03]">
                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border shrink-0 ${meta.cls}`}>{meta.label}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">
                    {symbol ?? `${ev.matched_token_address.slice(0, 6)}…${ev.matched_token_address.slice(-4)}`}
                    {ev.matched_chain && <span className="ms-1.5 text-[10px] uppercase tracking-wider text-white/40 font-medium">{ev.matched_chain}</span>}
                  </div>
                  {ev.trigger_reason && <div className="text-[10px] text-white/45 truncate">{ev.trigger_reason.replace(/_/g, ' ')}</div>}
                </div>
                {amount != null && <span className="shrink-0 text-[11px] font-semibold text-white/70">${amount.toFixed(0)}</span>}
                <span className="shrink-0 text-[10px] text-white/40">{timeAgo(ev.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SnipersTab({ snipers, onPause, onDelete, onCreate }: { snipers: SniperCriteriaRow[]; onPause: (s: SniperCriteriaRow) => void; onDelete: (s: SniperCriteriaRow) => void; onCreate: () => void }) {
  const [status, setStatus] = useState<SniperStatusFilter>('all');
  if (snipers.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] p-12 text-center">
        <Crosshair className="w-12 h-12 mx-auto mb-3 text-white/30" />
        <h3 className="text-lg font-bold mb-1">No active snipers yet</h3>
        <p className="text-white/50 text-sm mb-5">Create your first sniper to auto-execute on new launches, whale moves, or price targets.</p>
        <button onClick={onCreate} className="nl-btn-neon px-5 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2"><Plus className="w-4 h-4" /> Create Sniper</button>
      </div>
    );
  }
  const counts = {
    all: snipers.length,
    active: snipers.filter((s) => sniperStatusOf(s) === 'active').length,
    paused: snipers.filter((s) => sniperStatusOf(s) === 'paused').length,
    disabled: snipers.filter((s) => sniperStatusOf(s) === 'disabled').length,
  };
  const shown = status === 'all' ? snipers : snipers.filter((s) => sniperStatusOf(s) === status);
  const FILTERS: { id: SniperStatusFilter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'active', label: 'Active' }, { id: 'paused', label: 'Paused' }, { id: 'disabled', label: 'Disabled' },
  ];
  return (
    <div>
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 mb-3">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${status === f.id ? 'bg-[#0066FF]/20 text-blue-200 border border-[#0066FF]/40' : 'text-white/55 hover:text-white border border-transparent'}`}
          >
            {f.label} <span className={`ms-1 px-1.5 py-0.5 rounded text-[10px] ${status === f.id ? 'bg-blue-500/30 text-blue-100' : 'bg-white/10 text-white/55'}`}>{counts[f.id]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-white/10 p-10 text-center text-white/50 text-sm">No {status} snipers.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">{shown.map((s) => <SniperCard key={s.id} s={s} onPause={onPause} onDelete={onDelete} />)}</div>
      )}
      <MatchActivity />
    </div>
  );
}

function SniperCard({ s, onPause, onDelete }: { s: SniperCriteriaRow; onPause: (s: SniperCriteriaRow) => void; onDelete: (s: SniperCriteriaRow) => void }) {
  const status = !s.enabled ? 'disabled' : s.paused ? 'paused' : 'active';
  const statusColor = status === 'active' ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
    : status === 'paused' ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
    : 'text-white/50 bg-white/5 border-white/10';
  return (
    <div className="nl-glass rounded-xl p-4 hover:-translate-y-px transition group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-base font-bold truncate">{s.name}</h3>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${statusColor}`}>{status}</span>
            {s.auto_execute && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-blue-500/30 bg-blue-500/15 text-blue-300">Auto</span>}
            {s.mev_protect && <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-purple-500/30 bg-purple-500/15 text-purple-300">MEV</span>}
          </div>
          <div className="flex items-center gap-1.5 mb-3">
            {s.chains_allowed.map((c) => {
              const cfg = CHAIN_CONFIGS[c as SniperChain];
              return cfg ? <img key={c} src={cfg.logo} alt={cfg.symbol} title={cfg.name} className="w-5 h-5 rounded-full" /> : null;
            })}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Per snipe">${s.amount_per_snipe_usd?.toFixed(0) ?? '—'}</Field>
            <Field label="Daily cap">${s.daily_max_spend_usd?.toFixed(0) ?? '—'} · {s.daily_max_snipes ?? '—'} max</Field>
            <Field label="Slippage">{(s.max_slippage_bps / 100).toFixed(1)}%</Field>
            <Field label="TP / SL">{s.take_profit_pct ? `+${s.take_profit_pct}%` : '—'} / {s.stop_loss_pct ? `-${s.stop_loss_pct}%` : '—'}</Field>
          </div>
          {(s.launchpads_allowed?.length ?? 0) > 0 && (
            <div className="mt-3 flex items-center gap-1 flex-wrap">
              <span className="text-[9px] uppercase tracking-wider text-white/40 font-semibold me-0.5">Pads</span>
              {s.launchpads_allowed!.map((lp) => (
                <span key={lp} className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-white/[0.05] border border-white/10 text-white/60">{lp}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={() => onPause(s)} title={s.paused ? 'Resume' : 'Pause'} className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] transition">
            {s.paused ? <Play className="w-4 h-4 text-emerald-300" /> : <Pause className="w-4 h-4 text-amber-300" />}
          </button>
          <button onClick={() => onDelete(s)} title="Delete" className="p-2 rounded-lg bg-white/[0.05] hover:bg-red-500/20 hover:text-red-300 transition"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-0.5">{label}</div>
      <div className="text-white/90 font-medium">{children}</div>
    </div>
  );
}

// ─── History ────────────────────────────────────────────────────────────────

function HistoryTab({ executions, chainFilter, freshIds }: { executions: ExecutionRow[]; chainFilter: SniperChain | 'all'; freshIds: Set<string> }) {
  const visible = chainFilter === 'all' ? executions : executions.filter((e) => e.chain === chainFilter);
  if (visible.length === 0) {
    return <div className="rounded-xl border-2 border-dashed border-white/10 p-12 text-center text-white/50 text-sm">No executions yet on this chain.</div>;
  }
  return (
    <div className="nl-glass rounded-xl overflow-hidden">
      <style>{`@keyframes nakaFresh{0%{background:rgba(0,102,255,.22)}100%{background:transparent}}.naka-fresh-row{animation:nakaFresh 2.4s ease-out}`}</style>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-white/40 bg-white/[0.03]">
              <th className="px-4 py-3 font-semibold">Token</th>
              <th className="px-4 py-3 font-semibold">Chain</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">PnL</th>
              <th className="px-4 py-3 font-semibold">Speed</th>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Tx</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => {
              const cfg = e.chain ? CHAIN_CONFIGS[e.chain as SniperChain] : null;
              const pnl = e.pnl_usd != null ? Number(e.pnl_usd) : null;
              const isFresh = freshIds.has(e.id);
              return (
                <tr key={e.id} className={`border-t border-white/5 hover:bg-white/[0.02] ${isFresh ? 'naka-fresh-row' : ''}`}>
                  <td className="px-4 py-3 font-medium">{e.token_symbol ?? '—'}</td>
                  <td className="px-4 py-3">{cfg ? <span className="inline-flex items-center gap-1.5"><img src={cfg.logo} alt="" className="w-4 h-4 rounded-full" /> {cfg.symbol}</span> : (e.chain ?? '—')}</td>
                  <td className="px-4 py-3 text-white/80 whitespace-nowrap">
                    {e.buy_amount_usd != null
                      ? fmtUSD(Number(e.buy_amount_usd)).replace('+', '')
                      : e.amount_native != null
                        ? `${e.amount_native} ${cfg?.symbol ?? ''}`.trim()
                        : e.amount_sol != null
                          ? `${e.amount_sol} SOL`
                          : '—'}
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold uppercase tracking-wider ${e.status === 'confirmed' ? 'text-emerald-300' : e.status === 'failed' ? 'text-red-300' : 'text-amber-300'}`}>{e.status}</span></td>
                  <td className={`px-4 py-3 font-bold ${pnl != null && pnl > 0 ? 'text-emerald-300' : pnl != null && pnl < 0 ? 'text-red-300' : 'text-white/60'}`}>{pnl != null ? fmtUSD(pnl) : '—'}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{e.execution_time_ms ? `${e.execution_time_ms}ms` : '—'}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{timeAgo(e.executed_at)}</td>
                  <td className="px-4 py-3">
                    {e.tx_hash && cfg ? (
                      <a href={`${cfg.explorerTxBase}${e.tx_hash}`} target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 inline-flex items-center gap-1 text-xs font-medium">View <ExternalLink className="w-3 h-3" /></a>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
