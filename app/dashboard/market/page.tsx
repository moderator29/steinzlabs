"use client";

import { useState, useCallback, useEffect } from "react";
import { Search, SlidersHorizontal, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { useMarketData } from "@/hooks/market/useMarketData";
import { useWatchlist } from "@/hooks/market/useWatchlist";
import { CategoryPills } from "@/components/market/CategoryPills";
import { TopGainersBar } from "@/components/market/TopGainersBar";
import { TokenRow } from "@/components/market/TokenRow";
import { LoadingSkeleton } from "@/components/market/LoadingSkeleton";
import { ErrorState } from "@/components/market/ErrorState";

type CategoryId = "all" | "majors" | "defi" | "layer1" | "layer2" | "gaming" | "ai" | "meme" | "depin" | "pumpfun" | "bnb-meme";

interface ResolvedMatch {
  id: string | null;
  name: string;
  symbol: string;
  image: string | null;
  chain: string;
  address: string | null;
  priceUsd: number;
}

function looksLikeAddress(q: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(q) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
}

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

  // Smart search — if the user pastes a contract or types a ticker that
  // isn't in the current category, we ask /api/market/resolve for a match.
  const [resolved, setResolved] = useState<ResolvedMatch[]>([]);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setResolved([]); return; }
    // If the query clearly matches a token already in the table, skip the
    // server roundtrip.
    const ql = q.toLowerCase();
    const localHit = tokens.some((t) => t.symbol.toLowerCase() === ql || t.id === ql);
    if (localHit && !looksLikeAddress(q)) { setResolved([]); return; }

    let cancelled = false;
    const t = setTimeout(async () => {
      setResolving(true);
      try {
        const res = await fetch(`/api/market/resolve?q=${encodeURIComponent(q)}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { matches: ResolvedMatch[] };
        if (!cancelled) setResolved(json.matches ?? []);
      } catch {
        if (!cancelled) setResolved([]);
      } finally {
        if (!cancelled) setResolving(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, tokens]);

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
      // DexScreener-sourced tokens arrive as "<chain>:<contract>" (see
      // /api/market/dex-category). Route them to the terminal using the
      // explicit chain + address instead of the CoinGecko slug mapping.
      if (id.includes(':')) {
        const [chain, addr] = id.split(':');
        router.push(`/dashboard/market/${chain}/${addr}`);
        return;
      }
      router.push(`/dashboard/market/${chainFor(id)}/${id}`);
    },
    [router],
  );

  const handleResolvedClick = useCallback((m: ResolvedMatch) => {
    if (m.id) { router.push(`/dashboard/market/${chainFor(m.id)}/${m.id}`); return; }
    if (m.address) { router.push(`/dashboard/market/${m.chain}/${m.address}`); }
  }, [router]);

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
            placeholder="Search by name, ticker, or paste a contract address…"
            className="w-full bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-xl pl-9 pr-10 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-[#0A1EFF]/40 focus:shadow-[0_0_0_3px_rgba(10,30,255,0.08)] transition-all"
          />
          {resolving && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" size={14} />
          )}
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 text-sm transition-colors">
          <SlidersHorizontal size={14} />
          Filters
        </button>
      </div>

      <CategoryPills active={category} onChange={setCategory as (id: CategoryId) => void} />

      {resolved.length > 0 && (
        <div className="bg-slate-950/80 backdrop-blur-xl border border-[#0A1EFF]/30 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800/60 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#4D6BFF] font-semibold">
                {looksLikeAddress(search.trim()) ? 'Contract match' : 'Search results'}
              </p>
              <p className="text-[10px] text-slate-500">Click any result to open the trading terminal.</p>
            </div>
            <button onClick={() => setSearch('')} className="text-[11px] text-slate-500 hover:text-white">Clear</button>
          </div>
          <div className="divide-y divide-slate-800/40">
            {resolved.map((m, i) => (
              <button
                key={`${m.id ?? m.address}-${i}`}
                onClick={() => handleResolvedClick(m)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors text-left"
              >
                {m.image ? (
                  <img src={m.image} alt={m.symbol} className="w-7 h-7 rounded-full" onError={(e) => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-400">
                    {m.chain.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">{m.name}</div>
                  <div className="text-[10px] text-slate-500 uppercase">{m.symbol} · {m.chain}</div>
                </div>
                {m.priceUsd > 0 && (
                  <div className="text-sm text-white font-mono">${m.priceUsd < 0.01 ? m.priceUsd.toFixed(6) : m.priceUsd.toFixed(2)}</div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

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
