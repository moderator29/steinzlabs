"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ExternalLink, CheckCircle2, Loader2, Copy } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { SecurityBadge } from "@/components/security/SecurityBadge";
import { WhaleAvatar } from "@/components/whales/WhaleAvatar";
import { toast } from "sonner";

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

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!isFinite(diff) || diff < 0) return "—";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtUsd(n: number | null): string {
  if (n === null) return "—";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
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

  const [fetchError, setFetchError] = useState<'auth' | 'tier' | 'notfound' | 'network' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/whales/${address}?chain=${encodeURIComponent(chain)}`);
        if (!res.ok) {
          // Bug §2.4: previously a failing fetch silently left data=null, which
          // rendered the bare "Whale not found" screen and users read it as a
          // crash. Surface the real reason so we can show something useful.
          if (res.status === 401) setFetchError('auth');
          else if (res.status === 403) setFetchError('tier');
          else if (res.status === 404) setFetchError('notfound');
          else setFetchError('network');
          return;
        }
        const json = (await res.json()) as WhaleDetail;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setFetchError('network');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A]">
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0E1A] text-slate-300 gap-4 px-6 text-center">
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
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 transition text-white"
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
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-30 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="mb-3"><BackButton href="/dashboard/whale-tracker" label="Whale tracker" /></div>
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
                <span className="uppercase">{w.chain}</span>
                {w.x_handle && (
                  <a href={`https://x.com/${w.x_handle}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                    @{w.x_handle} <ExternalLink size={9} />
                  </a>
                )}
              </div>
              </div>
            </div>
            <button
              onClick={toggleFollow}
              disabled={followingLoading}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                following ? "bg-slate-800 text-slate-300 hover:bg-slate-700" : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {followingLoading ? <Loader2 size={11} className="animate-spin" /> : following ? "Following" : "Follow"}
            </button>
          </div>

          <div className="mt-5 flex gap-1 border-b border-slate-800 -mb-px overflow-x-auto">
            {(["overview", "activity", "tokens", "counterparties", "copy"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-xs uppercase tracking-wide transition whitespace-nowrap ${
                  tab === t ? "text-blue-300 border-b-2 border-blue-500/60" : "text-slate-500 hover:text-white"
                }`}
              >
                {t === "copy" ? "Copy rules" : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <StatCard label="Portfolio" value={fmtUsd(w.portfolio_value_usd)} />
              <StatCard label="7d PnL" value={fmtUsd(w.pnl_7d_usd)} tone={(w.pnl_7d_usd ?? 0) >= 0 ? "up" : "down"} />
              <StatCard label="30d PnL" value={fmtUsd(w.pnl_30d_usd)} tone={(w.pnl_30d_usd ?? 0) >= 0 ? "up" : "down"} />
              <StatCard label="Win rate" value={w.win_rate !== null ? `${(w.win_rate * 100).toFixed(0)}%` : "—"} />
              <StatCard label="Trades (30d)" value={w.trade_count_30d?.toString() ?? "—"} />
              <StatCard label="Followers" value={data.followerCount.toLocaleString()} />
              <StatCard label="Entity" value={w.entity_type ?? "unknown"} />
              <StatCard label="Score" value={w.whale_score.toString()} />
              <StatCard label="First seen" value={w.first_seen_at ? new Date(w.first_seen_at).toLocaleDateString() : "—"} />
              <StatCard label="Last active" value={w.last_active_at ? relativeTime(w.last_active_at) : "—"} />
            </div>
            <AiSummarySection address={w.address} chain={w.chain} />
          </>
        )}

        {tab === "activity" && (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            {data.activity.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No recorded activity yet. The whale-activity-poll cron populates this as new on-chain events arrive.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="text-left px-3 py-2">Action</th>
                    <th className="text-left px-3 py-2">Token</th>
                    <th className="text-left px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">USD</th>
                    <th className="text-left px-3 py-2">Counterparty</th>
                    <th className="text-left px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.activity.map((a) => (
                    <tr key={a.id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                      <td className="px-3 py-2 uppercase text-[10px] text-slate-400">{a.action}</td>
                      <td className="px-3 py-2 font-mono text-white">{a.token_symbol ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{a.amount ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{fmtUsd(a.value_usd)}</td>
                      <td className="px-3 py-2 text-slate-400 truncate max-w-[140px]">{a.counterparty_label ?? a.counterparty ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500">{new Date(a.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "tokens" && (
          <div className="rounded-xl border border-slate-800 p-8 text-center text-sm text-slate-500">
            Token holdings will populate as the on-chain indexer ships in Session 5B-2.
          </div>
        )}

        {tab === "counterparties" && (
          <div className="rounded-xl border border-slate-800 p-8 text-center text-sm text-slate-500">
            Counterparty graph requires wallet_edges data. Run the cluster-analysis cron to populate.
          </div>
        )}

        {tab === "copy" && (
          <div className="rounded-xl border border-slate-800 p-8 text-center text-sm text-slate-500">
            Configure copy rules from <Link href="/dashboard/copy-trading" className="text-blue-400">/dashboard/copy-trading</Link>.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-xl bg-slate-900/50 border border-slate-800 p-3">
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
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/30 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] uppercase tracking-wider text-slate-500">AI Analysis</span>
        {state === 'idle' && (
          <button
            onClick={run}
            className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#0A1EFF] hover:bg-[#0A1EFF]/90 text-white"
          >
            Generate
          </button>
        )}
        {state === 'loading' && (
          <span className="ml-auto text-xs text-slate-400 inline-flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Analyzing…
          </span>
        )}
        {state === 'ok' && data?.cached && (
          <span className="ml-auto text-[10px] text-slate-500">cached · {new Date(data.generatedAt).toLocaleDateString()}</span>
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
