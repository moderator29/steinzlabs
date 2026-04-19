"use client";

/**
 * TelegramConnectBanner — dashboard prompt that nudges the user to
 * connect Telegram so they receive whale, price and copy-trade alerts in
 * their DMs. Auto-hides once linked. Tap → /settings/notifications which
 * has the full TelegramConnectCard with the 6-digit code flow.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { Send, ChevronRight, CheckCircle2 } from "lucide-react";

interface LinkStatus {
  linked: boolean;
  username: string | null;
}

export function TelegramConnectBanner() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/telegram/link-code", { credentials: "include" });
        if (!res.ok || cancelled) return;
        setStatus((await res.json()) as LinkStatus);
      } catch {
        /* silent */
      }
    })();
    setDismissed(typeof window !== "undefined" && sessionStorage.getItem("hide_tg_banner") === "1");
    return () => {
      cancelled = true;
    };
  }, []);

  if (status?.linked || dismissed) return null;

  return (
    <Link
      href="/settings/notifications#telegram"
      className="group relative flex items-center justify-between gap-3 rounded-xl border border-[#229ED9]/30 bg-gradient-to-r from-[#229ED9]/10 to-[#0A1EFF]/10 p-4 transition hover:border-[#229ED9]/60"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#229ED9]/15">
          <Send className="h-5 w-5 text-[#229ED9]" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Notification (Telegram)</span>
            <span className="rounded-full bg-[#229ED9]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#7BC8E5]">
              Recommended
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400 truncate">
            Get whale moves, price targets & copy-trade fills in your DMs. Takes 30 seconds.
          </p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#229ED9] transition group-hover:translate-x-0.5" />
    </Link>
  );
}

export function TelegramConnectedPill() {
  // Compact "Connected" badge variant if needed elsewhere
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
      <CheckCircle2 className="h-3 w-3" /> Telegram connected
    </span>
  );
}
