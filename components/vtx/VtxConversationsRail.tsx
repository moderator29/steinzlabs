"use client";

/**
 * VtxConversationsRail — persistent left sidebar for desktop VTX layout.
 *
 * Mirrors the existing mobile chat-history dropdown but as a fixed 280px column
 * that's always visible on lg: and up. On smaller screens this component
 * returns null (mobile keeps the existing top-bar dropdown).
 *
 * Pure presentation — owner of state passes sessions and handlers in.
 */

import { Clock, MessageSquarePlus, Bot } from "lucide-react";
import SteinzLogo from "@/components/ui/SteinzLogo";

export interface VtxChatSessionSummary {
  id: string;
  date: string | number;
  preview: string;
}

interface Props {
  sessions: VtxChatSessionSummary[];
  activeSessionId?: string | null;
  onSelect: (session: VtxChatSessionSummary) => void;
  onNewChat: () => void;
  isPro?: boolean;
  remainingMessages?: number;
  totalMessages?: number;
}

export function VtxConversationsRail({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  isPro,
  remainingMessages,
  totalMessages,
}: Props) {
  return (
    <aside
      className="hidden lg:flex flex-col w-[280px] flex-shrink-0 bg-[#080C16] border-r border-white/[0.04]"
      aria-label="Chat history"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#0A1EFF]/20 to-[#4F46E5]/20 border border-[#0A1EFF]/20">
            <Bot className="w-4 h-4 text-[#0A1EFF]" />
          </div>
          <span className="text-xs font-bold tracking-tight">VTX Agent</span>
          {isPro && (
            <span className="px-1.5 py-0.5 bg-[#0A1EFF]/15 border border-[#0A1EFF]/30 rounded text-[9px] text-[#0A1EFF] font-bold">PRO</span>
          )}
        </div>
      </div>

      {/* New chat button */}
      <div className="px-3 pt-3 flex-shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#0A1EFF]/10 border border-[#0A1EFF]/30 hover:bg-[#0A1EFF]/20 hover:border-[#0A1EFF]/50 rounded-lg text-xs font-semibold text-[#0A1EFF] transition-colors"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          New chat
        </button>
        {!isPro && typeof remainingMessages === "number" && typeof totalMessages === "number" && (
          <p className="text-[10px] text-gray-600 text-center mt-2">
            {remainingMessages}/{totalMessages} messages left today
          </p>
        )}
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto mt-4 px-2 pb-3 min-h-0">
        <div className="px-2 mb-2">
          <span className="text-[10px] uppercase tracking-widest text-gray-600 font-bold">Recent</span>
        </div>
        {sessions.length === 0 ? (
          <div className="text-center py-8 px-3">
            <SteinzLogo size={32} animated={false} />
            <p className="text-[11px] text-gray-600 mt-3">No conversations yet.</p>
            <p className="text-[10px] text-gray-700 mt-1">Start by asking VTX anything.</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = activeSessionId === session.id;
              return (
                <button
                  key={session.id}
                  onClick={() => onSelect(session)}
                  className={`w-full text-left p-2.5 rounded-lg transition-all border ${
                    isActive
                      ? "bg-[#0A1EFF]/10 border-[#0A1EFF]/40"
                      : "bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Clock className="w-2.5 h-2.5 text-gray-600 flex-shrink-0" />
                    <span className="text-[9px] text-gray-600">
                      {new Date(session.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-gray-300 line-clamp-2 leading-snug">
                    {session.preview}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
