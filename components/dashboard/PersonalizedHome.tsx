"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Send,
  Eye,
  Bell,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { MiniVtxPanel } from "@/components/dashboard/MiniVtxPanel";
import { useAuth } from "@/lib/hooks/useAuth";
import { VerifiedGoldBadge } from "@/components/ui/VerifiedGoldBadge";
import { TierBadge } from "@/components/ui/TierBadge";
import { TelegramConnectBanner } from "@/components/dashboard/TelegramConnectBanner";
import { toast } from "sonner";

interface HomepageData {
  user: { id: string; email: string; displayName: string; tier: string; isVerified?: boolean; role?: string };
  wallets: Array<{ address: string; chain: string }>;
  watchlist: Array<{ token_id: string; chain: string }>;
  alertsToday: Array<{ id: string; name?: string; triggered_at?: string; type?: string }>;
  alertsCount: number;
  follows: Array<{ whale_address: string }>;
  recentVtx: Array<{
    id: string;
    title: string | null;
    updatedAt: string;
    lastMessage: unknown;
  }>;
}

// Per product direction (batch 12): greeting is always "Welcome" and
// the username follows. Previously we computed time-of-day greetings
// but that felt generic and the product wanted a consistent brand
// voice on dashboard load.
function greetingFor(_hour: number): string {
  return "Welcome";
}

