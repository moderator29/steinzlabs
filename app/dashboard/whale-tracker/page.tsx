"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useFeatureUsageLog } from "@/lib/hooks/useFeatureUsageLog";
import { LABEL_META, canonicalAction, type WhaleLabel } from "@/lib/whales/labels";
import { addressesEqual } from "@/lib/utils/addressNormalize";
// Naka Labs brand icons — swap what's in the library, lucide-fallback
// for icons not yet available (BellOff, ArrowUpRight, ArrowDownLeft,
// ArrowLeftRight, Telescope) — they remain visually consistent with the
// other lucide icons elsewhere on the page until a follow-up wave adds them.
import {
  Search, Plus, Bell, Trash2, ChevronRight, X,
} from "@/components/icons/brand";
import {
  Loader2,
  BellOff,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Telescope,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BackButton } from "@/components/ui/BackButton";
import { HowItWorksButton } from "@/components/common/HowItWorks";
import { whaleTrackerHowItWorks } from "@/lib/howItWorks/content/whale-tracker";
import { ChainLogo } from "@/components/common/ChainLogo";
import { NakaLoader } from "@/components/brand/NakaLoader";
import { WhaleAvatar } from "@/components/whales/WhaleAvatar";
import LiveTradersGrid from "@/components/whales/LiveTradersGrid";
import TierGateOverlay from "@/components/tier/TierGateOverlay";
import { useAuth, hasTierAccess } from "@/lib/hooks/useAuth";
import { useNavState } from "@/lib/nav/useNavState";

type Action = "buy" | "sell" | "transfer" | null;
type Size = "10k" | "50k" | "100k" | "500k" | "1m";
type TimeRange = "1h" | "6h" | "24h" | "7d";

interface FeedRow {
  id: string;
  whale_address: string;
  chain: string;
  action: string;
  token_address: string | null;
  token_symbol: string | null;
  value_usd: number | null;
  tx_hash: string;
  timestamp: string;
  label: string | null;
  entity_type: string | null;
  // Resolved WhaleLabel (cex/smart_money/insider/...) bridged from the
  // whales.entity_type vocabulary, so the colored label pill renders.
  whale_label: WhaleLabel;
  // Transfer direction from the raw action ('in' received / 'out' sent); null
  // for real buy/sell rows. Lets the card show Received/Sent instead of a flat
  // "transfer" now that the poll ingests both sides.
  direction?: "in" | "out" | null;
  // §whale-tracker-grade — surfaced from whales table so feed cards
  // can render Accumulator / Distributor / Sniper / High-win-rate
  // badges without an extra round-trip.
  pnl_30d_usd?: number | null;
  win_rate?: number | null;
  avg_hold_hours?: number | null;
}

interface WatchlistItem {
  whale_address: string;
  chain: string;
  label: string | null;
  alert_enabled: boolean;
  alert_threshold_usd: number | null;
  alert_channels: string[] | null;
  created_at: string;
}

interface TopWhale {
  whale_address: string;
  chain: string;
  volume_usd: number;
  move_count: number;
  label: string | null;
  entity_type: string | null;
}

const CHAIN_PILLS: Array<{ id: string; label: string }> = [
  { id: "all", label: "All" },
  { id: "ethereum", label: "ETH" },
  { id: "solana", label: "SOL" },
  { id: "base", label: "Base" },
  { id: "arbitrum", label: "ARB" },
  { id: "bsc", label: "BSC" },
];

