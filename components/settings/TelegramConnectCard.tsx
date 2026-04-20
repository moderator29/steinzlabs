"use client";

/**
 * TelegramConnectCard — user-facing UI for linking a Telegram account to
 * the Naka Labs bot. Drops into Settings → Notifications.
 *
 * Flow:
 *   1. Unlinked → "Connect Telegram" button → POST /api/telegram/link-code
 *   2. Shows a 6-digit code + "Open Bot" deep-link + copy button
 *   3. Polls GET /api/telegram/link-code every 3s; when `linked: true`
 *      flips to the connected state with "Disconnect" option.
 */

import { useEffect, useState, useCallback } from "react";
import { Send, Copy, CheckCircle2, ExternalLink, Unlink, Loader2 } from "lucide-react";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "Nakalabsbot";

interface LinkStatus {
  linked: boolean;
  username: string | null;
  linkedAt: string | null;
}

interface CodeResponse {
  code: string;
  expiresAt: string;
}

export function TelegramConnectCard() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/telegram/link-code", { credentials: "include" });
      if (res.ok) setStatus((await res.json()) as LinkStatus);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Poll every 3s while a code is active and we're not yet linked
  useEffect(() => {
    if (!code || status?.linked) return;
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [code, status?.linked, fetchStatus]);

  // Stop showing the code once linked
  useEffect(() => {
    if (status?.linked) setCode(null);
  }, [status?.linked]);

  const generateCode = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/telegram/link-code", { method: "POST", credentials: "include" });
      if (res.ok) {
        const json = (await res.json()) as CodeResponse;
        setCode(json.code);
        setExpiresAt(json.expiresAt);
      } else {
        // The old code silently ignored non-2xx responses, which is why the
        // button looked dead while the server kept returning 500 on the
        // UNIQUE constraint collision (chat_id=0 placeholder).
        const body = await res.json().catch(() => ({}));
        setGenError(body.error || `Failed (HTTP ${res.status}). Please try again.`);
      }
    } catch (err: any) {
      setGenError(err?.message || "Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const unlink = async () => {
    if (!confirm("Disconnect Telegram? You'll stop receiving alerts there.")) return;
    setUnlinking(true);
    try {
      // Server-side disconnect happens via the bot /unlink command, but we
      // can also clear from the app side by deleting the link row. Reuse the
      // POST endpoint with a fresh code to invalidate state, then the user
      // sends /unlink in the bot. Simplest: just delete via a dedicated API.
      // For now we surface the bot command to the user.
      alert("Open Telegram and send /unlink to @" + BOT_USERNAME + " to fully disconnect.");
    } finally {
      setUnlinking(false);
    }
  };

  // ─── UI ────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#0F1320] border border-[#1E2433] rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#229ED9]/10 flex items-center justify-center">
            <Send className="w-5 h-5 text-[#229ED9]" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">Telegram Notifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Get whale alerts, price moves, and copy-trade fills in your Telegram DMs.
            </p>
          </div>
        </div>
        {status?.linked ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Connected
          </span>
        ) : (
          <span className="text-[10px] text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded-full">Not connected</span>
        )}
      </div>

      {/* Connected state */}
      {status?.linked && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs bg-[#0A0E1A] rounded-lg px-3 py-2.5 border border-[#1E2433]">
            <div>
              <div className="text-gray-500">Linked as</div>
              <div className="text-white font-mono">@{status.username || "unknown"}</div>
            </div>
            <div className="text-right">
              <div className="text-gray-500">Since</div>
              <div className="text-gray-300">
                {status.linkedAt ? new Date(status.linkedAt).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://t.me/${BOT_USERNAME}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-[#229ED9] hover:bg-[#1e8bbf] text-white py-2 rounded-lg transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open Bot
            </a>
            <button
              onClick={unlink}
              disabled={unlinking}
              className="flex items-center justify-center gap-1.5 text-xs border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg transition disabled:opacity-50"
            >
              <Unlink className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Unlinked, no code yet */}
      {!status?.linked && !code && (
        <div className="space-y-3">
          <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside">
            <li>Tap <span className="text-white font-semibold">Generate Code</span> below.</li>
            <li>Open Telegram → search <span className="font-mono text-[#229ED9]">@{BOT_USERNAME}</span>.</li>
            <li>Send <span className="font-mono bg-[#0A0E1A] px-1.5 py-0.5 rounded">/link &lt;your-code&gt;</span> to the bot.</li>
          </ol>
          <button
            onClick={generateCode}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1e8bbf] text-white py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {generating ? "Generating…" : "Generate Connect Code"}
          </button>
          {genError && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {genError}
            </div>
          )}
        </div>
      )}

      {/* Code displayed, waiting for /link */}
      {!status?.linked && code && (
        <div className="space-y-3">
          <div className="text-center bg-gradient-to-br from-[#229ED9]/10 to-[#0A1EFF]/10 border border-[#229ED9]/30 rounded-xl py-4">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Your code</div>
            <div className="text-3xl font-bold font-mono text-white tracking-wider">{code}</div>
            <div className="text-[10px] text-gray-500 mt-1">
              Expires {expiresAt ? new Date(expiresAt).toLocaleTimeString() : "in 10 min"}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copyCode}
              className="flex items-center justify-center gap-1.5 text-xs border border-[#1E2433] text-gray-300 hover:text-white hover:border-[#229ED9]/40 py-2 rounded-lg transition"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy code"}
            </button>
            <a
              href={`https://t.me/${BOT_USERNAME}?start=link_${code}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs bg-[#229ED9] hover:bg-[#1e8bbf] text-white py-2 rounded-lg transition"
            >
              <Send className="w-3.5 h-3.5" /> Open Bot
            </a>
          </div>
          <p className="text-[10px] text-gray-500 text-center">
            Waiting for you to send <span className="font-mono text-gray-400">/link {code}</span> in Telegram…
          </p>
        </div>
      )}
    </div>
  );
}
