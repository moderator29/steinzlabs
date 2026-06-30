"use client";

import { useCallback, useEffect, useMemo, useState, use } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, CheckCircle2, Loader2, Copy, Download, Repeat2, Sparkles } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { SecurityBadge } from "@/components/security/SecurityBadge";
import { WhaleAvatar } from "@/components/whales/WhaleAvatar";
import { ChainLogo } from "@/components/common/ChainLogo";
import NewCopyRuleModal from "@/app/dashboard/copy-trading/NewCopyRuleModal";
import { toast } from "sonner";
import { useTabListKeys } from "@/hooks/useTabListKeys";

const WHALE_TABS = ["overview", "activity", "tokens", "counterparties", "copy"] as const;

// §11 — lazy-load the chart so the lightweight-charts bundle (~50KB)
// only ships when a user opens the Activity tab.
const WhaleActivityChart = dynamic(() => import("@/components/whales/WhaleActivityChart"), {
  ssr: false,
  loading: () => <div className="h-[220px] rounded-xl border border-white/10 flex items-center justify-center text-xs text-slate-500">Loading chart…</div>,
});

type Tab = "overview" | "activity" | "tokens" | "counterparties" | "copy";

interface WhaleDetail {
  // Bug §2.4: whale can be null when the address is known via Arkham but not
  // in our whales table yet. The old code dereferenced data.whale.address
  // unconditionally and crashed the moment the API returned a null whale,
  // which redirected the user back to the directory in ~0.5s.
  whale: {
    id: string;
    address: string;
    chain: string;
    label: string | null;
    entity_type: string | null;
    portfolio_value_usd: number | null;
    pnl_7d_usd: number | null;
    pnl_30d_usd: number | null;
    pnl_90d_usd: number | null;
    win_rate: number | null;
    trade_count_30d: number | null;
    whale_score: number;
    x_handle: string | null;
    verified: boolean;
    last_active_at: string | null;
    first_seen_at?: string | null;
  } | null;
  arkham?: {
    entity: string | null;
    type: string | null;
    verified: boolean;
    logo: string | null;
    website: string | null;
    twitter: string | null;
    labels: string[];
  } | null;
  activity: Array<{
    id: string;
    tx_hash: string;
    action: string;
    token_symbol: string | null;
    token_address: string | null;
    amount: number | null;
    value_usd: number | null;
    counterparty: string | null;
    counterparty_label: string | null;
    timestamp: string;
  }>;
  followerCount: number;
}

/**
 * Safe date label — returns '' for null/invalid input instead of throwing.
 * `new Date(bad).toLocaleDateString()` throws "Invalid Date" in some engines,
 * which is what was crashing the whole whale page into the error boundary.
 */
function safeDateLabel(iso: unknown): string {
  if (!iso || typeof iso !== 'string') return '';
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? new Date(t).toLocaleDateString() : '';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!isFinite(diff) || diff < 0) return "n/a";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return safeDateLabel(iso) || "n/a";
}