const SIZE_PILLS: Size[] = ["10k", "50k", "100k", "500k", "1m"];
const TIME_PILLS: TimeRange[] = ["1h", "6h", "24h", "7d"];

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function short(addr: string): string {
  return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86_400)}d ago`;
}

export default function WhaleTrackerPage() {
  useFeatureUsageLog('whale_tracker');
  const router = useRouter();
  // Tier split: VIEWING the feed/top-today needs `mini`; FOLLOWING (watchlist,
  // alerts) needs `pro`. Resolve both client-side so we render an honest gate
  // instead of leaving watch/add controls live that 403 silently for mini
  // users (the audit's "dead controls" bug). Server-side withTierGate stays
  // authoritative — this is UX, not the security boundary.
  const { user, loading: authLoading } = useAuth();
  const canView = hasTierAccess(user, 'mini');
  const canFollow = hasTierAccess(user, 'pro');
  const goUpgrade = useCallback(() => router.push('/dashboard/pricing'), [router]);
  const [selectedChains, setSelectedChains] = useState<string[]>(["all"]);
  // Primary view: ranked active TRADERS (default — what the live feed is for) vs
  // the raw ACTIVITY tape. Traders = copy-tradeable wallets by 7d DEX volume.
  const [feedView, setFeedView] = useState<'traders' | 'activity'>('traders');
  // Default to 50k, not 100k: at 100k the first-load feed was a trickle
  // (most real whale moves + freshly-priced rows sit below $100k), which
  // read as "tracker shows nothing". 50k still filters to genuine size.
  const [size, setSize] = useState<Size>("50k");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [actionFilter, setActionFilter] = useState<Action>(null);
  const [tokenSearch, setTokenSearch] = useState("");
  // Audit B5 / P1 #25 — Smart Money / CEX / Bot label-pill filter.
  // Empty array = no label filter (default Nansen / Arkham behaviour).
  const [labelFilter, setLabelFilter] = useState<WhaleLabel[]>([]);
  // Audit B5 / P0 #6 — realtime new-row indicator. We subscribe to
  // Supabase realtime on whale_activity INSERTs and bump this counter
  // when a row arrives that *would* match the current filters but
  // hasn't yet been re-fetched into `feed`. The poll-on-tick still
  // runs but realtime gives sub-second visibility into NEW activity
  // instead of waiting up to 15 seconds for the next interval.
  const [newRowsAvailable, setNewRowsAvailable] = useState(0);
  const filtersRef = useRef({ size, timeRange, actionFilter, tokenSearch, selectedChains, labelFilter });
  filtersRef.current = { size, timeRange, actionFilter, tokenSearch, selectedChains, labelFilter };

  // PDF S3 — preserve filter + scroll across whale → profile → back so
  // the user lands in the same view they left. sessionStorage-backed
  // via lib/nav/useNavState.
  useNavState(
    "whale-tracker",
    () => ({ size, timeRange, actionFilter, tokenSearch, selectedChains, labelFilter }),
    (s) => {
      if (s.size) setSize(s.size as Size);
      if (s.timeRange) setTimeRange(s.timeRange as TimeRange);
      if (s.actionFilter !== undefined) setActionFilter(s.actionFilter as Action);
      if (typeof s.tokenSearch === "string") setTokenSearch(s.tokenSearch);
      if (Array.isArray(s.selectedChains)) setSelectedChains(s.selectedChains as string[]);
      if (Array.isArray(s.labelFilter)) setLabelFilter(s.labelFilter as WhaleLabel[]);
    },
  );
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedTotal, setFeedTotal] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [topToday, setTopToday] = useState<TopWhale[]>([]);

  const activeChainParam = useMemo(
    () => (selectedChains.includes("all") ? "" : selectedChains.join(",")),
    [selectedChains],
  );

  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError(null);
    setNewRowsAvailable(0);
    try {
      const params = new URLSearchParams({ size, time: timeRange, limit: "100" });
      if (activeChainParam) params.set("chains", activeChainParam);
      if (actionFilter) params.set("action", actionFilter);
      if (tokenSearch.trim()) params.set("token", tokenSearch.trim());
      if (labelFilter.length > 0) params.set("labels", labelFilter.join(","));
      // 10s ceiling so a cold-start Redis miss never leaves the tracker spinning.
      const res = await fetch(`/api/whale-tracker/feed?${params}`, {
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      });
      if (res.status === 402 || res.status === 403) {
        throw new Error("Whale Tracker is a paid feature. Upgrade to Pro or higher to unlock live whale flow.");
      }
      if (!res.ok) throw new Error(`Feed ${res.status}`);
      const data = (await res.json()) as { rows: FeedRow[]; total: number };
      setFeed(data.rows ?? []);
      setFeedTotal(data.total ?? 0);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Feed failed");
    } finally {
      setFeedLoading(false);
    }
  }, [size, timeRange, activeChainParam, actionFilter, tokenSearch, labelFilter]);

  const loadWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/whale-tracker/watchlist", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { watchlist: WatchlistItem[] };
      setWatchlist(data.watchlist ?? []);
    } catch {
      /* silent */
    }
  }, []);

  const loadTopToday = useCallback(async () => {
    try {
      const res = await fetch("/api/whale-tracker/top-today");
      if (!res.ok) return;
      const data = (await res.json()) as { whales: TopWhale[] };
      setTopToday(data.whales ?? []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    if (authLoading || !canView) return;
    void loadFeed();
  }, [loadFeed, authLoading, canView]);

  useEffect(() => {
    if (authLoading || !canView) return;
    // Watchlist is pro-gated; only fetch it when the user can actually follow,
    // otherwise it 403s and the panel shows an upgrade CTA instead.
    if (canFollow) void loadWatchlist();
    void loadTopToday();
  }, [loadWatchlist, loadTopToday, authLoading, canView, canFollow]);

  // Audit B5 / P0 #6 — realtime first, polling as safety net.
  // Supabase Realtime emits whale_activity INSERTs sub-second; we count
  // matches against the active filters and surface a "N new whales —
  // refresh" pill so the user can pull them in without their reading
  // position getting yanked. Falling back to a 30s poll catches missed
  // events (Realtime occasionally drops on reconnect) and keeps the
  // value_usd freshness honest after enrichment crons run.
  useEffect(() => {
    if (!supabase || authLoading || !canView) return;
    const channel = supabase
      .channel('whale-tracker-live')
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'whale_activity' },
          (payload) => {
            const row = payload.new as { value_usd?: number; chain?: string; action?: string; token_symbol?: string };
            const f = filtersRef.current;
            const minUsd = ({ '10k': 10_000, '50k': 50_000, '100k': 100_000, '500k': 500_000, '1m': 1_000_000 } as Record<string, number>)[f.size] ?? 100_000;
            if ((row.value_usd ?? 0) < minUsd) return;
            // row.action is the RAW db action (transfer_in/out/buy/sell); the
            // filter is canonical (buy|sell|transfer) — normalize before compare
            // so the indicator doesn't drop every transfer.
            if (f.actionFilter && canonicalAction(row.action) !== f.actionFilter) return;
            if (f.selectedChains.length > 0 && !f.selectedChains.includes('all') && row.chain && !f.selectedChains.includes(row.chain)) return;
            if (f.tokenSearch && row.token_symbol && !row.token_symbol.toLowerCase().includes(f.tokenSearch.toLowerCase())) return;
            // Label filter not applied here — we don't have entity_type
            // on the raw INSERT row; the next refresh pulls it from the
            // enriched feed endpoint. Indicator slightly over-counts but
            // never misses, which is the safer direction.
            setNewRowsAvailable((n) => n + 1);
          })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [authLoading, canView]);

  // Polling safety net — drops to 30s now that realtime is the
  // primary path. Pre-fix this was the only freshness mechanism at 15s.
  useEffect(() => {
    if (authLoading || !canView) return;
    const t = setInterval(() => void loadFeed(), 30_000);
    return () => clearInterval(t);
  }, [loadFeed, authLoading, canView]);

  const toggleChain = (id: string) => {
    setSelectedChains((prev) => {
      if (id === "all") return ["all"];
      const without = prev.filter((p) => p !== "all");
      if (without.includes(id)) {
        const next = without.filter((p) => p !== id);
        return next.length === 0 ? ["all"] : next;
      }
      return [...without, id];
    });
  };

  const isWatched = (address: string, chain: string) =>
    watchlist.some(
      // Chain-aware comparison: EVM is case-insensitive, Solana is
      // case-sensitive. A raw .toLowerCase() collapsed distinct Solana
      // addresses and lit the bell for the wrong whale.
      (w) => w.chain === chain && addressesEqual(w.whale_address, address, chain),
    );

  const toggleWatch = async (address: string, chain: string) => {
    // Following is pro-gated. Send mini/free users to pricing instead of
    // firing a request that 403s with no feedback.
    if (!canFollow) {
      goUpgrade();
      return;
    }
    const watched = isWatched(address, chain);
    if (watched) {
      await fetch(
        `/api/whale-tracker/watchlist?whale_address=${address}&chain=${chain}`,
        { method: "DELETE" },
      );
    } else {
      await fetch("/api/whale-tracker/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whale_address: address, chain }),
      });
    }
    await loadWatchlist();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <NakaLoader />
      </div>
    );
  }

  // Below `mini`: honest paywall instead of a feed that 403s behind live
  // controls. Blurred static preview + upgrade card (shared TierGateOverlay).
  if (!canView) {
    return (
      <div className="min-h-screen text-white pb-20">
        <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
            <BackButton href="/dashboard" compact />
            <h1 className="text-lg md:text-xl font-bold">Whale Tracker</h1>
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#0066FF]/15 text-[#6F7EFF] border border-[#0066FF]/30">
              PRO
            </span>
          </div>
        </div>
        <TierGateOverlay
          featureName="Whale Tracker"
          requiredTier="mini"
          bulletPoints={[
            "Live whale flow across Ethereum, Solana, Base, Arbitrum & BSC",
            "Smart-money, CEX, market-maker & insider labels on every move",
            "Top whales today, PnL leaderboard & behavioral archetypes",
            "Follow whales and get real-time move alerts (Pro)",
          ]}
        >
          <div className="max-w-7xl mx-auto px-4 py-6 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="nl-glass rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 rounded bg-white/[0.06] w-1/3" />
                  <div className="h-2.5 rounded bg-white/[0.04] w-2/3" />
                </div>
                <div className="h-3 rounded bg-white/[0.06] w-16" />
              </div>
            ))}
          </div>
        </TierGateOverlay>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white pb-20">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <BackButton href="/dashboard" compact />
          {/* Tab bar replaces the old "Whale Tracker / Live / PRO" cluster —
              one clean row of section tabs. Live Feed is the current page. */}
          <nav className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 min-w-0 flex-1">
            <span className="shrink-0 nl-btn-neon !px-3 !py-1.5 !text-[11px] !border-[#0066FF]/90 cursor-default">Live Feed</span>
            <Link href="/dashboard/whale-tracker/convergence" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-[#00C8FF] hover:text-white bg-[#0066FF]/10 border border-[#0066FF]/30 hover:border-[#0066FF]/50 transition-colors inline-flex items-center gap-1">Convergence <span className="text-[8px] px-1 py-0.5 rounded bg-[#0066FF]/30 text-white uppercase font-bold">New</span></Link>
            <Link href="/dashboard/whale-tracker/compare" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-[#00C8FF] hover:text-white bg-[#0066FF]/10 border border-[#0066FF]/30 hover:border-[#0066FF]/50 transition-colors inline-flex items-center gap-1">Compare <span className="text-[8px] px-1 py-0.5 rounded bg-[#0066FF]/30 text-white uppercase font-bold">New</span></Link>
            <Link href="/dashboard/whale-tracker/dna" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-[#00C8FF] hover:text-white bg-[#0066FF]/10 border border-[#0066FF]/30 hover:border-[#0066FF]/50 transition-colors inline-flex items-center gap-1">Whale DNA <span className="text-[8px] px-1 py-0.5 rounded bg-[#0066FF]/30 text-white uppercase font-bold">New</span></Link>
            <Link href="/dashboard/whale-tracker/flows" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-[#00C8FF] hover:text-white bg-[#0066FF]/10 border border-[#0066FF]/30 hover:border-[#0066FF]/50 transition-colors inline-flex items-center gap-1">Flows <span className="text-[8px] px-1 py-0.5 rounded bg-[#0066FF]/30 text-white uppercase font-bold">New</span></Link>
            <Link href="/dashboard/whale-tracker/token" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-[#00C8FF] hover:text-white bg-[#0066FF]/10 border border-[#0066FF]/30 hover:border-[#0066FF]/50 transition-colors inline-flex items-center gap-1">Token Lens <span className="text-[8px] px-1 py-0.5 rounded bg-[#0066FF]/30 text-white uppercase font-bold">New</span></Link>
            <Link href="/dashboard/whale-tracker/rotation" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-[#00C8FF] hover:text-white bg-[#0066FF]/10 border border-[#0066FF]/30 hover:border-[#0066FF]/50 transition-colors inline-flex items-center gap-1">Rotation <span className="text-[8px] px-1 py-0.5 rounded bg-[#0066FF]/30 text-white uppercase font-bold">New</span></Link>
            <Link href="/dashboard/whale-tracker/directory" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Directory</Link>
            <Link href="/dashboard/whale-tracker/watchlist" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Watchlist</Link>
            <Link href="/dashboard/whale-tracker/copy-trade" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Copy Trade</Link>
            <Link href="/dashboard/whale-tracker/submit" className="shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-lg text-slate-400 hover:text-white bg-white/[0.04] border border-white/10 hover:border-white/20 transition-colors">Submit</Link>
          </nav>
          <HowItWorksButton content={whaleTrackerHowItWorks} className="ms-auto shrink-0" />
        </div>

        {/* Filters */}
        <div className="max-w-7xl mx-auto px-4 pb-3 flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 overflow-x-auto">
            {CHAIN_PILLS.map((c) => {
              const active = selectedChains.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggleChain(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? "bg-[#0066FF]/15 text-[#6F7EFF] border border-[#0066FF]/30"
                      : "bg-slate-900/50 text-slate-400 border border-transparent hover:text-white"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
          <div className="h-5 w-px bg-slate-800 mx-1" />
          <div className="flex gap-1">
            {SIZE_PILLS.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono uppercase transition-colors ${
                  size === s
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-slate-900/50 text-slate-400 border border-transparent hover:text-white"
                }`}
              >
                ${s.toUpperCase()}+
              </button>
            ))}
          </div>
          <div className="h-5 w-px bg-slate-800 mx-1" />
          <div className="flex gap-1">
            {TIME_PILLS.map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] uppercase transition-colors ${
                  timeRange === t
                    ? "bg-slate-100/10 text-white border border-slate-700"
                    : "bg-slate-900/50 text-slate-400 border border-transparent hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={tokenSearch}
              onChange={(e) => setTokenSearch(e.target.value)}
              placeholder="Token symbol…"
              className="w-full ps-8 pe-3 py-1.5 rounded-lg nl-glass text-xs focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <select
            value={actionFilter ?? ""}
            onChange={(e) => setActionFilter((e.target.value || null) as Action)}
            className="px-2 py-1.5 rounded-lg nl-glass text-xs"
          >
            <option value="">All actions</option>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>
      </div>

      {/* Body grid */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          {/* View toggle — Traders (ranked active wallets, the default) vs the
              raw Activity tape. */}
          <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-white/10 mb-3">
            {(['traders', 'activity'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setFeedView(v)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-colors ${
                  feedView === v ? 'bg-[#0066FF]/20 text-[#8FA3FF]' : 'text-slate-400 hover:text-white'
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          {feedView === 'traders' && (
            <LiveTradersGrid chain={selectedChains.includes('all') ? undefined : selectedChains[0]} />
          )}

          {feedView === 'activity' && (<>
          {/* Smart Money / CEX / Bot label filter — relocated out of the
              header into the feed column. Small rectangular containers
              (rounded-md, no glass) per brand direction. */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 me-1">Labels</span>
            {(['smart_money', 'cex', 'mm', 'bot', 'insider', 'bridge'] as WhaleLabel[]).map((lbl) => {
              const active = labelFilter.includes(lbl);
              const meta = LABEL_META[lbl];
              return (
                <button
                  key={lbl}
                  onClick={() => setLabelFilter((prev) => active ? prev.filter((l) => l !== lbl) : [...prev, lbl])}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors ${
                    active ? 'text-white' : 'text-slate-400 bg-slate-900/40 border-slate-800 hover:text-white'
                  }`}
                  style={active ? { backgroundColor: `${meta.color}20`, borderColor: `${meta.color}55`, color: meta.color } : undefined}
                  title={meta.tooltip}
                  aria-pressed={active}
                >
                  {meta.short}
                </button>
              );
            })}
            {labelFilter.length > 0 && (
              <button
                onClick={() => setLabelFilter([])}
                className="px-2 py-1 rounded-md text-[10px] font-semibold text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-slate-500">
              Live whale feed · {feedTotal.toLocaleString()} matches
            </div>
            {newRowsAvailable > 0 && (
              <button
                type="button"
                onClick={() => void loadFeed()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
                aria-label="Load new whale activity"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {newRowsAvailable} new {newRowsAvailable === 1 ? 'whale' : 'whales'} · refresh
              </button>
            )}
          </div>
          {feedLoading && feed.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3 flex items-center gap-3 animate-pulse"
                >
                  <div className="w-8 h-8 rounded-full bg-white/[0.06] flex-shrink-0" />
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="h-3 rounded bg-white/[0.06] w-1/3" />
                    <div className="h-2.5 rounded bg-white/[0.04] w-2/3" />
                  </div>
                  <div className="h-3 rounded bg-white/[0.06] w-16 flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : feedError ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-300 flex items-center justify-between">
              <span>Feed failed: {feedError}</span>
              <button
                type="button"
                onClick={() => void loadFeed()}
                className="text-xs px-3 py-1 rounded border border-rose-500/40 hover:bg-rose-500/10"
              >
                Retry
              </button>
            </div>
          ) : feed.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500">
              No whale activity matches these filters yet.
              <br />
              <span className="text-xs text-slate-600">
                The background poll populates this feed every minute.
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {feed.map((row) => (
                  <FeedCard
                    key={row.id}
                    row={row}
                    watched={isWatched(row.whale_address, row.chain)}
                    canCopy={canFollow}
                    onToggleWatch={() => toggleWatch(row.whale_address, row.chain)}
                    onOpenWhale={() =>
                      router.push(`/dashboard/whale-tracker/${row.whale_address}?chain=${row.chain}`)
                    }
                    onOpenToken={() => {
                      if (row.token_address) {
                        router.push(`/dashboard/market/${row.chain}/${row.token_address}`);
                      }
                    }}
                    onCopy={() => {
                      // Deep-link into the copy-trading confirm flow for this exact
                      // tx — the page renders a confirm card and POSTs execute.
                      const q = new URLSearchParams({
                        action: canonicalAction(row.action),
                        whale: row.whale_address,
                        token: row.token_address ?? "",
                        symbol: row.token_symbol ?? "",
                        chain: row.chain,
                        tx: row.tx_hash,
                        amount: String(Math.round(Number(row.value_usd ?? 0))),
                      });
                      router.push(`/dashboard/copy-trading?${q.toString()}`);
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
          </>)}
        </div>

        <div className="space-y-4">
          <WatchlistPanel
            items={watchlist}
            canFollow={canFollow}
            onUpgrade={goUpgrade}
            onAddClick={() => (canFollow ? setShowAdd(true) : goUpgrade())}
            onRemove={async (addr, chain) => {
              await fetch(
                `/api/whale-tracker/watchlist?whale_address=${addr}&chain=${chain}`,
                { method: "DELETE" },
              );
              await loadWatchlist();
            }}
            onToggleAlert={async (item) => {
              await fetch("/api/whale-tracker/watchlist", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  whale_address: item.whale_address,
                  chain: item.chain,
                  alert_enabled: !item.alert_enabled,
                }),
              });
              await loadWatchlist();
            }}
            onOpen={(addr, chain) =>
              router.push(`/dashboard/whale-tracker/${addr}?chain=${chain}`)
            }
          />
          <TopTodayPanel
            whales={topToday}
            onOpen={(addr, chain) =>
              router.push(`/dashboard/whale-tracker/${addr}?chain=${chain}`)
            }
            isWatched={isWatched}
            onToggleWatch={toggleWatch}
          />
          {/* §whale-tracker-grade — PnL leaderboard using whales.pnl_30d_usd,
              win_rate, and whale_score (already populated by the nightly
              whale-backfill-pnl cron). The Tracker had access to this
              data via /api/whales but never surfaced it. Adds behavioral
              badges so users can spot Accumulator / Distributor / Sniper
              / High-win-rate at a glance, matching Nansen/Arkham. */}
          <PnlLeaderboardPanel
            onOpen={(addr, chain) =>
              router.push(`/dashboard/whale-tracker/${addr}?chain=${chain}`)
            }
            isWatched={isWatched}
            onToggleWatch={toggleWatch}
          />
        </div>
      </div>

      <AddWhaleModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={async () => {
          setShowAdd(false);
          await loadWatchlist();
        }}
      />
    </div>
  );
}

function FeedCard({
  row,
  watched,
  canCopy,
  onToggleWatch,
  onOpenWhale,
  onOpenToken,
  onCopy,
}: {
  row: FeedRow;
  watched: boolean;
  canCopy: boolean;
  onToggleWatch: () => void;
  onOpenWhale: () => void;
  onOpenToken: () => void;
  onCopy: () => void;
}) {
  const action = row.action.toLowerCase();
  // For transfers, surface direction (Received / Sent) so the feed is honest
  // about two-sided flow instead of a flat "transfer".
  const isReceive = action === "buy" || row.direction === "in";
  const isSend = action === "sell" || row.direction === "out";
  const actionLabel =
    action === "buy" ? "buy"
      : action === "sell" ? "sell"
      : row.direction === "in" ? "received"
      : row.direction === "out" ? "sent"
      : "transfer";
  const borderColor = isReceive ? "border-l-emerald-500" : isSend ? "border-l-rose-500" : "border-l-slate-600";
  const ActionIcon = isReceive ? ArrowDownLeft : isSend ? ArrowUpRight : ArrowLeftRight;
  const actionColor = isReceive ? "text-emerald-400" : isSend ? "text-rose-400" : "text-slate-400";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`nl-glass border-l-4 ${borderColor} rounded-xl p-4 hover:border-blue-500/30 transition-all cursor-pointer`}
      onClick={onOpenWhale}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500">{timeAgo(row.timestamp)}</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase text-[10px]">
              <ChainLogo chain={row.chain} size={12} />{row.chain}
            </span>
            <span className={`inline-flex items-center gap-1 ${actionColor} font-semibold uppercase text-[10px]`}>
              <ActionIcon size={10} /> {actionLabel}
            </span>
            <span className="ms-auto font-mono font-bold text-white tabular-nums">
              {fmtUsd(Number(row.value_usd ?? 0))}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs flex-wrap">
            <span className="font-mono text-slate-300">{short(row.whale_address)}</span>
            {(() => {
              // Styled entity badge from the resolved WhaleLabel (server bridges
              // whales.entity_type → WhaleLabel so this always maps to a pill).
              const meta = LABEL_META[row.whale_label];
              if (!meta) return null;
              return (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase border"
                  style={{ backgroundColor: `${meta.color}1F`, color: meta.color, borderColor: `${meta.color}55` }}
                  title={meta.tooltip}
                >
                  {meta.short}
                </span>
              );
            })()}
            {row.label && (
              <span className="text-[10px] text-slate-400 truncate max-w-[140px]" title={row.label}>
                {row.label}
              </span>
            )}
            {/* §whale-tracker-grade — behavioral badges inline on the feed
                row so users can spot trader archetype at a glance. */}
            <WhaleBadgeRow badges={deriveBadges(row)} />
          </div>
          {row.token_symbol && (
            <div className="mt-1 text-xs text-slate-400">
              {action === "buy" ? "Bought"
                : action === "sell" ? "Sold"
                : row.direction === "in" ? "Received"
                : row.direction === "out" ? "Sent"
                : "Transferred"}{" "}
              {row.token_address ? (
                <button
                  type="button"
                  title="Open token chart"
                  onClick={(e) => { e.stopPropagation(); onOpenToken(); }}
                  className="font-semibold text-white hover:text-[#8FA3FF] underline-offset-2 hover:underline transition-colors"
                >
                  {row.token_symbol}
                </button>
              ) : (
                <span className="font-semibold text-white">{row.token_symbol}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* One-click copy — only on actionable buy/sell rows with a token.
              Opens the copy-trading confirm page for THIS transaction, which
              runs the tier/security/cap checks and hands off to the wallet. */}
          {canCopy && (action === "buy" || action === "sell") && row.token_address && (
            <button
              type="button"
              title="Copy this trade"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
              className="p-2 rounded-lg text-[#8FA3FF] hover:bg-[#0066FF]/15 hover:text-white transition-colors"
            >
              <Zap size={14} />
            </button>
          )}
          <button
            type="button"
            title={watched ? "Unwatch" : "Watch"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatch();
            }}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            {watched ? (
              <Bell size={14} className="fill-yellow-400 text-yellow-400" />
            ) : (
              <BellOff size={14} />
            )}
          </button>
          {/* Chevron opens the WHALE PROFILE (last active, first seen, score,
              recent activity) — not the token chart. The token chart is reached
              by tapping the token symbol above. */}
          <button
            type="button"
            title="View whale profile"
            onClick={(e) => {
              e.stopPropagation();
              onOpenWhale();
            }}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function WatchlistPanel({
  items,
  canFollow,
  onUpgrade,
  onAddClick,
  onRemove,
  onToggleAlert,
  onOpen,
}: {
  items: WatchlistItem[];
  canFollow: boolean;
  onUpgrade: () => void;
  onAddClick: () => void;
  onRemove: (address: string, chain: string) => void;
  onToggleAlert: (item: WatchlistItem) => void;
  onOpen: (address: string, chain: string) => void;
}) {
  return (
    <div className="nl-glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">My Whales</h3>
          <p className="text-[11px] text-slate-500">
            {canFollow ? `Following ${items.length} ${items.length === 1 ? 'whale' : 'whales'}` : 'Follow whales with Pro'}
          </p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[#0066FF]/10 hover:bg-[#0066FF]/20 text-[#6F7EFF] border border-[#0066FF]/30 font-semibold"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {!canFollow ? (
        <div className="py-6 text-center">
          <Telescope size={24} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400">Following whales & move alerts are a Pro feature.</p>
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-2 text-xs text-[#6F7EFF] hover:text-white transition-colors font-semibold"
          >
            Upgrade to Pro →
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center">
          <Telescope size={24} className="mx-auto text-slate-600 mb-2" />
          <p className="text-xs text-slate-400">Track whales to get notified</p>
          <button
            type="button"
            onClick={onAddClick}
            className="mt-2 text-xs text-[#6F7EFF] hover:text-white transition-colors"
          >
            + Add your first whale
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={`${it.chain}:${it.whale_address}`}
              className="rounded-lg border border-slate-800 bg-slate-900/30 p-3 hover:border-blue-500/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpen(it.whale_address, it.chain)}
                  className="flex-1 text-start min-w-0"
                >
                  <div className="text-sm font-semibold text-white truncate">
                    {it.label ?? short(it.whale_address)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase">
                    {it.chain} · {short(it.whale_address)}
                  </div>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    title={it.alert_enabled ? "Alerts on" : "Alerts off"}
                    onClick={() => onToggleAlert(it)}
                    className={`p-1.5 rounded-md transition-colors ${
                      it.alert_enabled
                        ? "text-yellow-400 hover:bg-yellow-500/10"
                        : "text-slate-500 hover:bg-slate-800"
                    }`}
                  >
                    {it.alert_enabled ? <Bell size={12} /> : <BellOff size={12} />}
                  </button>
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => onRemove(it.whale_address, it.chain)}
                    className="p-1.5 rounded-md text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {it.alert_enabled && it.alert_threshold_usd && (
                <div className="mt-1 text-[10px] text-slate-500">
                  Alerts above ${Number(it.alert_threshold_usd).toLocaleString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TopTodayPanel({
  whales,
  onOpen,
  isWatched,
  onToggleWatch,
}: {
  whales: TopWhale[];
  onOpen: (addr: string, chain: string) => void;
  isWatched: (addr: string, chain: string) => boolean;
  onToggleWatch: (addr: string, chain: string) => void;
}) {
  return (
    <div className="nl-glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Top Whales Today</h3>
        <span className="text-[10px] text-slate-500 uppercase">24h volume</span>
      </div>
      {whales.length === 0 ? (
        <p className="text-xs text-slate-500 py-4 text-center">
          No whale activity recorded yet today.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {whales.map((w, i) => (
            <li
              key={`${w.chain}:${w.whale_address}`}
              className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-900/50 transition-colors"
            >
              <span className="text-xs font-mono text-slate-600 w-5 text-center">
                #{i + 1}
              </span>
              <WhaleAvatar address={w.whale_address} chain={w.chain} size={28} />
              <button
                type="button"
                onClick={() => onOpen(w.whale_address, w.chain)}
                className="flex-1 text-start min-w-0"
              >
                <div className="text-xs font-semibold text-white truncate">
                  {w.label ?? short(w.whale_address)}
                </div>
                <div className="text-[10px] font-mono text-slate-500 uppercase">
                  {w.chain} · {w.move_count} moves
                </div>
              </button>
              <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                {fmtUsd(w.volume_usd)}
              </span>
              <button
                type="button"
                onClick={() => onToggleWatch(w.whale_address, w.chain)}
                className="p-1 rounded text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                title={isWatched(w.whale_address, w.chain) ? "Unwatch" : "Watch"}
              >
                <Bell
                  size={11}
                  className={isWatched(w.whale_address, w.chain) ? "fill-yellow-400 text-yellow-400" : ""}
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// §whale-tracker-grade — derive behavioral badges from existing columns.
// pnl_30d_usd + win_rate + avg_hold_hours come from the nightly
// whale-backfill-pnl cron. Tags surface at-a-glance trader archetypes
// the way Nansen/Arkham do.
type WhaleBadge = 'accumulator' | 'distributor' | 'sniper' | 'high-win-rate';

function deriveBadges(w: { pnl_30d_usd?: number | null; win_rate?: number | null; avg_hold_hours?: number | null; archetype?: string | null }): WhaleBadge[] {
  // WHALE6: prefer the stored archetype (computed authoritatively by the
  // whale-backfill-pnl cron's FIFO match) when present; fall back to the
  // pre-cron heuristic so rows that haven't been backfilled yet still
  // surface a badge.
  const stored = (w.archetype ?? null) as WhaleBadge | null;
  if (stored && (stored === 'accumulator' || stored === 'distributor' || stored === 'sniper' || stored === 'high-win-rate')) {
    return [stored];
  }
  const badges: WhaleBadge[] = [];
  const pnl = Number(w.pnl_30d_usd ?? 0);
  const wr = Number(w.win_rate ?? 0);
  const hold = Number(w.avg_hold_hours ?? 0);
  if (wr >= 70) badges.push('high-win-rate');
  if (hold > 0 && hold < 6 && wr >= 50) badges.push('sniper');
  if (pnl > 0 && hold >= 168) badges.push('accumulator');
  if (pnl < 0 || (hold >= 720 && wr < 50)) badges.push('distributor');
  return badges;
}

const BADGE_STYLE: Record<WhaleBadge, { label: string; cls: string }> = {
  'accumulator':   { label: 'ACCUM',     cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  'distributor':   { label: 'DISTRIB',   cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  'sniper':        { label: 'SNIPER',    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  'high-win-rate': { label: 'WIN ≥70%',  cls: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
};

function WhaleBadgeRow({ badges }: { badges: WhaleBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {badges.map((b) => (
        <span
          key={b}
          className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase tracking-wider border ${BADGE_STYLE[b].cls}`}
        >
          {BADGE_STYLE[b].label}
        </span>
      ))}
    </div>
  );
}

interface PnlWhaleRow {
  id: string;
  address: string;
  chain: string;
  label: string | null;
  pnl_30d_usd: number | null;
  win_rate: number | null;
  whale_score: number | null;
  portfolio_value_usd: number | null;
  avg_hold_hours: number | null;
}

function PnlLeaderboardPanel({
  onOpen,
  isWatched,
  onToggleWatch,
}: {
  onOpen: (addr: string, chain: string) => void;
  isWatched: (addr: string, chain: string) => boolean;
  onToggleWatch: (addr: string, chain: string) => void;
}) {
  const [rows, setRows] = useState<PnlWhaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // This is the PnL Leaderboard — rank by 30d PnL, not the default
    // whale_score, otherwise it duplicates the score board.
    fetch('/api/whales?limit=10&offset=0&sort=pnl')
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((data: { whales?: PnlWhaleRow[] }) => {
        if (cancelled) return;
        // Filter to whales with non-null pnl_30d_usd so the panel only
        // shows rows the backfill cron has actually scored. Top-by-PnL
        // ranking falls back to whale_score order returned by the API
        // when ties exist.
        const scored = (data.whales ?? []).filter((w) => w.pnl_30d_usd !== null);
        scored.sort((a, b) => (Number(b.pnl_30d_usd) || 0) - (Number(a.pnl_30d_usd) || 0));
        setRows(scored.slice(0, 10));
      })
      .catch((e: Error) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="nl-glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">PnL Leaderboard</h3>
        <span className="text-[10px] text-slate-500 uppercase">30d realized</span>
      </div>
      {loading && (
        <p className="text-xs text-slate-500 py-4 text-center">Loading PnL data…</p>
      )}
      {error && (
        <p className="text-xs text-red-400 py-4 text-center">Couldn&apos;t load PnL data.</p>
      )}
      {!loading && !error && rows.length === 0 && (
        <p className="text-xs text-slate-500 py-4 text-center">No PnL-scored whales yet.</p>
      )}
      {!loading && !error && rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((w, i) => {
            const pnl = Number(w.pnl_30d_usd ?? 0);
            const pnlPositive = pnl >= 0;
            const wr = Number(w.win_rate ?? 0);
            const badges = deriveBadges(w);
            return (
              <li
                key={`${w.chain}:${w.address}`}
                className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-900/50 transition-colors"
              >
                <span className="text-xs font-mono text-slate-600 w-5 text-center">#{i + 1}</span>
                <WhaleAvatar address={w.address} chain={w.chain} size={28} />
                <button
                  type="button"
                  onClick={() => onOpen(w.address, w.chain)}
                  className="flex-1 text-start min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-white truncate">
                      {w.label ?? short(w.address)}
                    </span>
                    <WhaleBadgeRow badges={badges} />
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-2">
                    <span>{w.chain}</span>
                    {wr > 0 && <span>· {wr.toFixed(0)}% win</span>}
                  </div>
                </button>
                <span className={`text-xs font-mono font-bold tabular-nums ${pnlPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnlPositive ? '+' : ''}{fmtUsd(Math.abs(pnl))}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleWatch(w.address, w.chain)}
                  className="p-1 rounded text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                  title={isWatched(w.address, w.chain) ? 'Unwatch' : 'Watch'}
                >
                  <Bell
                    size={11}
                    className={isWatched(w.address, w.chain) ? 'fill-yellow-400 text-yellow-400' : ''}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function AddWhaleModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [label, setLabel] = useState("");
  const [alertEnabled, setAlertEnabled] = useState(true);
  const [threshold, setThreshold] = useState(50000);
  const [channels, setChannels] = useState<string[]>(["push"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/whale-tracker/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whale_address: address.trim(),
          chain,
          label: label.trim() || null,
          alert_enabled: alertEnabled,
          alert_threshold_usd: threshold,
          channels,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      onSaved();
      setAddress("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-sm font-bold text-white">Add whale to My Whales</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-slate-500">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x… or Solana base58"
              className="mt-1 w-full nl-glass rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-slate-500">Chain</label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="mt-1 w-full nl-glass rounded-lg px-3 py-2 text-xs"
              >
                <option value="ethereum">Ethereum</option>
                <option value="solana">Solana</option>
                <option value="base">Base</option>
                <option value="arbitrum">Arbitrum</option>
                <option value="bsc">BSC</option>
                <option value="polygon">Polygon</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-wide text-slate-500">Label (optional)</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Jump Trading"
                className="mt-1 w-full nl-glass rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500/40"
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
            <div>
              <div className="text-xs text-white">Alerts</div>
              <div className="text-[10px] text-slate-500">Notify when this whale moves</div>
            </div>
            <button
              type="button"
              onClick={() => setAlertEnabled((v) => !v)}
              className={`w-10 h-5 rounded-full relative transition-colors ${
                alertEnabled ? "bg-[#0066FF]" : "bg-slate-700"
              }`}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${
                  alertEnabled ? "right-0.5" : "left-0.5"
                }`}
              />
            </button>
          </div>
          {alertEnabled && (
            <>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500">Min size</label>
                <div className="mt-1 flex gap-1">
                  {[10_000, 50_000, 100_000, 500_000].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setThreshold(v)}
                      className={`flex-1 py-1.5 text-[10px] rounded-lg transition-colors ${
                        threshold === v
                          ? "bg-[#0066FF]/15 text-[#6F7EFF] border border-[#0066FF]/30"
                          : "bg-slate-900 text-slate-400 border border-slate-800"
                      }`}
                    >
                      ${v.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wide text-slate-500">Channels</label>
                <div className="mt-1 flex gap-1">
                  {(["push", "telegram", "email"] as const).map((c) => {
                    const on = channels.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setChannels((prev) =>
                            prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                          )
                        }
                        className={`flex-1 py-1.5 text-[10px] rounded-lg uppercase transition-colors ${
                          on
                            ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                            : "bg-slate-900 text-slate-400 border border-slate-800"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !address.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0066FF] hover:bg-[#0918D0] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
