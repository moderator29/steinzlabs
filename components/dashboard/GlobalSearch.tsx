"use client";
import { useState, useEffect, useRef } from "react";
import { Search, X, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { NakaLoader } from "@/components/brand/NakaLoader";
import { resolveTokenChain } from "@/lib/market/tokenChainResolver";
import { ChainLogo } from "@/components/common/ChainLogo";
import { TokenLogo } from "@/components/market/TokenLogo";

interface SearchResult {
  type: "token" | "wallet" | "entity";
  id?: string;
  address?: string;
  chain?: string;
  label: string;
  subLabel?: string;
}

// Real on-chain token hit from the universal search API (/api/swap/token-search)
// — DexScreener + GeckoTerminal across every major EVM chain and Solana. Carries
// the contract address + a logo candidate so results render Uniswap-style: real
// art, symbol, name, truncated CA. Same shape the swap token selector consumes.
interface TokenHit {
  chain: string;
  address: string;
  symbol: string;
  name: string;
  logo: string | null;
  liquidityUsd: number;
  verified?: boolean;
}

const shortCa = (a: string) =>
  a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;

// Pull the ticker out of a dashboard/search label ("Bitcoin (BTC)") so a coin
// already surfaced as a rich on-chain token row isn't shown twice.
function labelSymbol(label: string): string | null {
  const m = label.match(/\(([^)]+)\)\s*$/);
  return m ? m[1].toUpperCase() : null;
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
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider flex-shrink-0 ${meta.bg} ${meta.text}`}>
      <ChainLogo chain={chain} size={11} />{meta.label}
    </span>
  );
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [tokenHits, setTokenHits] = useState<TokenHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setTokenHits([]);
      return;
    }
    // Guard against out-of-order responses: a slower earlier request must not
    // overwrite the results of a newer query. Only the latest in-flight effect
    // is allowed to commit state.
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // Two sources in parallel:
        //  - /api/dashboard/search  → wallets, entities, CoinGecko coins (majors)
        //  - /api/swap/token-search → ANY on-chain token by name or pasted CA,
        //    all networks, with real logos + verified flag (Uniswap-style).
        // A pasted contract address resolves through token-search too, since
        // DexScreener indexes tokens by address.
        const [dashRes, tokRes] = await Promise.all([
          fetch(`/api/dashboard/search?q=${encodeURIComponent(query)}`).catch(() => null),
          fetch(`/api/swap/token-search?q=${encodeURIComponent(query)}`).catch(() => null),
        ]);
        if (cancelled) return;
        const dashData = dashRes && dashRes.ok
          ? ((await dashRes.json()) as { results?: SearchResult[] })
          : { results: [] };
        const tokData = tokRes && tokRes.ok
          ? ((await tokRes.json()) as { tokens?: TokenHit[] })
          : { tokens: [] };
        if (cancelled) return;
        setResults(dashData.results ?? []);
        setTokenHits(Array.isArray(tokData.tokens) ? tokData.tokens.slice(0, 15) : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
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

  function reset() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setTokenHits([]);
  }

  function handleSelect(r: SearchResult) {
    reset();
    if (r.type === "token" && r.id) {
      const chain = resolveTokenChain({ id: r.id }).chain;
      router.push(`/dashboard/market/${chain}/${r.id}`);
    }
    else if (r.type === "wallet" && r.address)
      router.push(`/dashboard/wallet-intelligence?address=${r.address}&chain=${r.chain ?? ""}`);
    else if (r.type === "entity" && r.id) router.push(`/dashboard/wallet-clusters?cluster=${r.id}`);
  }

  // On-chain token hit → the canonical coin-detail terminal for that CA on its
  // real network, matching how the markets list routes DEX results.
  function handleSelectToken(t: TokenHit) {
    reset();
    router.push(`/dashboard/market/${t.chain}/${t.address}`);
  }

  // Drop dashboard/search rows already surfaced as a rich on-chain token row,
  // so a coin never appears twice. Wallets and entities always stay.
  const tokenSymbols = new Set(tokenHits.map((t) => t.symbol.toUpperCase()));
  const otherResults = results.filter(
    (r) => r.type !== "token" || !tokenSymbols.has(labelSymbol(r.label) ?? ""),
  );
  const hasAny = tokenHits.length > 0 || otherResults.length > 0;

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
          className="w-full ps-9 pe-16 py-2 rounded-lg nl-glass text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setTokenHits([]);
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
        <div className="absolute top-full left-0 right-0 mt-2 nl-glass rounded-xl shadow-2xl max-h-96 overflow-y-auto z-50">
          {loading && !hasAny ? (
            <div className="p-4">
              <NakaLoader size={24} subtle text="Searching..." />
            </div>
          ) : !hasAny ? (
            <div className="p-4 text-sm text-slate-500 text-center">No results</div>
          ) : (
            <>
              {/* Tokens — real on-chain results across every network, rendered
                  Uniswap-style: real logo, symbol, name, truncated CA. An
                  emerald check marks registry-verified contracts; there is no
                  "unverified" language for everything else. */}
              {tokenHits.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tokens</div>
                  {tokenHits.map((t) => (
                    <button
                      key={`tok-${t.chain}-${t.address}`}
                      onClick={() => handleSelectToken(t)}
                      className="w-full text-start px-4 py-3 hover:bg-slate-800/50 border-b border-slate-800 last:border-0 flex items-center gap-3"
                    >
                      <TokenLogo src={t.logo ?? undefined} symbol={t.symbol} address={t.address} chain={t.chain} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-white truncate">{t.symbol}</span>
                          {t.verified && (
                            <span title="Verified contract" className="inline-flex items-center gap-0.5 text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20 rounded px-1 py-px flex-shrink-0">
                              <CheckCircle className="w-2.5 h-2.5" /> Verified
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{t.name} · {shortCa(t.address)}</div>
                      </div>
                      <ChainBadge chain={t.chain} />
                    </button>
                  ))}
                </>
              )}

              {/* Wallets, entities, and CoinGecko coins not already shown as a
                  rich token row above — kept in their own group, unchanged. */}
              {otherResults.length > 0 && (
                <>
                  {tokenHits.length > 0 && (
                    <div className="px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">More results</div>
                  )}
                  {otherResults.map((r, i) => (
                    <button
                      key={`${r.type}-${r.id ?? r.address}-${i}`}
                      onClick={() => handleSelect(r)}
                      className="w-full text-start px-4 py-3 hover:bg-slate-800/50 border-b border-slate-800 last:border-0 flex items-center gap-3 group"
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
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default GlobalSearch;
