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
} from "lucide-react";
import { NakaLoader } from "@/components/brand/NakaLoader";
import { MiniVtxPanel } from "@/components/dashboard/MiniVtxPanel";

interface HomepageData {
  user: { id: string; email: string; displayName: string; tier: string };
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function PersonalizedHome() {
  const [data, setData] = useState<HomepageData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/homepage", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as HomepageData;
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <NakaLoader size={40} text="Loading your dashboard..." />;

  const displayName = data?.user.displayName ?? "there";
  const walletsCount = data?.wallets.length ?? 0;
  const watchlistCount = data?.watchlist.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {greeting()}, <span className="text-blue-400">{displayName}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {walletsCount} wallet{walletsCount === 1 ? "" : "s"} tracked · {watchlistCount} token
          {watchlistCount === 1 ? "" : "s"} watched
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction icon={<ArrowLeftRight size={18} />} label="Swap" onClick={() => router.push("/dashboard/swap")} />
        <QuickAction icon={<Send size={18} />} label="Send" onClick={() => router.push("/dashboard/wallet-page?action=send")} />
        <QuickAction icon={<Eye size={18} />} label="Track Wallet" onClick={() => router.push("/dashboard/wallet-intelligence")} />
        <QuickAction icon={<Bell size={18} />} label="Set Alert" onClick={() => router.push("/dashboard/alerts")} />
      </div>

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
