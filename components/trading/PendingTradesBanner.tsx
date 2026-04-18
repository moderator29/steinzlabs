"use client";

import { useCallback, useEffect, useState } from "react";

interface PendingTrade {
  id: string;
  source_reason:
    | "limit_order"
    | "dca"
    | "stop_loss"
    | "take_profit"
    | "trail_stop"
    | "copy_trade";
  chain: string;
  wallet_source: "external_evm" | "external_solana" | "builtin";
  from_token_address: string;
  from_token_symbol: string | null;
  to_token_address: string;
  to_token_symbol: string | null;
  amount_in: string;
  expected_amount_out: string | null;
  expected_price_usd: number | null;
  route_provider: string | null;
  security_trust_score: number | null;
  security_is_honeypot: boolean | null;
  expires_at: string;
}

const REASON_LABEL: Record<PendingTrade["source_reason"], string> = {
  limit_order: "Limit order",
  dca: "DCA",
  stop_loss: "Stop-loss",
  take_profit: "Take-profit",
  trail_stop: "Trailing stop",
  copy_trade: "Copy trade",
};

const POLL_INTERVAL_MS = 20_000;

async function signAndBroadcast(trade: PendingTrade): Promise<{ txHash: string } | null> {
  // Client-side signing entry point. Delegates to the user's connected wallet.
  // The actual wallet provider integration (MetaMask / Phantom / builtin
  // in-browser signer) is owned by the existing swap flow; we call into it
  // by dispatching a custom event that the wallet layer listens for and
  // returns a promise via a registered global handler. This keeps this
  // component wallet-agnostic.
  const w = (window as unknown as {
    __nakaSignPendingTrade?: (t: PendingTrade) => Promise<{ txHash: string } | null>;
  }).__nakaSignPendingTrade;
  if (typeof w === "function") return w(trade);
  // Fallback: navigate user to the swap page pre-filled so they can sign there.
  const qs = new URLSearchParams({
    from: trade.from_token_address,
    to: trade.to_token_address,
    chain: trade.chain,
    amount: trade.amount_in,
    pendingId: trade.id,
  });
  window.location.href = `/dashboard/swap?${qs.toString()}`;
  return null;
}

export function PendingTradesBanner() {
  const [trades, setTrades] = useState<PendingTrade[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trading/pending-trades", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { trades: PendingTrade[] };
      setTrades(data.trades ?? []);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [load]);

  const onConfirm = useCallback(
    async (trade: PendingTrade) => {
      setBusyId(trade.id);
      try {
        const signed = await signAndBroadcast(trade);
        if (!signed) return;
        const res = await fetch(`/api/trading/pending-trades/${trade.id}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txHash: signed.txHash }),
        });
        if (res.ok) {
          setTrades((prev) => prev.filter((t) => t.id !== trade.id));
        }
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const onReject = useCallback(async (trade: PendingTrade) => {
    setBusyId(trade.id);
    try {
      const res = await fetch(`/api/trading/pending-trades/${trade.id}/reject`, {
        method: "POST",
      });
      if (res.ok) setTrades((prev) => prev.filter((t) => t.id !== trade.id));
    } finally {
      setBusyId(null);
    }
  }, []);

  if (trades.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-full max-w-md">
      <div className="rounded-xl border border-blue-500/30 bg-slate-900/95 shadow-2xl shadow-blue-500/10 backdrop-blur">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            <span className="text-sm font-semibold text-white">
              {trades.length} pending trade{trades.length === 1 ? "" : "s"}
            </span>
            <span className="text-xs text-slate-400">awaiting confirmation</span>
          </div>
          <span className="text-xs text-slate-400">{expanded ? "Hide" : "Review"}</span>
        </button>
        {expanded && (
          <div className="max-h-96 overflow-y-auto border-t border-slate-800">
            {trades.map((trade) => {
              const expiresIn = Math.max(
                0,
                Math.round((new Date(trade.expires_at).getTime() - Date.now()) / 60000),
              );
              const honeypot = trade.security_is_honeypot === true;
              const trustWarn =
                trade.security_trust_score != null && trade.security_trust_score < 50;
              return (
                <div
                  key={trade.id}
                  className="border-b border-slate-800 px-4 py-3 last:border-b-0"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {REASON_LABEL[trade.source_reason]} · {trade.chain.toUpperCase()}
                    </span>
                    <span>{expiresIn}m left</span>
                  </div>
                  <div className="mt-1 font-mono text-sm text-white">
                    {trade.amount_in} {trade.from_token_symbol ?? "token"} →{" "}
                    {trade.expected_amount_out ?? "?"} {trade.to_token_symbol ?? "token"}
                  </div>
                  {(honeypot || trustWarn) && (
                    <div className="mt-1 text-xs text-amber-400">
                      {honeypot
                        ? "Honeypot flag present — review before confirming."
                        : `Low trust score ${trade.security_trust_score}/100.`}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === trade.id}
                      onClick={() => onConfirm(trade)}
                      className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {busyId === trade.id ? "Signing..." : "Confirm in Wallet"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === trade.id}
                      onClick={() => onReject(trade)}
                      className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
