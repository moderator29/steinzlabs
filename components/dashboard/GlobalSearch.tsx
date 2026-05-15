"use client";
import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { NakaLoader } from "@/components/brand/NakaLoader";

interface SearchResult {
  type: "token" | "wallet" | "entity";
  id?: string;
  address?: string;
  chain?: string;
  label: string;
  subLabel?: string;
}

// F4 polish — per-chain badge palette so search results instantly
// telegraph which chain each hit lives on. Colors mirror the chain
// brand swatches used elsewhere in the platform.
const CHAIN_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  ethereum: { label: 'ETH',   bg: 'bg-[#627EEA]/15', text: 'text-[#8FA3FF]' },
  base:     { label: 'BASE',  bg: 'bg-[#0052FF]/15', text: 'text-[#5B8AFF]' },
  arbitrum: { label: 'ARB',   bg: 'bg-[#28A0F0]/15', text: 'text-[#5BBFFF]' },
  optimism: { label: 'OP',    bg: 'bg-[#FF0420]/15', text: 'text-[#FF5A6E]' },
  polygon:  { label: 'POLY',  bg: 'bg-[#8247E5]/15', text: 'text-[#A88BFF]' },
  bsc:      { label: 'BSC',   bg: 'bg-[#F0B90B]/15', text: 'text-[#F0CC4D]' },
  avalanche:{ label: 'AVAX',  bg: 'bg-[#E84142]/15', text: 'text-[#FF6B6C]' },
  solana:   { label: 'SOL',   bg: 'bg-[#9945FF]/15', text: 'text-[#C49DFF]' },
};

function ChainBadge({ chain }: { chain: string }) {
  const meta = CHAIN_BADGE[chain.toLowerCase()];
  if (!meta) {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-800/60 text-slate-400 flex-shrink-0">
        {chain.slice(0, 4)}
      </span>
    );
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider flex-shrink-0 ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dashboard/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as { results: SearchResult[] };
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSelect(r: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    if (r.type === "token" && r.id) router.push(`/dashboard/market/ethereum/${r.id}`);
    else if (r.type === "wallet" && r.address)
      router.push(`/dashboard/wallet-intelligence?address=${r.address}&chain=${r.chain ?? ""}`);
    else if (r.type === "entity" && r.id) router.push(`/dashboard/wallet-clusters?cluster=${r.id}`);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search tokens, wallets, entities..."
          className="w-full pl-9 pr-16 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700 font-mono">
          ⌘K
        </kbd>
      </div>
      {open && (query.length >= 2 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-96 overflow-y-auto z-50">
          {loading ? (
            <div className="p-4">
              <NakaLoader size={24} subtle text="Searching..." />
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-sm text-slate-500 text-center">No results</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.type}-${r.id ?? r.address}-${i}`}
                onClick={() => handleSelect(r)}
                className="w-full text-left px-4 py-3 hover:bg-slate-800/50 border-b border-slate-800 last:border-0 flex items-center gap-3 group"
              >
                <span className="text-[10px] uppercase tracking-wide text-slate-500 w-14 flex-shrink-0 group-hover:text-slate-400 transition-colors">
                  {r.type}
                </span>
                <span className="flex-1 text-white text-sm truncate">{r.label}</span>
                {/* F4 polish — chain badge so users instantly see Base /
                    Arbitrum / Polygon hits, not just an opaque
                    "ETHEREUM" assumption. Color-coded per chain to
                    match the rest of the platform's chain affordances. */}
                {r.chain && <ChainBadge chain={r.chain} />}
                {r.subLabel && <span className="text-xs text-slate-500 truncate">{r.subLabel}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
