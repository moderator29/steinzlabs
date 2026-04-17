"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Loader2, Filter } from "lucide-react";
import { WhaleCard, type WhaleSummary } from "@/components/whales/WhaleCard";
import { NakaLoader } from "@/components/brand/NakaLoader";

const CHAINS = ["all", "ethereum", "base", "arbitrum", "polygon", "bsc", "solana"];
const ENTITY_TYPES = ["all", "vc", "trader", "fund", "exchange", "dev", "influencer", "institutional"];

export default function WhaleTrackerPage() {
  const [whales, setWhales] = useState<WhaleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [chain, setChain] = useState("all");
  const [entityType, setEntityType] = useState("all");
  const [offset, setOffset] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (reset: boolean) => {
      const useOffset = reset ? 0 : offset;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const params = new URLSearchParams({ offset: String(useOffset), limit: "30" });
        if (q) params.set("q", q);
        if (chain !== "all") params.set("chain", chain);
        if (entityType !== "all") params.set("entity_type", entityType);
        const res = await fetch(`/api/whales?${params}`);
        if (!res.ok) return;
        const data = (await res.json()) as { whales: WhaleSummary[]; total: number };
        if (reset) {
          setWhales(data.whales);
          setOffset(data.whales.length);
        } else {
          setWhales((prev) => [...prev, ...data.whales]);
          setOffset((prev) => prev + data.whales.length);
        }
        setTotal(data.total);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [q, chain, entityType, offset],
  );

  useEffect(() => {
    const t = setTimeout(() => load(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, chain, entityType]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !loadingMore && whales.length < total) {
          void load(false);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loading, loadingMore, whales.length, total, load]);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-30 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-xl md:text-2xl font-bold">Whale Tracker</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {total.toLocaleString()} tracked whales · real public wallets from VCs, exchanges, funds, traders
          </p>
          <div className="mt-4 flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by label or address…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-sm focus:outline-none focus:border-blue-500/40"
              />
            </div>
            <div className="flex gap-2">
              <select value={chain} onChange={(e) => setChain(e.target.value)} className="px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-xs capitalize">
                {CHAINS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={entityType} onChange={(e) => setEntityType(e.target.value)} className="px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-xs capitalize">
                {ENTITY_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <a
                href="/dashboard/whale-tracker/submit"
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold transition whitespace-nowrap"
              >
                Submit whale
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading && whales.length === 0 ? (
          <NakaLoader text="Loading whales..." />
        ) : whales.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
            <Filter size={22} className="text-slate-700" />
            No whales match those filters
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {whales.map((w) => (
                <WhaleCard key={`${w.chain}:${w.address}`} whale={w} />
              ))}
            </div>
            <div ref={sentinelRef} className="py-8 flex items-center justify-center">
              {loadingMore && <Loader2 size={14} className="animate-spin text-blue-400" />}
              {!loadingMore && whales.length >= total && whales.length > 0 && (
                <span className="text-xs text-slate-600">End of list</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
