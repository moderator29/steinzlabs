"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Search,
  Plus,
  Bell,
  BellOff,
  Trash2,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Telescope,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { BackButton } from "@/components/ui/BackButton";
import { NakaLoader } from "@/components/brand/NakaLoader";

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
  const router = useRouter();
  const [selectedChains, setSelectedChains] = useState<string[]>(["all"]);
  const [size, setSize] = useState<Size>("100k");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [actionFilter, setActionFilter] = useState<Action>(null);
  const [tokenSearch, setTokenSearch] = useState("");
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
    try {
      const params = new URLSearchParams({ size, time: timeRange, limit: "100" });
      if (activeChainParam) params.set("chains", activeChainParam);
      if (actionFilter) params.set("action", actionFilter);
      if (tokenSearch.trim()) params.set("token", tokenSearch.trim());
      const res = await fetch(`/api/whale-tracker/feed?${params}`);
      if (!res.ok) throw new Error(`Feed ${res.status}`);
      const data = (await res.json()) as { rows: FeedRow[]; total: number };
      setFeed(data.rows ?? []);
      setFeedTotal(data.total ?? 0);
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Feed failed");
    } finally {
      setFeedLoading(false);
    }
  }, [size, timeRange, activeChainParam, actionFilter, tokenSearch]);

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
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    void loadWatchlist();
    void loadTopToday();
  }, [loadWatchlist, loadTopToday]);

  // Poll feed every 15s. SSE upgrade can layer on top of this later.
  useEffect(() => {
    const t = setInterval(() => void loadFeed(), 15_000);
    return () => clearInterval(t);
  }, [loadFeed]);

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
      (w) =>
        w.whale_address.toLowerCase() === address.toLowerCase() && w.chain === chain,
    );

  const toggleWatch = async (address: string, chain: string) => {
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

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <BackButton href="/dashboard" />
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-bold">Whale Tracker</h1>
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-[#0A1EFF]/15 text-[#6F7EFF] border border-[#0A1EFF]/30">
              PRO
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Phase 6: surface the new Directory view. */}
            <Link
              href="/dashboard/whale-tracker/directory"
              className="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors font-semibold text-slate-200"
            >
              Directory
            </Link>
            <Link
              href="/dashboard/whale-tracker/submit"
              className="text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors font-semibold"
            >
              Submit whale
            </Link>
          </div>
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
                      ? "bg-[#0A1EFF]/15 text-[#6F7EFF] border border-[#0A1EFF]/30"
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
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <select
            value={actionFilter ?? ""}
            onChange={(e) => setActionFilter((e.target.value || null) as Action)}
            className="px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800 text-xs"
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
          <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-3">
            Live whale feed · {feedTotal.toLocaleString()} matches
          </div>
          {feedLoading && feed.length === 0 ? (
            <NakaLoader text="Loading whales..." />
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
                    onToggleWatch={() => toggleWatch(row.whale_address, row.chain)}
                    onOpenWhale={() =>
                      router.push(`/dashboard/whale-tracker/${row.whale_address}?chain=${row.chain}`)
                    }
                    onOpenToken={() => {
                      if (row.token_address) {
                        router.push(`/dashboard/market/${row.chain}/${row.token_address}`);
                      }
                    }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <WatchlistPanel
            items={watchlist}
            onAddClick={() => setShowAdd(true)}
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
  onToggleWatch,
  onOpenWhale,
  onOpenToken,
}: {
  row: FeedRow;
  watched: boolean;
  onToggleWatch: () => void;
  onOpenWhale: () => void;
  onOpenToken: () => void;
}) {
  const action = row.action.toLowerCase();
  const borderColor =
    action === "buy" ? "border-l-emerald-500" : action === "sell" ? "border-l-rose-500" : "border-l-slate-600";
  const ActionIcon = action === "buy" ? ArrowDownLeft : action === "sell" ? ArrowUpRight : ArrowLeftRight;
  const actionColor =
    action === "buy" ? "text-emerald-400" : action === "sell" ? "text-rose-400" : "text-slate-400";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`bg-slate-950/60 backdrop-blur-xl border border-slate-800 border-l-4 ${borderColor} rounded-xl p-4 hover:border-blue-500/30 transition-all cursor-pointer`}
      onClick={onOpenWhale}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-slate-500">{timeAgo(row.timestamp)}</span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase text-[10px]">
              {row.chain}
            </span>
            <span className={`inline-flex items-center gap-1 ${actionColor} font-semibold uppercase text-[10px]`}>
              <ActionIcon size={10} /> {action}
            </span>
            <span className="ml-auto font-mono font-bold text-white tabular-nums">
              {fmtUsd(Number(row.value_usd ?? 0))}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2 text-xs flex-wrap">
            <span className="font-mono text-slate-300">{short(row.whale_address)}</span>
            {row.label && (
              <span className="px-1.5 py-0.5 rounded bg-[#0A1EFF]/15 text-[#6F7EFF] border border-[#0A1EFF]/30 text-[10px] font-semibold uppercase">
                {row.label}
              </span>
            )}
            {row.entity_type && !row.label && (
              <span className="text-[10px] uppercase text-slate-500">{row.entity_type}</span>
            )}
          </div>
          {row.token_symbol && (
            <div className="mt-1 text-xs text-slate-400">
              {action === "buy" ? "Bought" : action === "sell" ? "Sold" : "Transferred"}{" "}
              <span className="font-semibold text-white">{row.token_symbol}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
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
          {row.token_address && (
            <button
              type="button"
              title="Open token terminal"
              onClick={(e) => {
                e.stopPropagation();
                onOpenToken();
              }}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function WatchlistPanel({
  items,
  onAddClick,
  onRemove,
  onToggleAlert,
  onOpen,
}: {
  items: WatchlistItem[];
  onAddClick: () => void;
  onRemove: (address: string, chain: string) => void;
  onToggleAlert: (item: WatchlistItem) => void;
  onOpen: (address: string, chain: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800/50 bg-slate-950/80 backdrop-blur-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-white">My Watchlist</h3>
          <p className="text-[11px] text-slate-500">Watching {items.length} wallets</p>
        </div>
        <button
          type="button"
          onClick={onAddClick}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-[#0A1EFF]/10 hover:bg-[#0A1EFF]/20 text-[#6F7EFF] border border-[#0A1EFF]/30 font-semibold"
        >
          <Plus size={12} /> Add
        </button>
      </div>
      {items.length === 0 ? (
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
                  className="flex-1 text-left min-w-0"
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
    <div className="rounded-2xl border border-slate-800/50 bg-slate-950/80 backdrop-blur-xl p-4">
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
              <button
                type="button"
                onClick={() => onOpen(w.whale_address, w.chain)}
                className="flex-1 text-left min-w-0"
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
          <h2 className="text-sm font-bold text-white">Add whale to watchlist</h2>
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
              className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] uppercase tracking-wide text-slate-500">Chain</label>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs"
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
                className="mt-1 w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-500/40"
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
                alertEnabled ? "bg-[#0A1EFF]" : "bg-slate-700"
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
                          ? "bg-[#0A1EFF]/15 text-[#6F7EFF] border border-[#0A1EFF]/30"
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
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#0A1EFF] hover:bg-[#0918D0] text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
