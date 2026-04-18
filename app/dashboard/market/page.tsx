"use client";

import { useState, useCallback } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMarketData } from "@/hooks/market/useMarketData";
import { useWatchlist } from "@/hooks/market/useWatchlist";
import { CategoryPills } from "@/components/market/CategoryPills";
import { TopGainersBar } from "@/components/market/TopGainersBar";
import { TokenRow } from "@/components/market/TokenRow";
import { LoadingSkeleton } from "@/components/market/LoadingSkeleton";
import { ErrorState } from "@/components/market/ErrorState";

type CategoryId = "all" | "majors" | "defi" | "layer1" | "layer2" | "gaming" | "ai" | "meme" | "depin";

const MAJOR_IDS = ["bitcoin", "ethereum", "solana", "binancecoin", "ripple", "cardano", "avalanche-2", "polkadot"];

/**
 * Map a CoinGecko token id to the chain segment used by the unified
 * terminal route. Solana-native and a few L1s get their own chain; the
 * rest default to 'ethereum'. Users who land on the terminal with a
 * specific chain in the URL keep that chain.
 */
function chainFor(id: string): string {
  switch (id) {
    case "solana":
      return "solana";
    case "binancecoin":
      return "bsc";
    case "avalanche-2":
      return "avalanche";
    case "matic-network":
      return "polygon";
    default:
      return "ethereum";
  }
}

export default function DashboardMarketPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [category, setCategory] = useState<CategoryId>("all");
  const [search, setSearch] = useState("");

  const { tokens, loading, error, refetch } = useMarketData({ category });
  const { isWatched, toggleWatchlist } = useWatchlist(user?.id ?? null);

  const filtered = tokens.filter((t) => {
    if (category === "majors") return MAJOR_IDS.includes(t.id);
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.symbol.toLowerCase().includes(q);
    }
    return true;
  });

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/dashboard/market/${chainFor(id)}/${id}`);
    },
    [router],
  );

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Market</h1>
          <p className="text-sm text-slate-400">Live prices across the top assets. Click any row to open its trading terminal.</p>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or symbol..."
            className="w-full bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-[#0A1EFF]/40 focus:shadow-[0_0_0_3px_rgba(10,30,255,0.08)] transition-all"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 text-sm transition-colors">
          <SlidersHorizontal size={14} />
          Filters
        </button>
      </div>

      <CategoryPills active={category} onChange={setCategory as (id: CategoryId) => void} />

      {!loading && tokens.length > 0 && <TopGainersBar tokens={tokens} onSelect={handleSelect} />}

      {loading ? (
        <LoadingSkeleton rows={10} />
      ) : error ? (
        <ErrorState message={error} onRetry={refetch} />
      ) : (
        <>
          <div className="hidden md:block bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wide border-b border-slate-800/60">
                  <th className="px-4 py-3 text-left w-12">#</th>
                  <th className="px-4 py-3 text-left">Coin</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">1H%</th>
                  <th className="px-4 py-3 text-right">24H%</th>
                  <th className="px-4 py-3 text-right">7D%</th>
                  <th className="px-4 py-3 text-right">24H Volume</th>
                  <th className="px-4 py-3 text-right">Market Cap</th>
                  <th className="px-4 py-3 text-right w-28">7D Chart</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((token, i) => (
                  <TokenRow
                    key={token.id}
                    token={token}
                    rank={i + 1}
                    isWatched={isWatched(token.id)}
                    onToggleWatch={(id) => toggleWatchlist(id)}
                    onClick={handleSelect}
                    variant="table"
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-xl overflow-hidden">
            {filtered.map((token, i) => (
              <TokenRow
                key={token.id}
                token={token}
                rank={i + 1}
                isWatched={isWatched(token.id)}
                onToggleWatch={(id) => toggleWatchlist(id)}
                onClick={handleSelect}
                variant="list"
              />
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              {search ? `"${search}" not found. Try a different name or symbol.` : "No tokens in this category."}
            </div>
          )}
        </>
      )}
    </div>
  );
}
