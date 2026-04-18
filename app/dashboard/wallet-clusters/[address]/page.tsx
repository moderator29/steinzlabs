"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { Cluster2DGraph } from "@/components/clusters/Cluster2DGraph";
import { SecurityBadge } from "@/components/security/SecurityBadge";
import { toast } from "sonner";

type Tab = "graph" | "members" | "labels";

interface ClusterData {
  rootAddress: string;
  clusterKey: string;
  memberCount: number;
  members: Array<{
    address: string;
    label: string | null;
    entity_type: string | null;
    whale_score: number;
    verified: boolean;
  }>;
  edges: Array<{ from_address: string; to_address: string; edge_type: string; confidence: number }>;
  labels: Array<{
    id: string;
    label: string;
    description: string | null;
    upvotes: number;
    downvotes: number;
    status: string;
    ai_generated: boolean;
  }>;
}

export default function ClusterDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const [data, setData] = useState<ClusterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("graph");
  const [labelForm, setLabelForm] = useState({ label: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch(`/api/clusters/${address}`);
    if (res.ok) {
      const json = (await res.json()) as ClusterData;
      setData(json);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  async function vote(id: string, v: 1 | -1) {
    const res = await fetch(`/api/clusters/labels/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote: v }),
    });
    if (res.ok) load();
    else toast.error("Vote failed");
  }

  async function submitLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !labelForm.label.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/clusters/${address}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cluster_key: data.clusterKey, ...labelForm }),
      });
      if (res.ok) {
        toast.success("Label submitted");
        setLabelForm({ label: "", description: "" });
        load();
      } else toast.error("Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A]">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A] text-slate-500">Cluster not found</div>;
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white pb-20">
      <div className="sticky top-0 z-30 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link href="/dashboard/wallet-clusters" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition mb-3">
            <ArrowLeft size={12} /> Wallet clusters
          </Link>
          <h1 className="text-xl md:text-2xl font-bold">Cluster · {data.memberCount} wallets</h1>
          <p className="text-xs text-slate-500 mt-1">
            Root: <code className="font-mono">{data.rootAddress}</code>
          </p>
          <div className="mt-4 flex gap-1 border-b border-slate-800 -mb-px">
            {(["graph", "members", "labels"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-xs uppercase tracking-wide transition ${
                  tab === t ? "text-blue-300 border-b-2 border-blue-500/60" : "text-slate-500 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {tab === "graph" && (
          <div>
            <div className="flex items-center gap-3 mb-3 text-[10px] flex-wrap">
              <LegendDot label="Direct transfer" color="#4d80ff" />
              <LegendDot label="Common funding" color="#a855f7" />
              <LegendDot label="Coordinated trading" color="#f59e0b" />
              <LegendDot label="Behavioral" color="#22c55e" />
              <LegendDot label="Sybil pattern" color="#ef4444" />
              <span className="ml-auto text-slate-600">
                3D immersive view deferred to Session 5C
              </span>
            </div>
            <Cluster2DGraph rootAddress={data.rootAddress} members={data.members} edges={data.edges} />
          </div>
        )}

        {tab === "members" && (
          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500 bg-slate-900/30 border-b border-slate-800">
                <tr>
                  <th className="text-left px-3 py-2">Address</th>
                  <th className="text-left px-3 py-2">Label</th>
                  <th className="text-left px-3 py-2">Entity</th>
                  <th className="text-left px-3 py-2">Score</th>
                  <th className="text-left px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.address} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-white">{m.address.slice(0, 10)}…{m.address.slice(-6)}</td>
                    <td className="px-3 py-2 text-slate-300 flex items-center gap-1">
                      {m.label ?? "—"}
                      {m.verified && <CheckCircle2 size={11} className="text-blue-400" />}
                    </td>
                    <td className="px-3 py-2 text-[10px] uppercase text-slate-500">{m.entity_type ?? "—"}</td>
                    <td className="px-3 py-2">
                      {m.whale_score > 0 && <SecurityBadge score={m.whale_score} size="sm" compact />}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/dashboard/whale-tracker/${m.address}`} className="text-[11px] text-blue-400 hover:underline">
                        open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "labels" && (
          <div className="space-y-4">
            <form onSubmit={submitLabel} className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-3 font-semibold">Propose a label</p>
              <input
                className="w-full px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-sm mb-2 focus:outline-none focus:border-blue-500/40"
                placeholder="e.g. a16z Crypto Fund"
                value={labelForm.label}
                onChange={(e) => setLabelForm({ ...labelForm, label: e.target.value })}
              />
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-slate-950/50 border border-slate-800 text-sm mb-3 focus:outline-none focus:border-blue-500/40"
                rows={2}
                placeholder="Why this label? (optional)"
                value={labelForm.description}
                onChange={(e) => setLabelForm({ ...labelForm, description: e.target.value })}
              />
              <button
                type="submit"
                disabled={submitting || !labelForm.label.trim()}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-xs font-semibold transition"
              >
                {submitting ? "Submitting…" : "Submit label"}
              </button>
            </form>

            {data.labels.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No labels yet. Be the first to propose one.</p>
            ) : (
              <div className="space-y-2">
                {data.labels.map((l) => (
                  <div key={l.id} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-sm">{l.label}</span>
                        {l.ai_generated && (
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            AI
                          </span>
                        )}
                        <span
                          className={`text-[9px] uppercase px-1.5 py-0.5 rounded border ${
                            l.status === "approved"
                              ? "bg-green-500/15 text-green-300 border-green-500/30"
                              : l.status === "rejected"
                                ? "bg-red-500/15 text-red-300 border-red-500/30"
                                : "bg-slate-800/50 text-slate-400 border-slate-700"
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                      {l.description && <p className="text-xs text-slate-400">{l.description}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => vote(l.id, 1)} className="p-1.5 rounded text-slate-500 hover:text-green-400 transition">
                        <ThumbsUp size={12} />
                      </button>
                      <span className="text-xs font-mono text-slate-300 min-w-[24px] text-center">{l.upvotes - l.downvotes}</span>
                      <button onClick={() => vote(l.id, -1)} className="p-1.5 rounded text-slate-500 hover:text-red-400 transition">
                        <ThumbsDown size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LegendDot({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
