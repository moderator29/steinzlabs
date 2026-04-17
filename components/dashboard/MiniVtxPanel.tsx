"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Sparkles, ChevronDown, ChevronRight, MessageSquare, Loader2 } from "lucide-react";
import { AgentAvatar } from "@/components/brand/AgentAvatar";

interface PromptCard {
  id: string;
  title: string;
  prompt: string;
  category?: string | null;
}

interface RecentSession {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface MiniVtxPanelProps {
  displayName: string;
  recentSessions: RecentSession[];
  creditsUsed?: number;
  creditsLimit?: number;
}

const FALLBACK_PROMPTS: PromptCard[] = [
  { id: "fb1", title: "Whale activity", prompt: "Show me the biggest whale moves in the last 24 hours across ETH and SOL.", category: "Whales" },
  { id: "fb2", title: "Rug check", prompt: "Scan this token for rug pull risks and contract red flags.", category: "Security" },
  { id: "fb3", title: "Smart money", prompt: "Which wallets are smart money accumulating right now?", category: "Smart Money" },
  { id: "fb4", title: "Trending", prompt: "What narratives and tokens are trending on-chain this week?", category: "Narrative" },
  { id: "fb5", title: "Portfolio", prompt: "Analyze my wallet performance and suggest rebalancing.", category: "Portfolio" },
];

export function MiniVtxPanel({ displayName, recentSessions, creditsUsed = 0, creditsLimit = 2000 }: MiniVtxPanelProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [expertMode, setExpertMode] = useState(false);
  const [tradeMode, setTradeMode] = useState(false);
  const [promptCards, setPromptCards] = useState<PromptCard[]>(FALLBACK_PROMPTS);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/vtx/prompts");
        if (!res.ok) return;
        const json = (await res.json()) as { prompts?: PromptCard[] };
        if (!cancelled && Array.isArray(json.prompts) && json.prompts.length > 0) {
          setPromptCards(json.prompts.slice(0, 5));
        }
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    const params = new URLSearchParams({ q: prompt.trim() });
    if (expertMode) params.set("expert", "1");
    if (tradeMode) params.set("trade", "1");
    router.push(`/dashboard/vtx-ai?${params.toString()}`);
  }

  function handlePromptClick(p: PromptCard) {
    setSubmitting(true);
    const params = new URLSearchParams({ q: p.prompt });
    router.push(`/dashboard/vtx-ai?${params.toString()}`);
  }

  const visibleSessions = recentSessions.slice(0, 5);
  const extraSessions = Math.max(0, recentSessions.length - 5);

  return (
    <section className="rounded-2xl bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-blue-500/15 p-5 md:p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <AgentAvatar size={36} />
          <div>
            <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
              What are you trading today
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">BETA</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Ask VTX, {displayName}. Real-time on-chain intelligence.</p>
          </div>
        </div>
      </div>

      {/* Recent Sessions collapsed header */}
      {recentSessions.length > 0 && (
        <div className="mb-3">
          <button
            onClick={() => setSessionsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-blue-500/30 transition"
          >
            <span className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <MessageSquare size={12} /> Recent sessions
              <span className="text-slate-600">({recentSessions.length})</span>
            </span>
            {sessionsOpen ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
          </button>
          {sessionsOpen && (
            <div className="mt-2 space-y-1">
              {visibleSessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/vtx-ai?conversation=${s.id}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/40 hover:bg-slate-900/70 border border-transparent hover:border-slate-800 transition"
                >
                  <MessageSquare size={12} className="text-blue-400 flex-shrink-0" />
                  <span className="flex-1 text-sm text-white truncate">{s.title ?? "Untitled session"}</span>
                  <span className="text-xs text-slate-600">{new Date(s.updatedAt).toLocaleDateString()}</span>
                </Link>
              ))}
              {extraSessions > 0 && (
                <Link
                  href="/dashboard/vtx-ai"
                  className="block text-center text-xs text-blue-400 hover:text-blue-300 py-2"
                >
                  View all {recentSessions.length} sessions →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prompt input */}
      <form onSubmit={handleSubmit} className="mb-3">
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask VTX anything..."
            rows={2}
            className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-950/60 border border-slate-800 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500/50"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || submitting}
            className="absolute right-3 bottom-3 w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition"
            aria-label="Send"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <button
            type="button"
            onClick={() => setExpertMode((v) => !v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              expertMode
                ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            <Sparkles size={10} className="inline mr-1" /> Expert mode
          </button>
          <button
            type="button"
            onClick={() => setTradeMode((v) => !v)}
            className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
              tradeMode
                ? "bg-green-500/20 border-green-500/40 text-green-300"
                : "bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
          >
            Trade
          </button>
          <span className="text-[11px] text-slate-600 ml-auto">
            {creditsUsed}/{creditsLimit} credits
          </span>
        </div>
      </form>

      {/* Featured prompt cards */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {promptCards.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePromptClick(p)}
            className="flex-shrink-0 w-56 p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/40 hover:bg-slate-900 transition text-left"
          >
            {p.category && (
              <span className="text-[9px] uppercase tracking-wide text-blue-400 font-semibold">{p.category}</span>
            )}
            <p className="text-sm text-white font-medium mt-1 line-clamp-1">{p.title}</p>
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.prompt}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export default MiniVtxPanel;
