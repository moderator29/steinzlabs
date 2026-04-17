"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Send, Eye, Bell, TrendingUp, TrendingDown, MessageSquare, Wallet } from "lucide-react";
import { NakaLoader } from "@/components/brand/NakaLoader";

interface HomepageData {
  user: { id: string; email: string };
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
    async function load() {
      try {
        const res = await fetch("/api/dashboard/homepage", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as HomepageData;
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <NakaLoader size={40} text="Loading your dashboard..." />;

  const username = data?.user.email?.split("@")[0] ?? "trader";

  return (
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-white">
          {greeting()}, <span className="text-blue-400">{username}</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {data?.wallets.length ?? 0} wallet{data?.wallets.length === 1 ? "" : "s"} tracked ·{" "}
          {data?.watchlist.length ?? 0} tokens watched
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <QuickAction icon={<ArrowLeftRight size={18} />} label="Swap" onClick={() => router.push("/dashboard/swap")} />
        <QuickAction icon={<Send size={18} />} label="Send" onClick={() => router.push("/dashboard/wallet-page?action=send")} />
        <QuickAction icon={<Eye size={18} />} label="Track Wallet" onClick={() => router.push("/dashboard/wallet-intelligence")} />
        <QuickAction icon={<Bell size={18} />} label="Set Alert" onClick={() => router.push("/dashboard/alerts")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <Section title="Alerts Today" count={data?.alertsCount ?? 0}>
            {(data?.alertsToday.length ?? 0) === 0 ? (
              <EmptyState
                message="No alerts triggered in the last 24 hours."
                cta={{ label: "Create an alert", href: "/dashboard/alerts" }}
              />
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {data!.alertsToday.map((a) => (
                  <div
                    key={a.id}
                    className="flex-shrink-0 w-64 p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Bell size={14} className="text-amber-400" />
                      <span className="text-xs uppercase text-amber-400 tracking-wide">{a.type ?? "Alert"}</span>
                    </div>
                    <p className="text-sm text-white line-clamp-2">{a.name ?? "Alert triggered"}</p>
                    {a.triggered_at && (
                      <p className="text-xs text-slate-500 mt-2">{new Date(a.triggered_at).toLocaleTimeString()}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Watchlist Movers" count={data?.watchlist.length ?? 0}>
            {(data?.watchlist.length ?? 0) === 0 ? (
              <EmptyState
                message="Your watchlist is empty."
                cta={{ label: "Browse markets", href: "/market" }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {data!.watchlist.slice(0, 3).map((w) => (
                  <Link
                    key={`${w.chain}:${w.token_id}`}
                    href={`/market/prices/${w.token_id}`}
                    className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition block"
                  >
                    <p className="text-xs uppercase text-slate-500 tracking-wide">{w.chain}</p>
                    <p className="text-sm text-white font-medium mt-1 truncate">{w.token_id}</p>
                  </Link>
                ))}
              </div>
            )}
          </Section>

          <Section title="Smart Money Digest">
            {(data?.follows.length ?? 0) === 0 ? (
              <EmptyState
                message="Follow whales to see their moves here."
                cta={{ label: "Explore smart money", href: "/dashboard/smart-money" }}
              />
            ) : (
              <div className="space-y-2">
                {data!.follows.slice(0, 3).map((f) => (
                  <Link
                    key={f.whale_address}
                    href={`/dashboard/wallet-intelligence?address=${f.whale_address}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition"
                  >
                    <Wallet size={16} className="text-blue-400" />
                    <code className="text-xs text-slate-300 font-mono truncate flex-1">{f.whale_address}</code>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Section title="Recent VTX Chats">
            {(data?.recentVtx.length ?? 0) === 0 ? (
              <EmptyState
                message="No recent chats yet."
                cta={{ label: "Ask VTX", href: "/dashboard/vtx-ai" }}
              />
            ) : (
              <div className="space-y-2">
                {data!.recentVtx.map((c) => (
                  <Link
                    key={c.id}
                    href={`/dashboard/vtx-ai?c=${c.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-blue-500/50 transition"
                  >
                    <MessageSquare size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{c.title ?? "Untitled conversation"}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(c.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm uppercase tracking-wide text-slate-500">{title}</h2>
        {typeof count === "number" && count > 0 && (
          <span className="text-xs text-slate-600">{count}</span>
        )}
      </div>
      {children}
    </section>
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

function EmptyState({ message, cta }: { message: string; cta: { label: string; href: string } }) {
  return (
    <div className="p-6 rounded-xl bg-slate-900/30 border border-dashed border-slate-800 text-center">
      <p className="text-sm text-slate-500 mb-3">{message}</p>
      <Link href={cta.href} className="inline-block text-xs text-blue-400 hover:text-blue-300">
        {cta.label} →
      </Link>
    </div>
  );
}

export default PersonalizedHome;
