"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Loader2, Eye, MessageSquare } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { AgentAvatar } from "@/components/brand/AgentAvatar";

interface Shared {
  snapshot: { title: string | null; messages: Array<{ role: "user" | "assistant"; content: string; timestamp?: number }> };
  views: number;
  created_at: string;
}

export default function SharedConversationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<Shared | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/vtx/shared/${token}`);
        if (!res.ok) {
          setError(res.status === 410 ? "This shared conversation has expired." : "Conversation not found.");
          return;
        }
        setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0E1A]">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0E1A] text-slate-400 gap-3">
        <p>{error ?? "Not found"}</p>
        <Link href="/" className="text-blue-400 text-sm">
          ← Naka Labs home
        </Link>
      </div>
    );
  }

  const { snapshot, views } = data;

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-white">
      <div className="sticky top-0 z-30 bg-[#0A0E1A]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <BackButton href="/dashboard" label="Naka Labs" />
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Eye size={11} /> {views} views
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-5">
          <MessageSquare size={15} className="text-blue-400" />
          <h1 className="text-lg md:text-xl font-bold text-white">{snapshot.title ?? "Shared VTX session"}</h1>
        </div>

        <div className="space-y-4">
          {snapshot.messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              {m.role === "assistant" ? <AgentAvatar size={30} /> : <div className="w-[30px] h-[30px] rounded-xl bg-slate-800 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{m.role === "assistant" ? "VTX" : "You"}</p>
                <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-500">
          This is a read-only snapshot shared by a Naka Labs user.{" "}
          <Link href="/signup" className="text-blue-400 hover:underline">
            Create an account
          </Link>{" "}
          to chat with VTX live.
        </div>
      </div>
    </div>
  );
}
