"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Network, Search } from "lucide-react";

interface EdgeRow {
  from_address: string;
  to_address: string;
  chain: string;
  edge_type: string;
  confidence: number;
  last_seen_at: string;
}

export default function WalletClustersIndexPage() {
  const [query, setQuery] = useState("");
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/clusters/recent");
        if (!res.ok) return;
        const json = (await res.json()) as { edges: EdgeRow[] };
        setEdges(json.edges ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function explore(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    window.location.href = `/dashboard/wallet-clusters/${query.trim()}`;
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Network size={22} className="text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold">Wallet Clusters</h1>
            <p className="text-xs text-slate-500">
              5 detection algorithms: direct transfer, common funding, coordinated trading, behavioral fingerprint, sybil pattern.
            </p>
          </div>
        </div>

        <form onSubmit={explore} className="flex gap-2 mb-8">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a wallet address to explore its cluster…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900/50 border border-slate-800 text-sm font-mono focus:outline-none focus:border-blue-500/40"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold transition">
            Explore cluster
          </button>
        </form>

        <div>
          <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Recent detected edges</h2>
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <Loader2 size={16} className="animate-spin text-blue-400" />
            </div>
          ) : edges.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Cluster analysis runs every 6 hours. Once whale-activity rows are populated, edges appear here.
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="text-left px-3 py-2">From</th>
                    <th className="text-left px-3 py-2">To</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Confidence</th>
                    <th className="text-left px-3 py-2">When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {edges.map((e, i) => (
                    <tr key={i} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                      <td className="px-3 py-2 font-mono text-white">
                        {e.from_address.slice(0, 8)}…{e.from_address.slice(-4)}
                      </td>
                      <td className="px-3 py-2 font-mono text-white">
                        {e.to_address.slice(0, 8)}…{e.to_address.slice(-4)}
                      </td>
                      <td className="px-3 py-2 text-[10px] uppercase text-slate-400">{e.edge_type}</td>
                      <td className="px-3 py-2 font-mono text-slate-300">{(e.confidence * 100).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-slate-500">{new Date(e.last_seen_at).toLocaleDateString()}</td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/wallet-clusters/${e.from_address}`}
                          className="text-[11px] text-blue-400 hover:underline"
                        >
                          explore →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