export function PersonalizedHome() {
  const { user: authUser } = useAuth();
  const [data, setData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  // Compute greeting client-only so SSR (which runs in Vercel UTC) cannot
  // briefly show e.g. "Good evening" to a user whose local time is morning.
  const [greetingText, setGreetingText] = useState<string>("Welcome");
  const router = useRouter();
  useEffect(() => {
    setGreetingText(greetingFor(new Date().getHours()));
  }, []);

  // Tier-upgrade celebration toast: fires once per tier change. Stored in
  // localStorage by user id so we don't spam the same user every load and
  // don't congratulate the wrong account if multiple sign in on one device.
  useEffect(() => {
    const tier = (data?.user.tier ?? authUser?.tier ?? "free") as string;
    const uid = data?.user.id ?? authUser?.id;
    if (!uid || tier === "free") return;
    const key = `naka_tier_celebrated_${uid}`;
    const last = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (last === tier) return;
    const blurbs: Record<string, string> = {
      mini: "Mini unlocks the full Whale Tracker, multi-chain wallet intelligence and 100 VTX messages per day. ",
      pro:  "Pro unlocks unlimited VTX, copy trading, smart-money tracking, wallet clusters and the bubble map. ",
      max:  "Max unlocks the Sniper Bot, unlimited connected wallets and priority support. ",
    };
    const niceTier = tier.charAt(0).toUpperCase() + tier.slice(1);
    toast.success(`Congratulations! You are now ${niceTier} tier`, {
      description: `${blurbs[tier] ?? ""}You are set!`,
      duration: 8000,
    });
    if (typeof window !== "undefined") localStorage.setItem(key, tier);
  }, [data?.user.tier, data?.user.id, authUser?.tier, authUser?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 8s cap so a slow homepage API never strands the dashboard.
        const res = await fetch("/api/dashboard/homepage", {
          credentials: "include",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return;
        const json = (await res.json()) as HomepageData;
        if (!cancelled) setData(json);
      } catch (err) {
        // Network/timeout: render shell with auth user only. Sub-sections fetch
        // their own data lazily so the page stays usable.
        console.warn("[PersonalizedHome] homepage data unavailable, rendering shell:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // CRITICAL UX: never block the entire dashboard on the homepage data fetch.
  // Use the auth user (instantly available from useAuth) as fallback so the
  // shell renders in <100ms even if /api/dashboard/homepage is slow.
  // Greeting prefers username-style handles so a user whose last name is "For" never
  // renders as "Good evening, for". We never fall back to last_name.
  const displayName =
    authUser?.username ||
    data?.user.displayName ||
    authUser?.first_name ||
    authUser?.email?.split("@")[0] ||
    "trader";
  const isVerified = data?.user.isVerified ?? authUser?.is_verified ?? false;
  const userTier = (data?.user.tier ?? authUser?.tier ?? "free") as string;
  const walletsCount = data?.wallets.length ?? 0;
  const watchlistCount = data?.watchlist.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Greeting — renders immediately from auth user; enriched once API data arrives */}
      <div>
        <h1 className="text-base md:text-lg font-medium tracking-tight text-white flex items-center gap-2 font-heading">
          <span>
            {greetingText}, <span className="text-blue-400">{displayName}</span>
          </span>
          {/* Tier badge takes priority — Mini blue, Pro platinum, Max gold.
              Falls back to legacy gold "verified" mark if user has no paid
              tier but is_verified flag is set (manually-verified accounts). */}
          {userTier !== "free" ? (
            <TierBadge tier={userTier} size={18} />
          ) : isVerified ? (
            <VerifiedGoldBadge size={18} title="Verified by Naka Labs" />
          ) : null}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {loading ? (
            <span className="opacity-60">Loading your day...</span>
          ) : (
            <>
              {walletsCount} wallet{walletsCount === 1 ? "" : "s"} tracked · {watchlistCount} token
              {watchlistCount === 1 ? "" : "s"} watched
            </>
          )}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction icon={<ArrowLeftRight size={18} />} label="Swap" onClick={() => router.push("/dashboard/swap")} />
        <QuickAction icon={<Send size={18} />} label="Send" onClick={() => router.push("/dashboard/wallet-page?action=send")} />
        <QuickAction icon={<Eye size={18} />} label="Track Wallet" onClick={() => router.push("/dashboard/wallet-intelligence")} />
        <QuickAction icon={<Bell size={18} />} label="Set Alert" onClick={() => router.push("/dashboard/alerts")} />
      </div>

      {/* Notification (Telegram) — connect prompt; auto-hides once connected */}
      <TelegramConnectBanner />

      {/* Mini VTX panel */}
      <MiniVtxPanel
        displayName={displayName}
        recentSessions={(data?.recentVtx ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt,
        }))}
      />

      {/* Insights Row — 3 compact cards side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <InsightCard
          title="Alerts Today"
          count={data?.alertsCount ?? 0}
          countLabel={`${data?.alertsCount ?? 0} triggered`}
          preview={
            (data?.alertsToday ?? []).slice(0, 2).map((a) => ({
              id: a.id,
              label: a.name ?? "Alert triggered",
              sub: a.type ?? undefined,
            }))
          }
          emptyMessage="No alerts in the last 24 h"
          link={{ label: "View all", href: "/dashboard/alerts" }}
          accent="amber"
        />
        <InsightCard
          title="Watchlist"
          count={watchlistCount}
          countLabel={`${watchlistCount} token${watchlistCount === 1 ? "" : "s"}`}
          preview={(data?.watchlist ?? []).slice(0, 2).map((w) => ({
            id: `${w.chain}:${w.token_id}`,
            label: w.token_id,
            sub: w.chain.toUpperCase(),
          }))}
          emptyMessage="Watchlist is empty"
          link={{ label: "View all", href: "/market/watchlist" }}
          accent="blue"
        />
        <InsightCard
          title="Smart Money"
          count={data?.follows.length ?? 0}
          countLabel={`${data?.follows.length ?? 0} followed`}
          preview={(data?.follows ?? []).slice(0, 2).map((f) => ({
            id: f.whale_address,
            label: `${f.whale_address.slice(0, 6)}…${f.whale_address.slice(-4)}`,
            sub: "wallet",
          }))}
          emptyMessage="Follow wallets to track"
          link={{ label: "Explore", href: "/dashboard/smart-money" }}
          accent="purple"
        />
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900/80 transition group"
    >
      <span className="text-blue-400 group-hover:scale-110 transition">{icon}</span>
      <span className="text-xs font-medium text-slate-300 group-hover:text-white">{label}</span>
    </button>
  );
}

interface PreviewItem {
  id: string;
  label: string;
  sub?: string;
}

function InsightCard({
  title,
  count,
  countLabel,
  preview,
  emptyMessage,
  link,
  accent,
}: {
  title: string;
  count: number;
  countLabel: string;
  preview: PreviewItem[];
  emptyMessage: string;
  link: { label: string; href: string };
  accent: "amber" | "blue" | "purple";
}) {
  const accentMap = {
    amber: "text-amber-400 border-amber-500/30 bg-amber-500/5",
    blue: "text-blue-400 border-blue-500/30 bg-blue-500/5",
    purple: "text-purple-400 border-purple-500/30 bg-purple-500/5",
  } as const;

  return (
    <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition flex flex-col min-h-[160px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{title}</h3>
        {count > 0 && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${accentMap[accent]}`}>{countLabel}</span>
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        {preview.length === 0 ? (
          <p className="text-xs text-slate-600 italic">{emptyMessage}</p>
        ) : (
          preview.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-xs">
              <Wallet size={10} className="text-slate-600 flex-shrink-0" />
              <span className="text-slate-300 truncate flex-1">{p.label}</span>
              {p.sub && <span className="text-slate-600 text-[10px]">{p.sub}</span>}
            </div>
          ))
        )}
      </div>
      <Link href={link.href} className="text-xs text-blue-400 hover:text-blue-300 mt-3 inline-block">
        {link.label} →
      </Link>
    </div>
  );
}

export default PersonalizedHome;