function fmtUsd(n: number | null): string {
  if (n === null) return "n/a";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/**
 * Bug 5c — client-side estimated net-flow when the server-side PnL
 * backfill hasn't populated whales.pnl_7d_usd / pnl_30d_usd yet.
 *
 * We can't compute true realized PnL on the client without cost-basis
 * history (which lives on the server's Arkham FIFO backfill), but we
 * CAN sum value_usd of sells minus buys in the window. That's a real
 * indicative number — labelled as 'est.' so users don't mistake it for
 * audited PnL — and it ships immediately instead of leaving the row
 * showing 'n/a' until the cron runs.
 *
 * Returns null when activity is empty or no rows in window — caller
 * falls back to 'n/a' as before.
 */
function estimateNetFlowUsd(
  activity: ReadonlyArray<{ action: string; value_usd: number | null; timestamp: string | null }>,
  windowDays: number,
): number | null {
  if (!activity || activity.length === 0) return null;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  let net = 0;
  let counted = 0;
  for (const a of activity) {
    if (!a.timestamp) continue;
    const ts = new Date(a.timestamp).getTime();
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    if (typeof a.value_usd !== 'number' || !Number.isFinite(a.value_usd)) continue;
    const action = (a.action || '').toLowerCase();
    // Sells / outflows count positive (realised exit), buys / inflows
    // negative (deployed capital). Anything ambiguous ('tx', 'transfer')
    // we skip — counting it would inflate the estimate either way.
    if (action === 'sell' || action === 'send') net += a.value_usd;
    else if (action === 'buy' || action === 'receive') net -= a.value_usd;
    else continue;
    counted += 1;
  }
  return counted > 0 ? net : null;
}

export default function WhaleDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const sp = useSearchParams();
  const chain = sp.get("chain") ?? "";
  const [data, setData] = useState<WhaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");
  const [following, setFollowing] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  // Copy-this-whale modal state — opens NewCopyRuleModal pre-filled
  // with this whale's address + chain. Audit P0 fix: the Copy tab
  // had no entry point; users had to leave for /dashboard/copy-trading
  // and re-enter the address by hand.
  const [copyRuleOpen, setCopyRuleOpen] = useState(false);

  const [fetchError, setFetchError] = useState<'auth' | 'tier' | 'notfound' | 'network' | null>(null);
  // True when we're showing the whale's last-known (cached) data because the
  // live fetch failed — so we degrade to real saved data instead of the bare
  // "Couldn't load this whale" error screen.
  const [stale, setStale] = useState(false);

  // Session cache of the last successful whale detail, keyed per whale. Lets us
  // render the real card (with whatever data we last had) on a transient fetch
  // failure instead of throwing the user to an error screen.
  const cacheKey = `whale-detail:${chain}:${address}`;
  const readCache = useCallback((): WhaleDetail | null => {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as WhaleDetail) : null;
    } catch { return null; }
  }, [cacheKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Paint instantly from cache if we have it (stale-while-revalidate).
      const cached = readCache();
      if (cached && !cancelled) { setData(cached); setLoading(false); }
      try {
        const res = await fetch(`/api/whales/${address}?chain=${encodeURIComponent(chain)}`);
        if (!res.ok) {
          // On failure, prefer the whale's last-known data over an error wall.
          // Only surface the hard error when we have nothing cached to show.
          const fallback = cached ?? readCache();
          if (fallback) {
            if (!cancelled) { setData(fallback); setStale(true); }
          } else if (!cancelled) {
            if (res.status === 401) setFetchError('auth');
            else if (res.status === 403) setFetchError('tier');
            else if (res.status === 404) setFetchError('notfound');
            else setFetchError('network');
          }
          return;
        }
        const json = (await res.json()) as WhaleDetail;
        if (!cancelled) {
          setData(json);
          setStale(false);
          setFetchError(null);
          // Persist only when we actually have the whale row (don't cache a
          // not-found shell as if it were real data).
          if (json.whale) { try { sessionStorage.setItem(cacheKey, JSON.stringify(json)); } catch { /* quota */ } }
        }
      } catch {
        const fallback = cached ?? readCache();
        if (fallback) {
          if (!cancelled) { setData(fallback); setStale(true); }
        } else if (!cancelled) setFetchError('network');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, chain, cacheKey, readCache]);

  // Bug §5a — hydrate `following` from the server so the button reflects
  // reality on first paint, not the optimistic local default.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/whales/follow?whale_address=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}`);
        if (!res.ok) return;
        const json = await res.json() as { following?: boolean };
        if (!cancelled) setFollowing(!!json.following);
      } catch { /* network / auth — keep optimistic default */ }
    })();
    return () => { cancelled = true; };
  }, [address, chain]);

  async function toggleFollow() {
    setFollowingLoading(true);
    try {
      if (!following) {
        const res = await fetch("/api/whales/follow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ whale_address: address, chain, label: data?.whale?.label ?? null }),
        });
        if (res.ok) {
          setFollowing(true);
          toast.success("Now following whale");
        } else toast.error("Failed to follow");
      } else {
        const res = await fetch(`/api/whales/follow?whale_address=${address}&chain=${chain}`, { method: "DELETE" });
        if (res.ok) {
          setFollowing(false);
          toast.success("Unfollowed");
        }
      }
    } finally {
      setFollowingLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!data || !data.whale) {
    // Bug §2.4: handle all the reasons the page can land here without an
    // auto-redirect. Previously clicking View opened the page, the fetch
    // returned whale:null (or 403/404), and the user saw a blank "Whale
    // not found" for ~0.5s before tapping back. Now the page STAYS open
    // and explains which situation we're in + offers a next action.
    const arkham = data?.arkham || null;
    const reasonText = fetchError === 'auth' ? 'You need to sign in to view whale profiles.'
      : fetchError === 'tier' ? 'Whale profiles require a Pro or Max plan.'
      : fetchError === 'network' ? 'Could not reach the server. Check your connection and retry.'
      : arkham?.entity ? `${arkham.entity} hasn't been added to our tracker yet. Submit it to start indexing trades.`
      : 'This whale is not in our directory yet.';
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-slate-300 gap-4 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5" />
        </div>
        <div className="max-w-sm space-y-2">
          <p className="text-base font-semibold text-white">Whale profile unavailable</p>
          <p className="text-sm text-slate-400">{reasonText}</p>
          {arkham?.labels && arkham.labels.length > 0 && (
            <p className="text-xs text-slate-500">Arkham labels: {arkham.labels.slice(0, 4).join(', ')}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/whale-tracker" className="px-4 py-2 text-sm rounded-lg border border-slate-700 hover:bg-slate-800/60 transition">
            Back to tracker
          </Link>
          {fetchError !== 'tier' && fetchError !== 'auth' && (
            <Link
              href={`/dashboard/whale-tracker/submit?address=${encodeURIComponent(address)}${chain ? `&chain=${encodeURIComponent(chain)}` : ''}`}
              className="nl-btn-neon !px-4 !py-2 !text-sm rounded-lg transition"
            >
              Submit this whale
            </Link>
          )}
        </div>
      </div>
    );
  }

  const w = data.whale;

  return (
    <div className="min-h-screen text-white pb-20">
      {stale && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300/90 text-[11px] text-center py-1.5 px-4">
          Showing this whale's last saved data · live refresh is taking a moment
        </div>
      )}
      <div className="sticky top-0 z-30 bg-[#0A0E27]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="mb-3"><BackButton href="/dashboard/whale-tracker" label="Whale tracker" compact /></div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0 flex items-start gap-3">
              {/* §4.2 Whale avatar — uses the cached logo_url from
                  /api/whales/[address]/logo (Arkham → ENS → Dicebear).
                  Falls back to live Arkham resolution if cache is empty. */}
              <WhaleAvatar
                address={w.address}
                chain={w.chain}
                logoUrl={(w as unknown as { logo_url?: string | null }).logo_url ?? data.arkham?.logo ?? null}
                size={48}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold truncate">
                    {/* Real name priority: Arkham entity > stored label > truncated address */}
                    {data.arkham?.entity || w.label || `${w.address.slice(0, 6)}…${w.address.slice(-4)}`}
                  </h1>
                  {w.verified && <CheckCircle2 size={15} className="text-blue-400" />}
                  <SecurityBadge score={w.whale_score} size="md" />
                </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <code className="font-mono">{w.address}</code>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(w.address);
                    toast.success("Copied");
                  }}
                  className="hover:text-white transition"
                >
                  <Copy size={11} />
                </button>
                <span className="inline-flex items-center gap-1 uppercase"><ChainLogo chain={w.chain} size={12} />{w.chain}</span>
                {w.x_handle && (
                  <a href={`https://x.com/${w.x_handle}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                    @{w.x_handle} <ExternalLink size={9} />
                  </a>
                )}
              </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* DNA Scan — deep-links to the AI DNA analyzer pre-loaded with
                  this whale's address; the analyzer auto-runs on arrival. */}
              <a
                href={`/dashboard/dna-analyzer?address=${encodeURIComponent(w.address)}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/35 text-violet-200 transition-colors"
                title="Run AI DNA analysis on this whale"
              >
                <Sparkles size={12} /> DNA Scan
              </a>
              <button
                onClick={toggleFollow}
                disabled={followingLoading}
                className={`rounded-lg text-xs font-semibold transition ${
                  following ? "px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700" : "nl-btn-neon !px-4 !py-2 !text-xs"
                }`}
              >
                {followingLoading ? <Loader2 size={11} className="animate-spin" /> : following ? "Following" : "Follow"}
              </button>
            </div>
          </div>

          {/* A11Y5: WAI-ARIA tablist pattern. Arrow keys + Home/End nav,
              aria-selected + tabIndex roving so screen readers and
              keyboard users get the same affordances as a mouse user. */}
          <div
            role="tablist"
            aria-label="Whale detail sections"
            onKeyDown={useTabListKeys(WHALE_TABS, WHALE_TABS.indexOf(tab), (t) => setTab(t))}
            className="mt-5 flex gap-1 border-b border-slate-800 -mb-px overflow-x-auto"
          >
            {WHALE_TABS.map((t) => {
              const selected = tab === t;
              return (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  id={`whale-tab-${t}`}
                  aria-selected={selected}
                  aria-controls={`whale-panel-${t}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setTab(t)}
                  className={`px-3 py-2 text-xs uppercase tracking-wide transition whitespace-nowrap ${
                    selected ? "text-[#6F7EFF] border-b-2 border-[#0066FF]/60" : "text-slate-500 hover:text-white"
                  }`}
                >
                  {t === "copy" ? "Copy rules" : t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        role="tabpanel"
        id={`whale-panel-${tab}`}
        aria-labelledby={`whale-tab-${tab}`}
        className="max-w-5xl mx-auto px-4 py-6"
      >
        {tab === "overview" && (
          <>
            {/* WHALE5: Arkham entity intel — only renders when Arkham has
                actually resolved this address to a labelled entity, so an
                un-labelled wallet doesn't show an empty card. */}
            {data.arkham && (data.arkham.entity || data.arkham.website || data.arkham.twitter || (data.arkham.labels && data.arkham.labels.length > 0)) && (
              <div className="mb-6 rounded-xl nl-glass p-4">
                <div className="flex items-start gap-3">
                  {data.arkham.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.arkham.logo} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-800" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs uppercase tracking-wider text-blue-300 font-semibold">Arkham Intel</span>
                      {data.arkham.verified && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-blue-300 bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 rounded">
                          <CheckCircle2 size={9} /> Verified
                        </span>
                      )}
                      {data.arkham.type && (
                        <span className="text-[10px] uppercase text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded">{data.arkham.type}</span>
                      )}
                    </div>
                    {data.arkham.entity && (
                      <p className="text-sm font-semibold text-white mt-1">{data.arkham.entity}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      {data.arkham.website && (
                        <a href={data.arkham.website} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                          Website <ExternalLink size={9} />
                        </a>
                      )}
                      {data.arkham.twitter && (
                        <a href={`https://x.com/${data.arkham.twitter.replace(/^@/, '')}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                          @{data.arkham.twitter.replace(/^@/, '')} <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                    {data.arkham.labels && data.arkham.labels.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        {data.arkham.labels.slice(0, 8).map((l) => (
                          <span key={l} className="text-[10px] text-slate-300 bg-slate-800/60 border border-slate-700 px-1.5 py-0.5 rounded">{l}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Portfolio" value={fmtUsd(w.portfolio_value_usd)} />
              {/* Bug 5c — when the server-side PnL backfill hasn't run yet
                  (whales.pnl_7d_usd / pnl_30d_usd null), compute an
                  indicative net-flow estimate from the activity feed so
                  the row doesn't sit blank for hours. Label '(est.)' so
                  users see it's not audited PnL. */}
              {(() => {
                const est7d = w.pnl_7d_usd === null ? estimateNetFlowUsd(data.activity ?? [], 7) : null;
                const value = w.pnl_7d_usd !== null ? fmtUsd(w.pnl_7d_usd) : est7d !== null ? `${fmtUsd(est7d)} (est.)` : 'n/a';
                const tone = (w.pnl_7d_usd ?? est7d ?? 0) >= 0 ? 'up' : 'down';
                return <StatCard label="7d PnL" value={value} tone={tone as 'up' | 'down'} />;
              })()}
              {(() => {
                const est30d = w.pnl_30d_usd === null ? estimateNetFlowUsd(data.activity ?? [], 30) : null;
                const value = w.pnl_30d_usd !== null ? fmtUsd(w.pnl_30d_usd) : est30d !== null ? `${fmtUsd(est30d)} (est.)` : 'n/a';
                const tone = (w.pnl_30d_usd ?? est30d ?? 0) >= 0 ? 'up' : 'down';
                return <StatCard label="30d PnL" value={value} tone={tone as 'up' | 'down'} />;
              })()}
              {/* win_rate is stored 0..100 (see whale-backfill-pnl), so render
                  it directly — multiplying by 100 showed e.g. "6500%". */}
              <StatCard label="Win rate" value={w.win_rate !== null ? `${Math.round(w.win_rate)}%` : "n/a"} />
              <StatCard label="Trades (30d)" value={w.trade_count_30d?.toString() ?? "n/a"} />
              {/* Deep-dive crash fix — followerCount can be undefined on
                  unbackfilled rows; .toLocaleString() on undefined throws. */}
              <StatCard label="Followers" value={(data.followerCount ?? 0).toLocaleString()} />
              <StatCard label="Entity" value={w.entity_type ?? "unknown"} />
              <StatCard label="Score" value={w.whale_score.toString()} />
              <StatCard label="First seen" value={safeDateLabel(w.first_seen_at) || "n/a"} />
              <StatCard label="Last active" value={w.last_active_at ? relativeTime(w.last_active_at) : "n/a"} />
            </div>
            <AiSummarySection address={w.address} chain={w.chain} />
          </>
        )}

        {tab === "activity" && (
          <div className="space-y-3">
            {/* §11 — Cumulative trade-volume area chart fed by data.activity.
                Renders an empty-state stub when fewer than 2 USD-valued trades
                exist, so we don't show a flat line that looks broken. */}
            <WhaleActivityChart activity={data.activity} />
            {/* Audit B6 / P1 #27 — CSV export. Nansen offers this on
                paid tiers; we put it in-page so any tier-gated user
                can pull their own analysis without an API key. */}
            {data.activity.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => downloadActivityCsv(address, chain, data.activity)}
                  className="nl-btn-neon !px-3 !py-1.5 !text-[11px] inline-flex items-center gap-1.5 rounded-lg font-semibold"
                >
                  <Download size={12} /> Export CSV ({data.activity.length})
                </button>
              </div>
            )}
            <div className="rounded-xl nl-glass overflow-hidden">
            {data.activity.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No recorded activity yet. The whale-activity-poll cron populates this as new on-chain events arrive.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="text-start px-3 py-2">Action</th>
                    <th className="text-start px-3 py-2">Token</th>
                    <th className="text-start px-3 py-2">Amount</th>
                    <th className="text-start px-3 py-2">USD</th>
                    <th className="text-start px-3 py-2">Counterparty</th>
                    <th className="text-start px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activity.map((a) => (
                    <tr key={a.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                      <td className="px-3 py-2 uppercase text-[10px] text-slate-400">{a.action}</td>
                      <td className="px-3 py-2 font-mono text-white">{a.token_symbol ?? "n/a"}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{a.amount ?? "n/a"}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{fmtUsd(a.value_usd)}</td>
                      <td className="px-3 py-2 text-slate-400 truncate max-w-[140px]">{a.counterparty_label ?? a.counterparty ?? "n/a"}</td>
                      {/* Deep-dive crash fix — a.timestamp can be null on
                          live Alchemy/Helius rows; new Date(null) is Invalid
                          Date and .toLocaleString() throws on that. */}
                      <td className="px-3 py-2 text-slate-500">{(() => { const t = a.timestamp ? new Date(a.timestamp).getTime() : NaN; return Number.isFinite(t) ? new Date(t).toLocaleString() : 'n/a'; })()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>
        )}

        {tab === "tokens" && (
          <HoldingsPanel address={address} chain={chain} />
        )}

        {tab === "counterparties" && (
          <CounterpartiesPanel activity={data.activity} />
        )}

        {tab === "copy" && (
          <div className="rounded-xl nl-glass p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Copy this whale</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Mirror this whale&apos;s trades automatically, get instant Telegram alerts when they buy / sell,
                  or one-click confirm each move from your wallet. Cancel anytime.
                </p>
              </div>
              {/*
                Audit fix — the tab used to be a static "go configure
                rules elsewhere" message with no entry point. Industry
                standard (BananaGun / Maestro / Cielo) is one-click
                from the whale page into a pre-filled rule. Opens
                NewCopyRuleModal with the whale's address and chain
                already populated.
              */}
              <button
                type="button"
                onClick={() => setCopyRuleOpen(true)}
                className="nl-btn-neon !px-4 !py-2.5 !text-sm inline-flex items-center gap-2 rounded-lg font-semibold shrink-0"
              >
                <Repeat2 className="w-4 h-4" />
                Copy this whale
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Need to manage existing rules? Open{" "}
              <Link href="/dashboard/copy-trading" className="text-blue-400 hover:underline">
                /dashboard/copy-trading
              </Link>
              .
            </p>
          </div>
        )}

        {copyRuleOpen && (
          <NewCopyRuleModal
            initialWhaleAddress={address}
            initialChain={chain}
            onClose={() => setCopyRuleOpen(false)}
            onSaved={() => {
              setCopyRuleOpen(false);
              toast.success("Copy rule saved — alerts will fire when this whale trades.");
            }}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl nl-glass p-3">
      <p className="text-[9px] uppercase text-slate-500 tracking-wide mb-1">{label}</p>
      <p className={`text-base font-mono ${tone === "up" ? "text-green-400" : tone === "down" ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * §2.9 — AI Analysis section on whale profile. Button triggers Claude
 * summary; cached 24h server-side. Pro+ gated by the API route.
 */
function AiSummarySection({ address, chain }: { address: string; chain: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [data, setData] = useState<{
    rating_30d: number; rating_10d: number; sentiment: string; style: string;
    summary: string; generatedAt: string; cached: boolean;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setState('loading');
    setErr(null);
    try {
      const res = await fetch(`/api/whales/${address}/ai-summary?chain=${encodeURIComponent(chain)}`, {
        credentials: 'include',
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setData(body);
      setState('ok');
    } catch (e: any) {
      setErr(e?.message ?? 'unknown');
      setState('error');
    }
  };

  const sentimentColor = data?.sentiment === 'bullish' ? 'text-emerald-400' : data?.sentiment === 'bearish' ? 'text-red-400' : 'text-slate-400';

  return (
    <div className="rounded-xl nl-glass p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">AI Analysis</span>
        {state === 'idle' && (
          <button
            onClick={run}
            className="nl-btn-neon !px-3 !py-1.5 !text-xs ms-auto font-semibold rounded-lg"
          >
            Generate
          </button>
        )}
        {state === 'loading' && (
          <span className="ms-auto text-xs text-slate-400 inline-flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Analyzing…
          </span>
        )}
        {state === 'ok' && data?.cached && safeDateLabel(data.generatedAt) && (
          <span className="ms-auto text-[10px] text-slate-500">cached · {safeDateLabel(data.generatedAt)}</span>
        )}
      </div>

      {state === 'idle' && (
        <p className="text-xs text-slate-500">Click Generate for an AI-powered breakdown of this whale&apos;s trading style, risk profile, and recent performance.</p>
      )}

      {state === 'error' && (
        <p className="text-xs text-red-400">AI summary failed: {err}</p>
      )}

      {state === 'ok' && data && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-semibold">{data.rating_30d}/10 <span className="text-slate-500 font-normal">(30d)</span></span>
            <span className="font-semibold">{data.rating_10d}/10 <span className="text-slate-500 font-normal">(10d)</span></span>
            <span className={`font-semibold uppercase ${sentimentColor}`}>{data.sentiment}</span>
          </div>
          <p className="text-xs text-slate-300 italic">{data.style}</p>
          <p className="text-[13px] text-slate-200 leading-relaxed">{data.summary}</p>
        </div>
      )}
    </div>
  );
}

// WhaleAvatar moved to components/whales/WhaleAvatar.tsx (§4 phase B).

// ─── Audit B6 / P0 #7 — Holdings panel (was placeholder) ──────────────────

interface Holding {
  contract: string | null;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  priceUsd: number;
  valueUsd: number;
  logo: string | null;
}

function HoldingsPanel({ address, chain }: { address: string; chain: string }) {
  const [data, setData] = useState<{
    holdings: Holding[];
    total_value_usd: number;
    message?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/whales/${address}/holdings?chain=${encodeURIComponent(chain)}`, {
          signal: AbortSignal.timeout(15_000),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`Holdings ${res.status}`);
        const json = (await res.json()) as { holdings: Holding[]; total_value_usd: number; message?: string };
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load holdings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, chain]);

  if (loading) {
    return (
      <div className="rounded-xl nl-glass p-8 text-center text-sm text-slate-500">
        <Loader2 className="w-4 h-4 mx-auto mb-2 animate-spin" />
        Loading on-chain holdings…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
        Failed to load holdings: {error}
      </div>
    );
  }
  if (!data || (data.holdings.length === 0 && !data.message)) {
    return (
      <div className="rounded-xl nl-glass p-8 text-center text-sm text-slate-500">
        No holdings found for this wallet on {chain}.
      </div>
    );
  }
  if (data.message) {
    return (
      <div className="rounded-xl nl-glass p-8 text-center text-sm text-slate-500">
        {data.message}
      </div>
    );
  }

  // Deep-dive crash fix — type assertion on the json earlier could lie when
  // the API errored or returned a different shape. Validate both fields
  // before render so .map() never sees undefined and .length never throws.
  const holdings = Array.isArray(data?.holdings) ? data.holdings : [];
  const total = typeof data?.total_value_usd === 'number' ? data.total_value_usd : 0;
  if (holdings.length === 0) {
    return <div className="text-xs text-slate-500 py-6 text-center">No holdings indexed for this whale yet.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="rounded-xl nl-glass p-4 flex items-baseline justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Total holdings (priced)</p>
          <p className="text-2xl font-mono font-bold text-white">{fmtUsd(total)}</p>
        </div>
        <span className="text-[10px] text-slate-500">{holdings.length} tokens</span>
      </div>
      <div className="rounded-xl nl-glass overflow-hidden">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900/30 border-b border-slate-800">
            <tr>
              <th className="text-start px-3 py-2">Token</th>
              <th className="text-end px-3 py-2">Balance</th>
              <th className="text-end px-3 py-2">Price</th>
              <th className="text-end px-3 py-2">Value</th>
              <th className="text-end px-3 py-2">% of port</th>
            </tr>
          </thead>
          <tbody>
            {holdings.map((h) => {
              const pct = total > 0 ? (h.valueUsd / total) * 100 : 0;
              return (
                <tr key={h.contract ?? 'native'} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                  <td className="px-3 py-2 flex items-center gap-2">
                    {h.logo
                      ? <img src={h.logo} alt={h.symbol} className="w-5 h-5 rounded-full" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      : <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-300">{h.symbol.slice(0, 2)}</div>}
                    <div className="min-w-0">
                      <div className="font-mono text-white">{h.symbol}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px]">{h.name}</div>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-end font-mono text-slate-300 tabular-nums">
                    {h.balance < 1 ? h.balance.toFixed(6) : h.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-3 py-2 text-end font-mono text-slate-400 tabular-nums">
                    {h.priceUsd > 0 ? `$${h.priceUsd < 0.01 ? h.priceUsd.toExponential(2) : h.priceUsd.toFixed(4)}` : 'n/a'}
                  </td>
                  <td className="px-3 py-2 text-end font-mono text-white tabular-nums">{fmtUsd(h.valueUsd)}</td>
                  <td className="px-3 py-2 text-end">
                    <div className="inline-flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums w-10 text-end">{pct.toFixed(1)}%</span>
                    </div>
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

// ─── Audit B6 / P0 #7 — Counterparties panel (was placeholder) ────────────

interface ActivityRow {
  id: string;
  action: string;
  token_symbol: string | null;
  value_usd: number | null;
  counterparty: string | null;
  counterparty_label: string | null;
  timestamp: string;
}

interface CounterpartyAggregate {
  address: string;
  label: string | null;
  txCount: number;
  totalUsd: number;
  buys: number;
  sells: number;
  transfers: number;
  lastTimestamp: string;
}

function CounterpartiesPanel({ activity }: { activity: ActivityRow[] }) {
  // Audit B6 / P0 #7 — instead of waiting on a wallet_edges cron we
  // can derive counterparty graph entries directly from the activity
  // rows we already render in the Activity tab. Aggregating client-
  // side keeps the API surface unchanged and gives the user immediate
  // value (Arkham parity for the most common "who did this whale
  // trade with" question).
  const aggregates = useMemo<CounterpartyAggregate[]>(() => {
    const byAddr = new Map<string, CounterpartyAggregate>();
    for (const a of activity) {
      const key = a.counterparty;
      if (!key) continue;
      const prev = byAddr.get(key);
      if (prev) {
        prev.txCount += 1;
        prev.totalUsd += a.value_usd ?? 0;
        if (a.action === 'buy') prev.buys += 1;
        else if (a.action === 'sell') prev.sells += 1;
        else prev.transfers += 1;
        if (a.timestamp > prev.lastTimestamp) prev.lastTimestamp = a.timestamp;
      } else {
        byAddr.set(key, {
          address: key,
          label: a.counterparty_label,
          txCount: 1,
          totalUsd: a.value_usd ?? 0,
          buys: a.action === 'buy' ? 1 : 0,
          sells: a.action === 'sell' ? 1 : 0,
          transfers: a.action === 'transfer' ? 1 : 0,
          lastTimestamp: a.timestamp,
        });
      }
    }
    return Array.from(byAddr.values()).sort((a, b) => b.totalUsd - a.totalUsd);
  }, [activity]);

  if (aggregates.length === 0) {
    return (
      <div className="rounded-xl nl-glass p-8 text-center text-sm text-slate-500">
        No counterparties in the recorded activity yet.
      </div>
    );
  }

  return (
    <div className="rounded-xl nl-glass overflow-hidden">
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900/30 border-b border-slate-800">
          <tr>
            <th className="text-start px-3 py-2">Counterparty</th>
            <th className="text-end px-3 py-2">Txs</th>
            <th className="text-end px-3 py-2">Buy / Sell / Xfer</th>
            <th className="text-end px-3 py-2">Total USD</th>
            <th className="text-end px-3 py-2">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {aggregates.map((a) => (
            <tr key={a.address} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
              <td className="px-3 py-2">
                <div className="text-slate-300">{a.label ?? 'n/a'}</div>
                <div className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">{a.address}</div>
              </td>
              <td className="px-3 py-2 text-end font-mono text-white">{a.txCount}</td>
              <td className="px-3 py-2 text-end font-mono text-slate-400 text-[11px]">
                <span className="text-emerald-400">{a.buys}</span> /{' '}
                <span className="text-red-400">{a.sells}</span> /{' '}
                <span className="text-slate-300">{a.transfers}</span>
              </td>
              <td className="px-3 py-2 text-end font-mono text-white">{fmtUsd(a.totalUsd)}</td>
              <td className="px-3 py-2 text-end text-slate-500 text-[11px]">{relativeTime(a.lastTimestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Audit B6 / P1 #27 — CSV export of activity rows ──────────────────────

function downloadActivityCsv(address: string, chain: string, rows: ActivityRow[]) {
  // Standard CSV with quoted fields. Excel / Google Sheets / Pandas
  // all read this format without preamble. Quote-escapes any embedded
  // double-quotes in counterparty labels per RFC 4180.
  const headers = ['timestamp', 'action', 'token', 'value_usd', 'counterparty_label', 'counterparty_address'];
  const escape = (v: string | number | null): string => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map((r) => [
      r.timestamp,
      r.action,
      r.token_symbol ?? '',
      r.value_usd ?? '',
      r.counterparty_label ?? '',
      r.counterparty ?? '',
    ].map(escape).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `whale-${chain}-${address.slice(0, 8)}-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
