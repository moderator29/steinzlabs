"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Send,
  Sparkles,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Loader2,
  ArrowUpRight,
} from "lucide-react";
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

export function MiniVtxPanel({
  displayName,
  recentSessions,
  creditsUsed = 0,
  creditsLimit = 2000,
}: MiniVtxPanelProps) {
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
  const creditsPct = Math.min(100, (creditsUsed / creditsLimit) * 100);

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-white/[0.06] p-5 md:p-6"
      style={{
        background:
          "radial-gradient(1200px 400px at 0% 0%, rgba(26,58,204,0.12) 0%, transparent 50%), linear-gradient(180deg, rgba(12,17,32,0.9) 0%, rgba(8,11,22,0.9) 100%)",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, rgba(77,128,255,0.3), transparent 60%)" }}
      />

      <header className="relative flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <AgentAvatar size={40} />
          <div>
            <h2 className="text-[17px] md:text-[19px] font-semibold text-white tracking-tight leading-tight">
              What are you trading today?
            </h2>
            <p className="text-[12px] text-slate-500 mt-0.5 leading-snug">
              Ask VTX, <span className="text-slate-300">{displayName}</span>. Real-time on-chain intelligence.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/vtx-ai"
          className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition px-2.5 py-1 rounded-full border border-white/[0.06] hover:border-white/20 flex-shrink-0"
        >
          Open VTX <ArrowUpRight size={11} />
        </Link>
      </header>

      {/* Recent sessions (collapsed by default) */}
      {recentSessions.length > 0 && (
        <div className="relative mb-4">
          <button
            onClick={() => setSessionsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/10 transition"
          >
            <span className="flex items-center gap-2 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              <MessageSquare size={11} /> Recent sessions
              <span className="text-slate-600 normal-case tracking-normal">· {recentSessions.length}</span>
            </span>
            {sessionsOpen ? (
              <ChevronDown size={13} className="text-slate-500" />
            ) : (
              <ChevronRight size={13} className="text-slate-500" />
            )}
          </button>
          {sessionsOpen && (
            <div className="mt-2 space-y-1">
              {visibleSessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/dashboard/vtx-ai?conversation=${s.id}`}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.01] hover:bg-white/[0.04] border border-transparent hover:border-white/5 transition"
                >
                  <MessageSquare size={11} className="text-blue-400/80 flex-shrink-0" />
                  <span className="flex-1 text-[13px] text-slate-200 truncate">{s.title ?? "Untitled session"}</span>
                  <span className="text-[10px] text-slate-600 flex-shrink-0">
                    {new Date(s.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </Link>
              ))}
              {extraSessions > 0 && (
                <Link
                  href="/dashboard/vtx-ai"
                  className="block text-center text-[11px] text-blue-400 hover:text-blue-300 py-1.5 transition"
                >
                  View all {recentSessions.length} sessions →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Prompt input — elevated glass card */}
      <form onSubmit={handleSubmit} className="relative">
        <div
          className="relative rounded-2xl border border-white/[0.08] transition-colors focus-within:border-blue-500/40"
          style={{
            background: "linear-gradient(180deg, rgba(7,10,22,0.85) 0%, rgba(10,14,28,0.85) 100%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03), 0 8px 24px -12px rgba(0,0,0,0.6)",
          }}
        >
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask VTX anything — paste a token, a wallet, or a thesis…"
            rows={2}
            className="w-full px-4 pt-3.5 pb-2 pr-12 bg-transparent text-[14px] text-white placeholder-slate-600 resize-none focus:outline-none leading-relaxed"
          />
          <button
            type="submit"
            disabled={!prompt.trim() || submitting}
            className="absolute right-2.5 bottom-2.5 h-8 w-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
            style={{
              background: prompt.trim()
                ? "linear-gradient(135deg, #1a3acc, #0d1f88)"
                : "rgba(255,255,255,0.04)",
              boxShadow: prompt.trim() ? "0 0 16px rgba(26,58,204,0.35)" : "none",
              color: "white",
            }}
            aria-label="Send"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>

          {/* Toolbar row */}
          <div className="flex items-center gap-2 px-3 pb-2.5 pt-0.5 flex-wrap">
            <button
              type="button"
              onClick={() => setExpertMode((v) => !v)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition font-medium ${
                expertMode
                  ? "bg-blue-500/15 border-blue-500/40 text-blue-200"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/15 hover:text-slate-200"
              }`}
            >
              <Sparkles size={10} className="inline mr-1 -mt-0.5" />
              Expert
            </button>
            <button
              type="button"
              onClick={() => setTradeMode((v) => !v)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition font-medium ${
                tradeMode
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                  : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/15 hover:text-slate-200"
              }`}
            >
              Trade
            </button>

            {/* Credits pill — progress only (numeric counter hidden per product decision) */}
            <div className="ml-auto flex items-center gap-2">
              <div
                className="w-16 sm:w-20 h-1 rounded-full bg-white/[0.05] overflow-hidden flex-shrink-0"
                title={`${creditsUsed.toLocaleString()} / ${creditsLimit.toLocaleString()} credits used`}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${creditsPct}%`,
                    background: creditsPct > 80 ? "#ef4444" : "linear-gradient(90deg,#1a3acc,#4d80ff)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Featured prompt cards */}
      <div className="mt-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-slate-600 mb-2 font-semibold">Suggested</p>
        <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {promptCards.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePromptClick(p)}
              className="group flex-shrink-0 w-[220px] text-left p-3.5 rounded-xl border border-white/[0.06] hover:border-blue-500/30 transition-all"
              style={{
                background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00))",
              }}
            >
              {p.category && (
                <span className="text-[9px] uppercase tracking-[0.1em] text-blue-300/80 font-semibold">
                  {p.category}
                </span>
              )}
              <p className="text-[13px] text-white font-semibold mt-1 line-clamp-1">{p.title}</p>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{p.prompt}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-blue-400/70 group-hover:text-blue-300 transition">
                Ask VTX <ArrowUpRight size={9} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default MiniVtxPanel;
